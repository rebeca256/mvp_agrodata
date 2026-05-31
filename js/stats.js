// =====================================================================
// AgroDataLocal — Estadísticas descriptivas y prueba t en JavaScript
// =====================================================================

function calcularMedia(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function calcularMediana(arr) {
    const ordenado = [...arr].sort((a, b) => a - b);
    const mitad = Math.floor(ordenado.length / 2);
    if (ordenado.length % 2 === 0) {
        return (ordenado[mitad - 1] + ordenado[mitad]) / 2;
    }
    return ordenado[mitad];
}

function calcularModa(arr) {
    // Para datos continuos, redondeamos a 2 decimales para encontrar la moda
    const conteos = {};
    arr.forEach(v => {
        const key = Math.round(v * 100) / 100;
        conteos[key] = (conteos[key] || 0) + 1;
    });
    let modaValor = arr[0];
    let modaFrecuencia = 0;
    Object.entries(conteos).forEach(([valor, frecuencia]) => {
        if (frecuencia > modaFrecuencia) {
            modaFrecuencia = frecuencia;
            modaValor = parseFloat(valor);
        }
    });
    return modaValor;
}

function calcularVarianza(arr) {
    const m = calcularMedia(arr);
    const sumaCuadrados = arr.reduce((a, b) => a + (b - m) ** 2, 0);
    return sumaCuadrados / (arr.length - 1);
}

function calcularDesvEstandar(arr) {
    return Math.sqrt(calcularVarianza(arr));
}

function calcularMin(arr) {
    return Math.min(...arr);
}

function calcularMax(arr) {
    return Math.max(...arr);
}

// =====================================================================
// Calcular todas las estadísticas para cada variable
// =====================================================================
function calcularEstadisticasCompletas(datos, features) {
    const resultado = {};
    features.forEach(feature => {
        const valores = datos.map(d => d[feature]);
        resultado[feature] = {
            media: calcularMedia(valores),
            mediana: calcularMediana(valores),
            moda: calcularModa(valores),
            varianza: calcularVarianza(valores),
            std: calcularDesvEstandar(valores),
            min: calcularMin(valores),
            max: calcularMax(valores)
        };
    });
    return resultado;
}

// =====================================================================
// Correlación de Pearson entre dos arrays
// =====================================================================
function correlacionPearson(x, y) {
    const n = x.length;
    const mx = calcularMedia(x);
    const my = calcularMedia(y);
    let numerador = 0;
    let sumXSq = 0;
    let sumYSq = 0;
    for (let i = 0; i < n; i++) {
        const dx = x[i] - mx;
        const dy = y[i] - my;
        numerador += dx * dy;
        sumXSq += dx * dx;
        sumYSq += dy * dy;
    }
    return numerador / Math.sqrt(sumXSq * sumYSq);
}

// =====================================================================
// Calcular correlación de cada variable con la fertilidad
// =====================================================================
function calcularCorrelaciones(datos, features) {
    const yArr = datos.map(d => d.Output);
    const correlaciones = {};
    features.forEach(feature => {
        const xArr = datos.map(d => d[feature]);
        correlaciones[feature] = correlacionPearson(xArr, yArr);
    });
    return correlaciones;
}

// =====================================================================
// Distribución de clases
// =====================================================================
function distribucionClases(datos) {
    const conteo = [0, 0, 0];
    datos.forEach(d => conteo[d.Output]++);
    return {
        conteo: conteo,
        porcentajes: conteo.map(c => (c / datos.length) * 100),
        total: datos.length
    };
}
