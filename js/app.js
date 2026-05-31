// =====================================================================
// AgroDataLocal — App principal: une dataset, KNN, estadísticas y UI
// =====================================================================

// ====== DEBUG GLOBAL ======
const DEBUG = {
    log:  (...args) => console.log('%c[AgroDebug]', 'color:#3498db;font-weight:bold', ...args),
    ok:   (...args) => console.log('%c[AgroDebug] ✓', 'color:#27ae60;font-weight:bold', ...args),
    warn: (...args) => console.warn('%c[AgroDebug] ⚠', 'color:#f39c12;font-weight:bold', ...args),
    err:  (...args) => console.error('%c[AgroDebug] ✗', 'color:#e74c3c;font-weight:bold', ...args),
    group: (label) => console.group('%c[AgroDebug] ' + label, 'color:#9b59b6;font-weight:bold'),
    groupEnd: () => console.groupEnd()
};
window.DEBUG = DEBUG;

// Capturar errores globales
window.addEventListener('error', (e) => {
    DEBUG.err('Error global capturado:', e.message);
    DEBUG.err('  Archivo:', e.filename);
    DEBUG.err('  Línea:', e.lineno + ':' + e.colno);
    DEBUG.err('  Stack:', e.error ? e.error.stack : '(no disponible)');
});

