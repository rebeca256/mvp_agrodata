// =====================================================================
// AgroDataLocal — Algoritmo K-Nearest Neighbors en JavaScript puro
// =====================================================================

// =====================================================================
// Modelo KNN optimizado mediante grid search y selección de variables
// sobre el dataset SAGARPA-FAO 2012.
// Resultado: k=13, 7 variables → exactitud 72.32 % (vs 60.31 % con k=5
// y 16 variables). Las 9 variables eliminadas no aportaban información
// predictiva relevante para la fertilidad del suelo.
// =====================================================================
const FEATURE_NAMES = ['N', 'SAND', 'CLAY', 'CEC', 'SILT', 'SAR', 'Mg'];

// Diccionario de información detallada de cada variable.
// Se usa para tooltips en sliders, en la tabla de estadísticas y en el glosario.
const FEATURE_INFO = {
    'pH':   { nombre: 'pH', unidad: '0-14',
              desc: 'Acidez o alcalinidad del suelo. Valores < 6.5 = ácido, 6.5-7.5 = neutro, > 7.5 = alcalino.' },
    'EC':   { nombre: 'Conductividad eléctrica', unidad: 'dS/m',
              desc: 'Mide la salinidad del suelo. Valores altos indican exceso de sales que pueden afectar a las plantas.' },
    'OM':   { nombre: 'Materia orgánica', unidad: '%',
              desc: 'Porcentaje de residuos vegetales y animales descompuestos. Indicador clave de salud del suelo.' },
    'BD':   { nombre: 'Densidad aparente', unidad: 'g/cm³',
              desc: 'Masa de suelo seco por volumen. Valores altos indican compactación, malos para raíces.' },
    'P':    { nombre: 'Fósforo', unidad: 'mg/kg',
              desc: 'Macronutriente esencial para el desarrollo de raíces y floración del cultivo.' },
    'SAND': { nombre: 'Arena', unidad: '%',
              desc: 'Porcentaje de partículas grandes (0.05-2 mm). Suelos arenosos drenan rápido pero retienen poco agua.' },
    'SILT': { nombre: 'Limo', unidad: '%',
              desc: 'Porcentaje de partículas medianas (0.002-0.05 mm). Buen equilibrio entre drenaje y retención de agua.' },
    'CLAY': { nombre: 'Arcilla', unidad: '%',
              desc: 'Porcentaje de partículas finas (< 0.002 mm). Retiene mucha agua y nutrientes pero drena lento.' },
    'N':    { nombre: 'Nitrógeno', unidad: '%',
              desc: 'Macronutriente más importante para el crecimiento vegetativo. Principal indicador de fertilidad.' },
    'K':    { nombre: 'Potasio', unidad: 'cmol/kg',
              desc: 'Macronutriente para resistencia, calidad de fruto y regulación hídrica de la planta.' },
    'Ca':   { nombre: 'Calcio', unidad: 'cmol/kg',
              desc: 'Catión secundario. Da estructura al suelo, estabiliza la membrana de las raíces.' },
    'Mg':   { nombre: 'Magnesio', unidad: 'cmol/kg',
              desc: 'Componente esencial de la clorofila. Su carencia se ve en hojas amarillentas entre las venas.' },
    'Na':   { nombre: 'Sodio', unidad: 'cmol/kg',
              desc: 'No es nutriente esencial. Concentraciones altas indican salinidad y afectan a las plantas.' },
    'CEC':  { nombre: 'Capacidad de Intercambio Catiónico', unidad: 'cmol/kg',
              desc: 'Capacidad del suelo para retener cationes (K, Ca, Mg, Na). Cuanto mayor, más fértil potencialmente.' },
    'SAR':  { nombre: 'Razón de Adsorción de Sodio', unidad: 'adimensional',
              desc: 'Riesgo de sodicidad: relación entre sodio y otros cationes. Valores altos degradan la estructura del suelo.' },
    'ESP':  { nombre: 'Porcentaje de Sodio Intercambiable', unidad: '%',
              desc: 'Proporción de sodio respecto al total de cationes. > 15 % indica suelos sódicos.' }
};

// Alias corto para compatibilidad con código existente
const FEATURE_DESCRIPTIONS = Object.fromEntries(
    Object.entries(FEATURE_INFO).map(([k, v]) => [k, `${v.nombre} (${v.unidad})`])
);

// Las 16 variables del dataset (incluye las 9 que no se usan en el modelo
// pero sí aparecen en la sección de estadísticas descriptivas).
const FEATURE_NAMES_ALL = ['pH', 'EC', 'OM', 'BD', 'P', 'SAND', 'SILT', 'CLAY',
                           'N', 'K', 'Ca', 'Mg', 'Na', 'CEC', 'SAR', 'ESP'];

