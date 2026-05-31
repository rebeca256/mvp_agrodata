// =====================================================================
// AgroDataLocal — App principal: une dataset, KNN, estadísticas y UI
// =====================================================================

(function() {
    'use strict';

    // --- Estado global de la app ---
    const estado = {
        rangos: null,
        perfiles: null,
        parametrosEscalador: null,
        valoresActuales: {},
        chartRadar: null,
        chartDistribucion: null,
        chartCorrelaciones: null,
    };

    // =====================================================================
    // Inicialización al cargar la página
    // =====================================================================
    document.addEventListener('DOMContentLoaded', () => {
        inicializarApp();
    });

    function inicializarApp() {
        // 1. Pre-calcular cosas del dataset (se usan varias veces)
        estado.rangos = calcularRangos(DATASET, FEATURE_NAMES);
        estado.perfiles = calcularPerfilesClase(DATASET, FEATURE_NAMES);
        estado.parametrosEscalador = ajustarEscalador(DATASET, FEATURE_NAMES);

        // 2. Valores iniciales = perfil de fertilidad MEDIA
        FEATURE_NAMES.forEach(f => {
            estado.valoresActuales[f] = estado.perfiles[1][f];
        });

        // 3. Renderizar cada sección
        renderTablaEstadisticas();
        renderGraficaDistribucion();
        renderGraficaCorrelaciones();
        renderSliders();
        renderGraficaRadar();
        renderPresetButtons();
        actualizarPrediccion();
    }

    // =====================================================================
    // Tabla de estadísticas descriptivas
    // =====================================================================
    function renderTablaEstadisticas() {
        const estadisticas = calcularEstadisticasCompletas(DATASET, FEATURE_NAMES);
        const tbody = document.querySelector('#tabla-estadisticas tbody');
        tbody.innerHTML = '';

        FEATURE_NAMES.forEach(f => {
            const e = estadisticas[f];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${f}</strong></td>
                <td>${e.media.toFixed(2)}</td>
                <td>${e.mediana.toFixed(2)}</td>
                <td>${e.moda.toFixed(2)}</td>
                <td>${e.std.toFixed(2)}</td>
                <td>${e.varianza.toFixed(2)}</td>
                <td>${e.min.toFixed(2)}</td>
                <td>${e.max.toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // =====================================================================
    // Gráfica: distribución de clases
    // =====================================================================
    function renderGraficaDistribucion() {
        const dist = distribucionClases(DATASET);
        const ctx = document.getElementById('chart-distribucion').getContext('2d');

        estado.chartDistribucion = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: CLASS_NAMES.map((n, i) => `${n} (${dist.porcentajes[i].toFixed(1)}%)`),
                datasets: [{
                    label: 'Número de muestras',
                    data: dist.conteo,
                    backgroundColor: CLASS_COLORS,
                    borderColor: CLASS_COLORS,
                    borderWidth: 1,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: `Total: ${dist.total} muestras`,
                        font: { size: 14 }
                    }
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Cantidad' } }
                }
            }
        });
    }

    // =====================================================================
    // Gráfica: correlaciones con la fertilidad
    // =====================================================================
    function renderGraficaCorrelaciones() {
        const correlaciones = calcularCorrelaciones(DATASET, FEATURE_NAMES);
        // Ordenar por valor descendente
        const sorted = FEATURE_NAMES
            .map(f => ({ feature: f, valor: correlaciones[f] }))
            .sort((a, b) => b.valor - a.valor);

        const ctx = document.getElementById('chart-correlaciones').getContext('2d');
        estado.chartCorrelaciones = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(s => s.feature),
                datasets: [{
                    label: 'Correlación de Pearson',
                    data: sorted.map(s => s.valor),
                    backgroundColor: sorted.map(s =>
                        s.valor >= 0 ? '#27ae60' : '#e74c3c'),
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        title: { display: true, text: 'Coeficiente r' },
                        min: -0.3, max: 0.8
                    }
                }
            }
        });
    }

    // =====================================================================
    // Sliders interactivos
    // =====================================================================
    function renderSliders() {
        const container = document.getElementById('sliders-container');
        container.innerHTML = '';

        FEATURE_NAMES.forEach(feature => {
            const rango = estado.rangos[feature];
            const valorActual = estado.valoresActuales[feature];
            const step = (rango.max - rango.min) / 200;

            const row = document.createElement('div');
            row.className = 'slider-row';
            row.innerHTML = `
                <label>${feature}</label>
                <div class="slider-control">
                    <input type="range"
                        min="${rango.min}"
                        max="${rango.max}"
                        step="${step}"
                        value="${valorActual}"
                        data-feature="${feature}">
                    <div class="rango">[${rango.min.toFixed(1)} — ${rango.max.toFixed(1)}]</div>
                </div>
                <div class="valor" id="valor-${feature}">${valorActual.toFixed(2)}</div>
            `;
            container.appendChild(row);

            // Evento de cambio
            const input = row.querySelector('input');
            input.addEventListener('input', e => {
                const valor = parseFloat(e.target.value);
                estado.valoresActuales[feature] = valor;
                document.getElementById(`valor-${feature}`).textContent = valor.toFixed(2);
                actualizarRadar();
                actualizarPrediccion();
            });
        });
    }

    // =====================================================================
    // Gráfica radar 3D-isométrico con D3.js
    // =====================================================================
    function normalizarParaRadar(valores) {
        return FEATURE_NAMES.map(f => {
            const r = estado.rangos[f];
            return ((valores[f] - r.min) / (r.max - r.min)) * 100;
        });
    }

    function renderGraficaRadar() {
        estado.radar3d = new Radar3D('chart-radar-d3', FEATURE_NAMES, {
            width: 560,
            height: 560,
            tiltAngle: 0.4,
            transitionMs: 500
        });

        estado.radar3d.setDatasets([
            {
                id: 'baja',
                label: 'Perfil BAJA fertilidad',
                data: normalizarParaRadar(estado.perfiles[0]),
                color: '#c0392b',
                gradient: 'gradBaja',
                esPrincipal: false
            },
            {
                id: 'alta',
                label: 'Perfil ALTA fertilidad',
                data: normalizarParaRadar(estado.perfiles[2]),
                color: '#1e8449',
                gradient: 'gradAlta',
                esPrincipal: false
            },
            {
                id: 'user',
                label: 'Tu muestra',
                data: normalizarParaRadar(estado.valoresActuales),
                color: '#2874a6',
                gradient: 'gradUsuario',
                esPrincipal: true
            }
        ]);

        // Renderizar leyenda manual
        renderLeyendaRadar();
    }

    function renderLeyendaRadar() {
        const leyendaHtml = `
            <div class="radar-legend">
                <div class="legend-item">
                    <span class="legend-swatch swatch-user"></span>
                    <span>Tu muestra</span>
                </div>
                <div class="legend-item">
                    <span class="legend-swatch swatch-alta"></span>
                    <span>Perfil ALTA</span>
                </div>
                <div class="legend-item">
                    <span class="legend-swatch swatch-baja"></span>
                    <span>Perfil BAJA</span>
                </div>
            </div>
        `;
        const container = document.getElementById('radar-legend-container');
        if (container) container.innerHTML = leyendaHtml;
    }

    function actualizarRadar() {
        if (!estado.radar3d) return;
        estado.radar3d.actualizarPrincipal(normalizarParaRadar(estado.valoresActuales));
    }

    // =====================================================================
    // Botones de preset (cargar perfiles)
    // =====================================================================
    function renderPresetButtons() {
        document.querySelectorAll('.preset-buttons .btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const clase = parseInt(btn.getAttribute('data-clase'));
                cargarPerfil(estado.perfiles[clase]);
            });
        });
    }

    function cargarPerfil(perfil) {
        FEATURE_NAMES.forEach(f => {
            estado.valoresActuales[f] = perfil[f];
            const input = document.querySelector(`input[data-feature="${f}"]`);
            if (input) input.value = perfil[f];
            const valEl = document.getElementById(`valor-${f}`);
            if (valEl) valEl.textContent = perfil[f].toFixed(2);
        });
        actualizarRadar();
        actualizarPrediccion();
    }

    // =====================================================================
    // Predicción en vivo
    // =====================================================================
    function actualizarPrediccion() {
        const resultado = predecirKNN(
            estado.valoresActuales,
            DATASET,
            estado.parametrosEscalador,
            K_VECINOS
        );

        // Actualizar la clase predicha
        const elClase = document.getElementById('pred-clase-nombre');
        elClase.textContent = resultado.nombreClase;
        elClase.className = '';
        elClase.classList.add(resultado.nombreClase.toLowerCase());

        // Probabilidades
        const probsHtml = CLASS_NAMES.map((nombre, i) =>
            `<span><strong>${nombre}:</strong> ${(resultado.probabilidades[i] * 100).toFixed(0)}%</span>`
        ).join('');
        document.getElementById('pred-probs').innerHTML = probsHtml;

        // Recomendación
        const reco = RECOMENDACIONES[resultado.prediccion];
        const recoHtml = `
            <strong>${reco.titulo}</strong>
            <ul>${reco.consejos.map(c => `<li>${c}</li>`).join('')}</ul>
        `;
        document.getElementById('pred-reco').innerHTML = recoHtml;
    }

})();