window.addEventListener('unhandledrejection', (e) => {
    DEBUG.err('Promesa rechazada sin manejo:', e.reason);
});

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
        DEBUG.group('Inicio de la aplicación');
        DEBUG.log('DOM cargado, ejecutando inicializarApp()');
        DEBUG.log('User agent:', navigator.userAgent);

        // Verificar dependencias
        DEBUG.log('--- Verificando dependencias ---');
        DEBUG.log('window.d3 disponible:', typeof d3 !== 'undefined' ? '✓ SÍ (v' + (d3.version || '?') + ')' : '✗ NO');
        DEBUG.log('window.Chart disponible:', typeof Chart !== 'undefined' ? '✓ SÍ' : '✗ NO');
        DEBUG.log('window.Radar3D disponible:', typeof Radar3D !== 'undefined' ? '✓ SÍ' : '✗ NO');
        DEBUG.log('window.DATASET disponible:', typeof DATASET !== 'undefined' ? '✓ SÍ (' + DATASET.length + ' registros)' : '✗ NO');
        DEBUG.log('FEATURE_NAMES:', typeof FEATURE_NAMES !== 'undefined' ? FEATURE_NAMES : '✗ NO DEFINIDO');

        // Verificar contenedores en el DOM
        DEBUG.log('--- Verificando contenedores DOM ---');
        const contenedores = [
            'tabla-estadisticas', 'chart-distribucion', 'chart-correlaciones',
            'sliders-container', 'chart-radar-d3', 'radar-legend-container',
            'pred-clase-nombre', 'pred-probs', 'pred-reco'
        ];
        contenedores.forEach(id => {
            const el = document.getElementById(id);
            DEBUG.log(`  #${id}:`, el ? '✓ encontrado' : '✗ NO ENCONTRADO');
        });

        try {
            inicializarApp();
            DEBUG.ok('Aplicación inicializada correctamente');
        } catch (e) {
            DEBUG.err('Error en inicializarApp():', e.message);
            DEBUG.err('Stack:', e.stack);
        }
        DEBUG.groupEnd();
    });

    function inicializarApp() {
        DEBUG.group('inicializarApp()');

        // 1. Pre-calcular cosas del dataset
        try {
            DEBUG.log('1. Calculando rangos de las variables...');
            estado.rangos = calcularRangos(DATASET, FEATURE_NAMES);
            DEBUG.ok('   Rangos calculados:', estado.rangos);

            DEBUG.log('2. Calculando perfiles de cada clase...');
            estado.perfiles = calcularPerfilesClase(DATASET, FEATURE_NAMES);
            DEBUG.ok('   Perfiles calculados:', estado.perfiles);

            DEBUG.log('3. Ajustando escalador (media y std por variable)...');
            estado.parametrosEscalador = ajustarEscalador(DATASET, FEATURE_NAMES);
            DEBUG.ok('   Escalador ajustado');
        } catch (e) {
            DEBUG.err('Error en pre-cálculos:', e.message, e.stack);
            throw e;
        }

        // 2. Valores iniciales = perfil de fertilidad MEDIA
        FEATURE_NAMES.forEach(f => {
            estado.valoresActuales[f] = estado.perfiles[1][f];
        });
        DEBUG.ok('Valores iniciales asignados (perfil MEDIA):', estado.valoresActuales);

        // 3. Renderizar cada sección con try/catch individual
        const secciones = [
            ['Tabla estadísticas', renderTablaEstadisticas],
            ['Gráfica distribución', renderGraficaDistribucion],
            ['Gráfica correlaciones', renderGraficaCorrelaciones],
            ['Sliders', renderSliders],
            ['Gráfica radar 3D', renderGraficaRadar],
            ['Botones preset', renderPresetButtons],
            ['Predicción inicial', actualizarPrediccion]
        ];

        secciones.forEach(([nombre, fn]) => {
            try {
                DEBUG.log('Renderizando:', nombre);
                fn();
                DEBUG.ok('  ' + nombre + ' renderizado OK');
            } catch (e) {
                DEBUG.err('Error al renderizar ' + nombre + ':', e.message);
                DEBUG.err('  Stack:', e.stack);
            }
        });

        DEBUG.groupEnd();
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
        DEBUG.log('  renderGraficaRadar() iniciando...');

        // Verificar que D3 está disponible
        if (typeof d3 === 'undefined') {
            DEBUG.err('  D3.js NO está disponible. ¿No se cargó el CDN?');
            throw new Error('D3.js no disponible');
        }
        DEBUG.ok('  D3.js detectado, versión:', d3.version);

        // Verificar que Radar3D está disponible
        if (typeof Radar3D === 'undefined') {
            DEBUG.err('  La clase Radar3D NO está disponible. ¿Se cargó radar3d.js?');
            throw new Error('Radar3D no disponible');
        }
        DEBUG.ok('  Radar3D class encontrada');

        // Verificar el contenedor
        const cont = document.getElementById('chart-radar-d3');
        if (!cont) {
            DEBUG.err('  Contenedor #chart-radar-d3 NO existe en el DOM');
            throw new Error('Contenedor no existe');
        }
        DEBUG.ok('  Contenedor #chart-radar-d3 encontrado:', {
            width: cont.offsetWidth,
            height: cont.offsetHeight,
            inHTML: cont.innerHTML.length
        });

        // Calcular datos normalizados
        const datosUser = normalizarParaRadar(estado.valoresActuales);
        const datosAlta = normalizarParaRadar(estado.perfiles[2]);
        const datosBaja = normalizarParaRadar(estado.perfiles[0]);
        DEBUG.log('  Datos normalizados (escala 0-100):');
        DEBUG.log('    Tu muestra:', datosUser.map(v => v.toFixed(1)));
        DEBUG.log('    ALTA:', datosAlta.map(v => v.toFixed(1)));
        DEBUG.log('    BAJA:', datosBaja.map(v => v.toFixed(1)));

        try {
            DEBUG.log('  Creando instancia Radar3D...');
            estado.radar3d = new Radar3D('chart-radar-d3', FEATURE_NAMES, {
                width: 560,
                height: 560,
                tiltAngle: 0.4,
                transitionMs: 500
            });
            DEBUG.ok('  Instancia Radar3D creada');

            DEBUG.log('  Llamando setDatasets() con 3 perfiles...');
            estado.radar3d.setDatasets([
                {
                    id: 'baja',
                    label: 'Perfil BAJA fertilidad',
                    data: datosBaja,
                    color: '#c0392b',
                    gradient: 'gradBaja',
                    esPrincipal: false
                },
                {
                    id: 'alta',
                    label: 'Perfil ALTA fertilidad',
                    data: datosAlta,
                    color: '#1e8449',
                    gradient: 'gradAlta',
                    esPrincipal: false
                },
                {
                    id: 'user',
                    label: 'Tu muestra',
                    data: datosUser,
                    color: '#2874a6',
                    gradient: 'gradUsuario',
                    esPrincipal: true
                }
            ]);
            DEBUG.ok('  setDatasets() completado');

            // Verificar que se creó el SVG
            const svg = cont.querySelector('svg');
            if (svg) {
                DEBUG.ok('  SVG creado en el contenedor:', {
                    width: svg.getAttribute('width') || svg.style.width || 'auto',
                    height: svg.getAttribute('height') || svg.style.height || 'auto',
                    viewBox: svg.getAttribute('viewBox'),
                    children: svg.children.length
                });
            } else {
                DEBUG.err('  ⚠ NO se creó ningún SVG en el contenedor!');
            }
        } catch (e) {
            DEBUG.err('  Error creando radar:', e.message);
            DEBUG.err('  Stack:', e.stack);
            throw e;
        }

        // Renderizar leyenda manual
        renderLeyendaRadar();
        DEBUG.ok('  renderGraficaRadar() terminado');
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
