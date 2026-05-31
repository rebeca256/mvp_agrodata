# AgroDataLocal — Aplicación Web

Versión web del proyecto **AgroDataLocal**, un sistema de diagnóstico de fertilidad de suelo
para pequeños productores agrícolas mexicanos, desarrollado con HTML, CSS y JavaScript puro.

> **Ver la aplicación en vivo:** [https://rebeca256.github.io/mvp_agrodata/](https://rebeca256.github.io/mvp_agrodata/)

## Sobre el proyecto

AgroDataLocal clasifica la fertilidad del suelo de parcelas agrícolas en tres niveles
(Baja, Media, Alta) a partir de 12 variables fisicoquímicas, utilizando el algoritmo
**K-Nearest Neighbors (KNN)** con `k = 5` y distancia euclidiana.

| Característica | Valor |
|----------------|-------|
| Dataset | 880 muestras de suelo mexicano |
| Variables | 12 (N, P, K, pH, EC, OC, S, Zn, Fe, Cu, Mn, B) |
| Clases | 3 (Baja / Media / Alta fertilidad) |
| Exactitud del modelo | 82.39 % |
| Intervalo de confianza al 95 % | [76.1 %, 87.3 %] |

## Funcionalidades de la web

- **Análisis estadístico descriptivo** calculado en vivo en el navegador: media, mediana, moda,
  varianza, desviación estándar, mínimo y máximo de cada variable.
- **Gráficas interactivas** generadas con Chart.js: distribución de clases y correlaciones.
- **Simulador interactivo** con 12 sliders para los parámetros del suelo. La predicción del
  modelo y la gráfica radar se actualizan en vivo al mover cualquier slider.
- **Botones de preset** para cargar valores promedio de cada nivel de fertilidad.
- **Galería de visualizaciones** con las 8 figuras del análisis (distribución, correlación,
  prueba t, regla de Cramer, cálculo diferencial, matriz de confusión, intervalo de confianza).
- **Diseño responsive** que funciona en desktop, tablet y móvil.

## Estructura de archivos

```
mvp_agrodata/
├── index.html              ← Página principal
├── css/style.css           ← Estilos
├── js/
│   ├── data.js             ← Dataset embebido (880 muestras × 13 variables)
│   ├── stats.js            ← Cálculos estadísticos
│   ├── knn.js              ← Algoritmo KNN
│   └── app.js              ← Lógica de la interfaz
├── img/                    ← Visualizaciones pre-generadas
├── data/dataset1.csv       ← Dataset en CSV original
├── .nojekyll               ← Para GitHub Pages
└── README.md               ← Este archivo
```

## Cómo correrla localmente

No hay build ni dependencias por instalar. Basta con servir los archivos:

```bash
# Opción 1: con Python (viene con macOS)
cd mvp_agrodata
python3 -m http.server 8000
# Abre http://localhost:8000 en tu navegador

# Opción 2: abrir directamente el index.html en el navegador
# (algunas funciones pueden requerir servir desde un servidor por CORS)
```

## Metodología matemática aplicada

| Concepto | Implementación |
|----------|----------------|
| Estadística descriptiva | Media, mediana, moda, varianza, desviación estándar |
| Estadística inferencial | Prueba t de dos medias, intervalo de confianza al 95 % |
| Álgebra lineal | Distancia euclidiana entre vectores, regla de Cramer |
| Cálculo diferencial | Optimización de la dosis de fertilización (N* = 100 kg/ha) |

## Tecnologías utilizadas

- **HTML5 + CSS3** — estructura y estilos
- **JavaScript vanilla** — lógica y algoritmo KNN, sin frameworks
- **Chart.js** — visualizaciones interactivas (cargado desde CDN)
- **GitHub Pages** — despliegue gratuito

## Autoría

**Proyecto Integrador del Semestre 2**
Licenciatura en Ciencias de Datos para Negocios
Universidad Nacional Rosario Castellanos (UNRC)
Mayo 2026
