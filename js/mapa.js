// =====================================================================
// AgroDataLocal — Mapa interactivo de México (D3 + GeoJSON)
// Coropleta con tres modos: nº muestras, clase predominante, promedio variable.
// Click en estado abre panel lateral con stats detalladas.
// =====================================================================

window.Mapa = (function () {
    'use strict';

    // ---- Constantes ----
    const VARIABLES_MODELO = ['N', 'SAND', 'CLAY', 'CEC', 'SILT', 'SAR', 'Mg'];
    const VARIABLES_PANEL = ['N', 'SAND', 'SILT', 'CLAY', 'CEC', 'SAR', 'Mg'];
    const UNIDADES = {
        N: '%', SAND: '%', SILT: '%', CLAY: '%',
        CEC: 'cmol/kg', SAR: '', Mg: 'cmol/kg', pH: '', EC: 'dS/m'
    };
    const NOMBRES_CLASE = { 0: 'Baja', 1: 'Media', 2: 'Alta' };
    const COLOR_CLASE = { baja: '#e74c3c', media: '#f39c12', alta: '#27ae60' };
    const W = 800, H = 460;

    // ---- Estado ----
    let geojson = null;
    let agregados = {};         // por clave normalizada: { n, baja, media, alta, promedios, clasePred, nombre }
    let modoActual = 'muestras';
    let varActual = 'N';
    let svg, tooltip, projection, path;
    let estadoSeleccionado = null;

    // ---- Util ----
    function normalizar(nombre) {
        if (!nombre) return '';
        let s = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
        // El GeoJSON usa "Ciudad de México"; el dataset usa "Distrito Federal".
        if (s === 'ciudad de mexico') s = 'distrito federal';
        return s;
    }

    function fmt(v, decimales) {
        if (v == null || isNaN(v)) return '—';
        return Number(v).toFixed(decimales != null ? decimales : 2);
    }

    // ---- Agregados por estado ----
    function calcularAgregados(dataset) {
        const a = {};
        for (const r of dataset) {
            const k = normalizar(r.STATE);
            if (!a[k]) {
                a[k] = {
                    nombre: r.STATE,
                    n: 0, baja: 0, media: 0, alta: 0,
                    sumas: Object.fromEntries(VARIABLES_PANEL.map(v => [v, 0])),
                    suelos: {}
                };
            }
            a[k].n++;
            const out = +r.Output;
            if (out === 0) a[k].baja++;
            else if (out === 1) a[k].media++;
            else a[k].alta++;
            VARIABLES_PANEL.forEach(v => {
                if (typeof r[v] === 'number') a[k].sumas[v] += r[v];
            });
            const st = r.SOIL_TYPE || 'Desconocido';
            a[k].suelos[st] = (a[k].suelos[st] || 0) + 1;
        }
        Object.values(a).forEach(e => {
            e.promedios = {};
            VARIABLES_PANEL.forEach(v => e.promedios[v] = e.sumas[v] / e.n);
            const m = Math.max(e.baja, e.media, e.alta);
            e.clasePred = (m === e.alta) ? 'alta' : (m === e.media) ? 'media' : 'baja';
            e.suelosTop = Object.entries(e.suelos).sort((a, b) => b[1] - a[1]).slice(0, 3);
        });
        return a;
    }

    // ---- Escalas de color por modo ----
    function colorParaEstado(stateName) {
        const k = normalizar(stateName);
        const ag = agregados[k];
        if (!ag) return '#e8e8e8';

        if (modoActual === 'muestras') {
            const max = d3.max(Object.values(agregados), d => d.n);
            return d3.interpolateBlues(0.15 + 0.85 * (ag.n / max));
        }
        if (modoActual === 'clase') {
            return COLOR_CLASE[ag.clasePred];
        }
        // modo variable
        const valores = Object.values(agregados).map(d => d.promedios[varActual]);
        const ext = d3.extent(valores);
        const t = (ag.promedios[varActual] - ext[0]) / (ext[1] - ext[0] || 1);
        return d3.interpolateViridis(t);
    }

    function valorParaEstado(stateName) {
        const ag = agregados[normalizar(stateName)];
        if (!ag) return null;
        if (modoActual === 'muestras') return ag.n + ' muestras';
        if (modoActual === 'clase') return 'Predomina: ' + NOMBRES_CLASE[ {baja:0,media:1,alta:2}[ag.clasePred] ];
        const v = ag.promedios[varActual];
        return varActual + ': ' + fmt(v, 2) + (UNIDADES[varActual] ? ' ' + UNIDADES[varActual] : '');
    }

    // ---- Render ----
    function render() {
        svg.selectAll('path.estado-path')
            .transition().duration(450)
            .attr('fill', d => colorParaEstado(d.properties.name));
        renderLeyenda();
        // Si hay un estado seleccionado, refrescar su panel (para que cambie el resaltado de variable)
        if (estadoSeleccionado) renderPanel(estadoSeleccionado);
    }

    function renderLeyenda() {
        const leyenda = document.getElementById('mapa-leyenda');
        if (!leyenda) return;

        if (modoActual === 'clase') {
            leyenda.innerHTML = `
                <div class="leyenda-item"><span class="ley-color" style="background:${COLOR_CLASE.baja}"></span>Baja fertilidad</div>
                <div class="leyenda-item"><span class="ley-color" style="background:${COLOR_CLASE.media}"></span>Media fertilidad</div>
                <div class="leyenda-item"><span class="ley-color" style="background:${COLOR_CLASE.alta}"></span>Alta fertilidad</div>
            `;
            return;
        }

        // Gradiente continuo para muestras / variable
        let ext, etiq, interp;
        if (modoActual === 'muestras') {
            ext = d3.extent(Object.values(agregados), d => d.n);
            etiq = 'muestras';
            interp = d3.interpolateBlues;
        } else {
            const vals = Object.values(agregados).map(d => d.promedios[varActual]);
            ext = d3.extent(vals);
            etiq = varActual + (UNIDADES[varActual] ? ' (' + UNIDADES[varActual] + ')' : '');
            interp = d3.interpolateViridis;
        }
        const stops = 6;
        // Ajustar decimales según la magnitud: valores chicos necesitan más precisión
        const rango = ext[1] - ext[0];
        const dec = rango >= 10 ? 1 : (rango >= 1 ? 2 : 3);
        let html = `<div class="leyenda-label">${etiq}</div><div class="leyenda-grad">`;
        for (let i = 0; i < stops; i++) {
            const t = i / (stops - 1);
            html += `<span class="ley-step" style="background:${interp(modoActual === 'muestras' ? 0.15 + 0.85 * t : t)}" title="${fmt(ext[0] + t * (ext[1] - ext[0]), dec)}"></span>`;
        }
        html += `</div><div class="leyenda-range"><span>${fmt(ext[0], dec)}</span><span>${fmt(ext[1], dec)}</span></div>`;
        leyenda.innerHTML = html;
    }

    // ---- Panel lateral ----
    function renderPanel(stateName) {
        const panel = document.getElementById('mapa-panel');
        const ag = agregados[normalizar(stateName)];
        if (!panel || !ag) return;

        const pct = c => ag.n ? ((ag[c] / ag.n) * 100).toFixed(0) : '0';
        const suelosHtml = ag.suelosTop.map(([nombre, cnt]) =>
            `<li><strong>${nombre}</strong>: ${cnt} (${((cnt / ag.n) * 100).toFixed(0)}%)</li>`
        ).join('');

        const tablaPromedios = VARIABLES_PANEL.map(v => {
            const u = UNIDADES[v] || '';
            const destacar = (modoActual === 'variable' && v === varActual) ? ' fila-destacada' : '';
            return `<tr class="${destacar}">
                <td>${v}</td>
                <td><strong>${fmt(ag.promedios[v], 2)}</strong></td>
                <td>${u}</td>
            </tr>`;
        }).join('');

        panel.innerHTML = `
            <div class="mapa-panel-header">
                <h3>${stateName}</h3>
                <button class="mapa-panel-cerrar" type="button" aria-label="Cerrar panel">×</button>
            </div>
            <div class="mapa-panel-stat-grande">
                <div class="stat-num">${ag.n}</div>
                <div class="stat-lab">muestras en este estado</div>
            </div>
            <div class="mapa-panel-clases">
                <h4>Distribución de fertilidad</h4>
                <div class="barra-clases">
                    <div class="barra-baja"  style="width:${pct('baja')}%"  title="Baja: ${ag.baja}">${ag.baja > 0 ? ag.baja : ''}</div>
                    <div class="barra-media" style="width:${pct('media')}%" title="Media: ${ag.media}">${ag.media > 0 ? ag.media : ''}</div>
                    <div class="barra-alta"  style="width:${pct('alta')}%"  title="Alta: ${ag.alta}">${ag.alta > 0 ? ag.alta : ''}</div>
                </div>
                <div class="barra-leyenda">
                    <span><span class="punto" style="background:${COLOR_CLASE.baja}"></span>Baja ${pct('baja')}%</span>
                    <span><span class="punto" style="background:${COLOR_CLASE.media}"></span>Media ${pct('media')}%</span>
                    <span><span class="punto" style="background:${COLOR_CLASE.alta}"></span>Alta ${pct('alta')}%</span>
                </div>
                <p class="clase-predominante">
                    Clase predominante: <strong style="color:${COLOR_CLASE[ag.clasePred]}">${ag.clasePred.charAt(0).toUpperCase() + ag.clasePred.slice(1)}</strong>
                </p>
            </div>
            <div class="mapa-panel-promedios">
                <h4>Promedios del modelo (7 variables)</h4>
                <table class="tabla-promedios">
                    <thead><tr><th>Variable</th><th>Media</th><th>Unidad</th></tr></thead>
                    <tbody>${tablaPromedios}</tbody>
                </table>
            </div>
            <div class="mapa-panel-suelos">
                <h4>Tipos de suelo más frecuentes</h4>
                <ul>${suelosHtml}</ul>
            </div>
        `;

        panel.querySelector('.mapa-panel-cerrar').addEventListener('click', cerrarPanel);
        estadoSeleccionado = stateName;

        // Resaltar el estado en el mapa
        svg.selectAll('path.estado-path')
            .classed('seleccionado', d => d.properties.name === stateName);
    }

    function cerrarPanel() {
        estadoSeleccionado = null;
        svg.selectAll('path.estado-path').classed('seleccionado', false);
        const panel = document.getElementById('mapa-panel');
        if (panel) {
            panel.innerHTML = `
                <div class="mapa-panel-vacio">
                    <div class="mapa-panel-icono">📍</div>
                    <p>Haz <strong>click en un estado</strong> para ver sus estadísticas detalladas.</p>
                    <p class="mapa-panel-hint">También puedes pasar el cursor sobre un estado para ver el valor del modo actual.</p>
                </div>
            `;
        }
    }

    // ---- Tooltip ----
    function mostrarTooltip(event, d) {
        const ag = agregados[normalizar(d.properties.name)];
        if (!ag) return;
        const html = `<strong>${d.properties.name}</strong><br/>
                      <span class="tt-val">${valorParaEstado(d.properties.name)}</span><br/>
                      <span class="tt-extra">${ag.n} muestras totales</span>`;
        tooltip.html(html).classed('visible', true);
        moverTooltip(event);
    }

    function moverTooltip(event) {
        tooltip.style('left', (event.pageX + 14) + 'px')
               .style('top',  (event.pageY + 14) + 'px');
    }

    function ocultarTooltip() {
        tooltip.classed('visible', false);
    }

    // ---- Controles ----
    function bindControles() {
        document.querySelectorAll('.mapa-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mapa-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                modoActual = btn.dataset.modo;
                const sel = document.getElementById('mapa-var-select');
                if (sel) sel.style.display = (modoActual === 'variable') ? 'inline-block' : 'none';
                render();
            });
        });

        const sel = document.getElementById('mapa-var-select');
        if (sel) {
            sel.style.display = 'none';
            sel.addEventListener('change', () => {
                varActual = sel.value;
                if (modoActual === 'variable') render();
            });
        }
    }

    // ---- Inicialización ----
    async function init() {
        if (typeof d3 === 'undefined') {
            console.error('[Mapa] D3 no está disponible');
            return;
        }
        if (!Array.isArray(window.DATASET)) {
            console.error('[Mapa] DATASET no está cargado');
            return;
        }

        try {
            const r = await fetch('data/mexico.geojson');
            geojson = await r.json();
        } catch (e) {
            console.error('[Mapa] Error al cargar geojson:', e);
            return;
        }

        agregados = calcularAgregados(window.DATASET);

        const svgEl = document.getElementById('mapa-svg');
        if (!svgEl) return;

        svg = d3.select(svgEl)
            .attr('viewBox', `0 0 ${W} ${H}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        projection = d3.geoMercator().fitSize([W - 20, H - 20], geojson);
        path = d3.geoPath().projection(projection);

        tooltip = d3.select('body').selectAll('.mapa-tooltip').data([0])
            .join('div').attr('class', 'mapa-tooltip');

        svg.append('g').selectAll('path')
            .data(geojson.features)
            .join('path')
            .attr('class', 'estado-path')
            .attr('d', path)
            .attr('fill', d => colorParaEstado(d.properties.name))
            .attr('stroke', '#fff')
            .attr('stroke-width', 0.6)
            .on('mouseenter', mostrarTooltip)
            .on('mousemove', moverTooltip)
            .on('mouseleave', ocultarTooltip)
            .on('click', (_e, d) => renderPanel(d.properties.name));

        renderLeyenda();
        bindControles();
        console.log('[Mapa] Inicializado con', Object.keys(agregados).length, 'estados');
    }

    return { init };
})();
