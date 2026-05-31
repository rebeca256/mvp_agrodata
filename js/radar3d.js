// =====================================================================
// Radar 3D-isométrico con D3.js
// Crea un gráfico de radar con efecto tridimensional usando perspectiva,
// gradientes, sombras y animaciones suaves.
// =====================================================================

class Radar3D {
    constructor(containerId, features, options = {}) {
        this.containerId = containerId;
        this.features = features;
        this.numAxes = features.length;

        // Opciones por defecto
        this.opts = {
            width: 520,
            height: 520,
            margin: 60,
            tiltAngle: 0.45,       // qué tanto inclinar el radar (factor 0-1)
            levels: 5,             // anillos concéntricos
            maxValue: 100,
            transitionMs: 600,
            ...options
        };

        this.datasets = [];
        this.init();
    }

    // -----------------------------------------------------------------
    // Inicialización: crear SVG, defs, anillos, ejes, labels
    // -----------------------------------------------------------------
    init() {
        const container = d3.select('#' + this.containerId);
        container.selectAll('*').remove();

        const w = this.opts.width;
        const h = this.opts.height;
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(w, h) / 2 - this.opts.margin;
        // Radios horizontal y vertical para efecto isométrico
        this.rx = radius;
        this.ry = radius * (1 - this.opts.tiltAngle * 0.45);

        this.svg = container
            .append('svg')
            .attr('viewBox', `0 0 ${w} ${h}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .style('width', '100%')
            .style('height', 'auto')
            .style('display', 'block');

        this.cx = cx;
        this.cy = cy;

        this._crearDefs();
        this._crearBaseEllipse();
        this._crearAnillos();
        this._crearEjes();
        this._crearLabels();

        // Contenedor para los polígonos (datos)
        this.polygonsGroup = this.svg.append('g').attr('class', 'polygons');
        this.pointsGroup = this.svg.append('g').attr('class', 'points');
    }

    // -----------------------------------------------------------------
    // <defs>: gradientes radiales, filtros de sombra y glow
    // -----------------------------------------------------------------
    _crearDefs() {
        const defs = this.svg.append('defs');

        // Gradiente radial para el fondo del radar (efecto profundidad)
        const bgGrad = defs.append('radialGradient')
            .attr('id', 'radarBgGradient')
            .attr('cx', '50%').attr('cy', '50%')
            .attr('r', '50%');
        bgGrad.append('stop').attr('offset', '0%').attr('stop-color', '#ffffff');
        bgGrad.append('stop').attr('offset', '70%').attr('stop-color', '#f5f8fa');
        bgGrad.append('stop').attr('offset', '100%').attr('stop-color', '#e8eef2');

        // Gradiente "Tu muestra"
        const userGrad = defs.append('radialGradient')
            .attr('id', 'gradUsuario').attr('cx', '50%').attr('cy', '50%').attr('r', '50%');
        userGrad.append('stop').attr('offset', '0%').attr('stop-color', '#5dade2').attr('stop-opacity', 0.85);
        userGrad.append('stop').attr('offset', '100%').attr('stop-color', '#2874a6').attr('stop-opacity', 0.55);

        // Gradiente "perfil Alta"
        const altaGrad = defs.append('radialGradient')
            .attr('id', 'gradAlta').attr('cx', '50%').attr('cy', '50%').attr('r', '50%');
        altaGrad.append('stop').attr('offset', '0%').attr('stop-color', '#58d68d').attr('stop-opacity', 0.4);
        altaGrad.append('stop').attr('offset', '100%').attr('stop-color', '#1e8449').attr('stop-opacity', 0.15);

        // Gradiente "perfil Baja"
        const bajaGrad = defs.append('radialGradient')
            .attr('id', 'gradBaja').attr('cx', '50%').attr('cy', '50%').attr('r', '50%');
        bajaGrad.append('stop').attr('offset', '0%').attr('stop-color', '#ec7063').attr('stop-opacity', 0.4);
        bajaGrad.append('stop').attr('offset', '100%').attr('stop-color', '#a93226').attr('stop-opacity', 0.15);

        // Filtro de sombra para los polígonos
        const dropShadow = defs.append('filter')
            .attr('id', 'shadow').attr('x', '-20%').attr('y', '-20%')
            .attr('width', '140%').attr('height', '140%');
        dropShadow.append('feGaussianBlur').attr('in', 'SourceAlpha').attr('stdDeviation', 3);
        dropShadow.append('feOffset').attr('dx', 0).attr('dy', 4).attr('result', 'offsetblur');
        dropShadow.append('feComponentTransfer').append('feFuncA')
            .attr('type', 'linear').attr('slope', 0.35);
        const merge = dropShadow.append('feMerge');
        merge.append('feMergeNode');
        merge.append('feMergeNode').attr('in', 'SourceGraphic');

        // Filtro de glow para puntos
        const glow = defs.append('filter')
            .attr('id', 'glow').attr('x', '-50%').attr('y', '-50%')
            .attr('width', '200%').attr('height', '200%');
        glow.append('feGaussianBlur').attr('stdDeviation', 4).attr('result', 'coloredBlur');
        const glowMerge = glow.append('feMerge');
        glowMerge.append('feMergeNode').attr('in', 'coloredBlur');
        glowMerge.append('feMergeNode').attr('in', 'SourceGraphic');

        // Sombra debajo del radar (la "plataforma")
        const platShadow = defs.append('filter')
            .attr('id', 'platformShadow').attr('x', '-10%').attr('y', '-10%')
            .attr('width', '120%').attr('height', '120%');
        platShadow.append('feGaussianBlur').attr('stdDeviation', 10);
    }

    // -----------------------------------------------------------------
    // Elipse base (la "plataforma" del radar con sombra)
    // -----------------------------------------------------------------
    _crearBaseEllipse() {
        // Sombra debajo
        this.svg.append('ellipse')
            .attr('cx', this.cx)
            .attr('cy', this.cy + this.ry * 0.18)
            .attr('rx', this.rx * 1.02)
            .attr('ry', this.ry * 0.15)
            .attr('fill', '#1f2937')
            .attr('opacity', 0.18)
            .attr('filter', 'url(#platformShadow)');

        // Elipse principal (el fondo)
        this.svg.append('ellipse')
            .attr('cx', this.cx)
            .attr('cy', this.cy)
            .attr('rx', this.rx)
            .attr('ry', this.ry)
            .attr('fill', 'url(#radarBgGradient)')
            .attr('stroke', '#cbd5e1')
            .attr('stroke-width', 1);
    }

    // -----------------------------------------------------------------
    // Anillos concéntricos (elipses) que representan los niveles
    // -----------------------------------------------------------------
    _crearAnillos() {
        for (let i = 1; i <= this.opts.levels; i++) {
            const fraction = i / this.opts.levels;
            this.svg.append('ellipse')
                .attr('cx', this.cx)
                .attr('cy', this.cy)
                .attr('rx', this.rx * fraction)
                .attr('ry', this.ry * fraction)
                .attr('fill', 'none')
                .attr('stroke', '#94a3b8')
                .attr('stroke-width', i === this.opts.levels ? 1.2 : 0.5)
                .attr('stroke-opacity', 0.4)
                .attr('stroke-dasharray', i === this.opts.levels ? 'none' : '2 3');

            // Etiqueta del nivel (solo en el primer anillo y el de afuera)
            if (i === 1 || i === this.opts.levels) {
                this.svg.append('text')
                    .attr('x', this.cx + 4)
                    .attr('y', this.cy - this.ry * fraction + 4)
                    .attr('font-size', 9)
                    .attr('fill', '#94a3b8')
                    .text(`${Math.round(fraction * 100)}%`);
            }
        }
    }

    // -----------------------------------------------------------------
    // Ejes (radios desde el centro hasta cada vértice)
    // -----------------------------------------------------------------
    _crearEjes() {
        for (let i = 0; i < this.numAxes; i++) {
            const angle = (Math.PI * 2 * i) / this.numAxes - Math.PI / 2;
            const x = this.cx + Math.cos(angle) * this.rx;
            const y = this.cy + Math.sin(angle) * this.ry;
            this.svg.append('line')
                .attr('x1', this.cx).attr('y1', this.cy)
                .attr('x2', x).attr('y2', y)
                .attr('stroke', '#94a3b8')
                .attr('stroke-width', 0.7)
                .attr('stroke-opacity', 0.5);
        }
    }

    // -----------------------------------------------------------------
    // Labels en los vértices (nombres de las variables)
    // -----------------------------------------------------------------
    _crearLabels() {
        const labelRadius = 1.18;
        for (let i = 0; i < this.numAxes; i++) {
            const angle = (Math.PI * 2 * i) / this.numAxes - Math.PI / 2;
            const x = this.cx + Math.cos(angle) * this.rx * labelRadius;
            const y = this.cy + Math.sin(angle) * this.ry * labelRadius;

            // Fondo del label (efecto "pill")
            const txt = this.features[i];
            const txtWidth = txt.length * 7 + 12;
            this.svg.append('rect')
                .attr('x', x - txtWidth / 2)
                .attr('y', y - 12)
                .attr('width', txtWidth)
                .attr('height', 20)
                .attr('rx', 10)
                .attr('fill', '#1e293b')
                .attr('opacity', 0.92)
                .attr('filter', 'url(#shadow)');

            this.svg.append('text')
                .attr('x', x).attr('y', y + 3)
                .attr('text-anchor', 'middle')
                .attr('fill', 'white')
                .attr('font-weight', 'bold')
                .attr('font-size', 11)
                .text(txt);
        }
    }

    // -----------------------------------------------------------------
    // Calcular coordenadas (x, y) para un conjunto de valores normalizados
    // -----------------------------------------------------------------
    _coordenadas(valoresNormalizados) {
        return valoresNormalizados.map((v, i) => {
            const angle = (Math.PI * 2 * i) / this.numAxes - Math.PI / 2;
            const fraction = v / this.opts.maxValue;
            return {
                x: this.cx + Math.cos(angle) * this.rx * fraction,
                y: this.cy + Math.sin(angle) * this.ry * fraction
            };
        });
    }

    _pointsToString(points) {
        return points.map(p => `${p.x},${p.y}`).join(' ');
    }

    // -----------------------------------------------------------------
    // Establecer el conjunto de datasets (3 perfiles)
    // datasets = [{ label, data, color, gradient, esPrincipal }]
    // -----------------------------------------------------------------
    setDatasets(datasets) {
        this.datasets = datasets;

        // Eliminar contenido viejo
        this.polygonsGroup.selectAll('*').remove();
        this.pointsGroup.selectAll('*').remove();

        // Dibujar perfiles secundarios primero (atrás)
        datasets
            .filter(d => !d.esPrincipal)
            .forEach(ds => this._dibujarDataset(ds, false));

        // Dibujar perfil principal al frente
        datasets
            .filter(d => d.esPrincipal)
            .forEach(ds => this._dibujarDataset(ds, true));
    }

    _dibujarDataset(ds, esPrincipal) {
        const points = this._coordenadas(ds.data);

        // Polígono
        const poly = this.polygonsGroup.append('polygon')
            .attr('points', this._pointsToString(points))
            .attr('fill', `url(#${ds.gradient})`)
            .attr('stroke', ds.color)
            .attr('stroke-width', esPrincipal ? 2.5 : 1.5)
            .attr('stroke-dasharray', esPrincipal ? 'none' : '4 3')
            .attr('opacity', esPrincipal ? 1 : 0.85)
            .attr('filter', esPrincipal ? 'url(#shadow)' : null)
            .attr('class', `poly-${ds.id}`);

        // Puntos en los vértices (solo el principal)
        if (esPrincipal) {
            points.forEach((p, i) => {
                this.pointsGroup.append('circle')
                    .attr('cx', p.x).attr('cy', p.y)
                    .attr('r', 5)
                    .attr('fill', ds.color)
                    .attr('stroke', 'white')
                    .attr('stroke-width', 2)
                    .attr('filter', 'url(#glow)')
                    .attr('class', `point-${ds.id} point-i-${i}`);

                // Tooltip al pasar el mouse
                const tip = this.svg.append('g')
                    .attr('class', 'tooltip-' + i)
                    .style('opacity', 0)
                    .style('pointer-events', 'none');
                tip.append('rect')
                    .attr('rx', 6).attr('fill', '#1e293b')
                    .attr('width', 110).attr('height', 36)
                    .attr('x', p.x - 55).attr('y', p.y - 50);
                tip.append('text')
                    .attr('x', p.x).attr('y', p.y - 32)
                    .attr('text-anchor', 'middle')
                    .attr('fill', 'white').attr('font-weight', 'bold')
                    .attr('font-size', 11)
                    .text(this.features[i]);
                tip.append('text')
                    .attr('x', p.x).attr('y', p.y - 18)
                    .attr('text-anchor', 'middle')
                    .attr('fill', '#cbd5e1').attr('font-size', 10)
                    .text(`${ds.data[i].toFixed(1)}%`);
            });
        }
    }

    // -----------------------------------------------------------------
    // Actualizar el polígono principal con animación suave
    // -----------------------------------------------------------------
    actualizarPrincipal(valoresNormalizados) {
        const principal = this.datasets.find(d => d.esPrincipal);
        if (!principal) return;

        principal.data = valoresNormalizados;
        const points = this._coordenadas(valoresNormalizados);

        this.polygonsGroup.select(`.poly-${principal.id}`)
            .transition()
            .duration(this.opts.transitionMs)
            .ease(d3.easeCubicOut)
            .attr('points', this._pointsToString(points));

        // Actualizar también los puntos
        this.pointsGroup.selectAll(`.point-${principal.id}`)
            .each(function(_, i) {
                const p = points[i];
                d3.select(this)
                    .transition()
                    .duration(600)
                    .ease(d3.easeCubicOut)
                    .attr('cx', p.x).attr('cy', p.y);
            });
    }
}

// Exportar para uso global
window.Radar3D = Radar3D;