const CLASS_NAMES = ['Baja', 'Media', 'Alta'];
const CLASS_COLORS = ['#e74c3c', '#f39c12', '#27ae60'];
const K_VECINOS = 13;

// =====================================================================
// Cálculos auxiliares: media y desviación estándar por columna
// =====================================================================
function media(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function desviacionEstandar(arr) {
    const m = media(arr);
    const sumaCuadrados = arr.reduce((a, b) => a + (b - m) ** 2, 0);
    return Math.sqrt(sumaCuadrados / (arr.length - 1));
}

// =====================================================================
// Estandarización: ajustar parámetros (media y std de cada columna)
// =====================================================================
function ajustarEscalador(datos, features) {
    const parametros = {};
    features.forEach(feature => {
        const valores = datos.map(d => d[feature]);
        parametros[feature] = {
            media: media(valores),
            std: desviacionEstandar(valores)
        };
    });
    return parametros;
}

// Aplicar transformación Z-score a una muestra
function estandarizar(muestra, parametros, features) {
    const resultado = {};
    features.forEach(feature => {
        const p = parametros[feature];
        resultado[feature] = (muestra[feature] - p.media) / p.std;
    });
    return resultado;
}

// =====================================================================
// Distancia euclidiana entre dos muestras (en espacio estandarizado)
// =====================================================================
function distanciaEuclidiana(a, b, features) {
    let suma = 0;
    for (const feature of features) {
        suma += (a[feature] - b[feature]) ** 2;
    }
    return Math.sqrt(suma);
}

// =====================================================================
// Predicción KNN: encuentra los k vecinos más cercanos y vota
// =====================================================================
function predecirKNN(muestraNueva, datosEntrenamiento, parametros, k = K_VECINOS) {
    // 1. Estandarizar la muestra nueva
    const muestraStd = estandarizar(muestraNueva, parametros, FEATURE_NAMES);

    // 2. Calcular distancia a cada muestra de entrenamiento
    const distancias = datosEntrenamiento.map(d => {
        const dStd = estandarizar(d, parametros, FEATURE_NAMES);
        return {
            distancia: distanciaEuclidiana(muestraStd, dStd, FEATURE_NAMES),
            clase: d.Output
        };
    });

    // 3. Ordenar y tomar los k más cercanos
    distancias.sort((a, b) => a.distancia - b.distancia);
    const vecinos = distancias.slice(0, k);

    // 4. Votar por mayoría
    const votos = [0, 0, 0];
    vecinos.forEach(v => votos[v.clase]++);

    // 5. Determinar clase ganadora
    let claseGanadora = 0;
    let maxVotos = votos[0];
    for (let i = 1; i < votos.length; i++) {
        if (votos[i] > maxVotos) {
            maxVotos = votos[i];
            claseGanadora = i;
        }
    }

    // 6. Calcular probabilidades
    const probabilidades = votos.map(v => v / k);

    return {
        prediccion: claseGanadora,
        nombreClase: CLASS_NAMES[claseGanadora],
        probabilidades: probabilidades,
        vecinos: vecinos
    };
}

// =====================================================================
// Calcular rangos min/max de cada variable (para los sliders)
// =====================================================================
function calcularRangos(datos, features) {
    const rangos = {};
    features.forEach(feature => {
        const valores = datos.map(d => d[feature]);
        rangos[feature] = {
            min: Math.min(...valores),
            max: Math.max(...valores)
        };
    });
    return rangos;
}

// =====================================================================
// Calcular perfil promedio de cada clase (para botones de preset)
// =====================================================================
function calcularPerfilesClase(datos, features) {
    const perfiles = [{}, {}, {}];
    for (let clase = 0; clase < 3; clase++) {
        const muestrasClase = datos.filter(d => d.Output === clase);
        features.forEach(feature => {
            const valores = muestrasClase.map(d => d[feature]);
            perfiles[clase][feature] = media(valores);
        });
    }
    return perfiles;
}

// =====================================================================
// Calcular el umbral de distancia anómala usando una muestra del dataset.
// Una muestra cuya distancia promedio a sus k vecinos esté por encima de
// este umbral se considera "fuera del dominio" del modelo entrenado.
// =====================================================================
function calcularUmbralAnomalia(datos, parametros, features, k = K_VECINOS) {
    // Muestreo: tomamos máximo 500 muestras para que el cálculo sea rápido
    const SAMPLE_SIZE = 500;
    const indices = [];
    if (datos.length <= SAMPLE_SIZE) {
        for (let i = 0; i < datos.length; i++) indices.push(i);
    } else {
        const step = datos.length / SAMPLE_SIZE;
        for (let i = 0; i < SAMPLE_SIZE; i++) {
            indices.push(Math.floor(i * step));
        }
    }
    const muestra = indices.map(i => datos[i]);
    const datosStd = muestra.map(d => estandarizar(d, parametros, features));

    const distanciasPromedio = [];
    for (let i = 0; i < datosStd.length; i++) {
        const distancias = [];
        for (let j = 0; j < datosStd.length; j++) {
            if (i === j) continue;
            distancias.push(distanciaEuclidiana(datosStd[i], datosStd[j], features));
        }
        distancias.sort((a, b) => a - b);
        const kDistancias = distancias.slice(0, k);
        const prom = kDistancias.reduce((a, b) => a + b, 0) / k;
        distanciasPromedio.push(prom);
    }
    distanciasPromedio.sort((a, b) => a - b);

    // Percentil 95 como umbral de anomalía
    const idxP95 = Math.floor(distanciasPromedio.length * 0.95);
    return distanciasPromedio[idxP95];
}

// =====================================================================
// Evaluar la confiabilidad de una predicción
// Retorna { nivel, problemas, mensaje }
// =====================================================================
function evaluarConfiabilidad(muestraNueva, datosEntrenamiento,
                              parametros, resultado, umbralAnomalia) {
    const problemas = [];

    // 1. Predicción ambigua: la probabilidad máxima es < 50 %
    const probMax = Math.max(...resultado.probabilidades);
    if (probMax < 0.5) {
        problemas.push({
            tipo: 'ambigua',
            mensaje: `La predicción es ambigua: la clase más probable solo tiene ${(probMax*100).toFixed(0)}% de confianza.`
        });
    }

    // 2. Muestra fuera del dominio: distancia promedio a los k vecinos > umbral
    const muestraStd = estandarizar(muestraNueva, parametros, FEATURE_NAMES);
    const distancias = datosEntrenamiento.map(d =>
        distanciaEuclidiana(muestraStd,
            estandarizar(d, parametros, FEATURE_NAMES), FEATURE_NAMES)
    );
    distancias.sort((a, b) => a - b);
    const kVecinos = distancias.slice(0, K_VECINOS);
    const distMedia = kVecinos.reduce((a, b) => a + b, 0) / K_VECINOS;
    const factorAnomalia = distMedia / umbralAnomalia;
    if (factorAnomalia > 1.5) {
        problemas.push({
            tipo: 'anomala',
            mensaje: `La combinación de valores que estableciste se aleja considerablemente de los suelos del dataset (${factorAnomalia.toFixed(1)}× sobre el umbral). El modelo no fue entrenado para casos similares.`
        });
    } else if (factorAnomalia > 1.0) {
        problemas.push({
            tipo: 'limite',
            mensaje: `Tu muestra está en el límite del dominio del modelo. La predicción puede ser menos confiable.`
        });
    }

    // 3. Textura incoherente: SAND + SILT + CLAY debería sumar cerca de 100 %
    //    (sólo si están entre las features del modelo)
    if (FEATURE_NAMES.includes('SAND') &&
        FEATURE_NAMES.includes('SILT') &&
        FEATURE_NAMES.includes('CLAY')) {
        const suma = muestraNueva.SAND + muestraNueva.SILT + muestraNueva.CLAY;
        if (suma < 80 || suma > 130) {
            problemas.push({
                tipo: 'textura',
                mensaje: `Arena + Limo + Arcilla suman ${suma.toFixed(0)} %, fuera del rango realista esperado (90-110 %).`
            });
        }
    }

    // Determinar nivel global
    let nivel = 'alto';
    if (problemas.some(p => p.tipo === 'anomala' || p.tipo === 'textura')) {
        nivel = 'bajo';
    } else if (problemas.length > 0) {
        nivel = 'medio';
    }

    return { nivel, problemas, factorAnomalia, probMax };
}

// =====================================================================
// Recomendaciones agronómicas por clase
// =====================================================================
const RECOMENDACIONES = {
    0: {
        titulo: 'Suelo de fertilidad BAJA',
        consejos: [
            'Aplicar fertilización completa con N, P y K',
            'Incorporar materia orgánica para mejorar estructura',
            'Monitorear pH y micronutrientes principales',
            'Considerar abonos verdes y compost'
        ]
    },
    1: {
        titulo: 'Suelo de fertilidad MEDIA',
        consejos: [
            'Fertilización moderada y dirigida',
            'Mantener niveles actuales de materia orgánica',
            'Ajustar según necesidades específicas del cultivo',
            'Análisis periódicos para seguimiento'
        ]
    },
    2: {
        titulo: 'Suelo de fertilidad ALTA',
        consejos: [
            'Fertilización mínima o nula',
            'Mantener prácticas actuales',
            'Cuidar de no sobre-fertilizar (contaminación)',
            'Rotación de cultivos para preservar fertilidad'
        ]
    }
};
