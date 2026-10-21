const URL_API = "https://apidemo.geoeducacion.com.ar/api/testing/pearson/1";

const contenedor = document.getElementById("contenedor");
const resumen = document.getElementById("resumen");
const estado = document.getElementById("estado");

// nombre y unidad de cada variable
const VARIABLES = {
  presion: { nombre: "Presión", unidad: "hPa" },
  temperatura: { nombre: "Temperatura", unidad: "°C" },
  humedad: { nombre: "Humedad", unidad: "%" },
  viento: { nombre: "Velocidad del viento", unidad: "km/h" }
};

// los 6 pares que pide la consigna
const PARES = [
  ["presion", "temperatura"],
  ["presion", "humedad"],
  ["presion", "viento"],
  ["temperatura", "humedad"],
  ["temperatura", "viento"],
  ["humedad", "viento"]
];

// trae las mediciones de la API
async function obtenerValores() {
  const respuesta = await fetch(URL_API);
  if (!respuesta.ok) {
    throw new Error("error HTTP " + respuesta.status);
  }
  const json = await respuesta.json();
  if (!json.success) {
    throw new Error(json.messages || "la API respondió success: false");
  }
  return json.data[0].valores;
}

// promedio de un array de números
function promedio(numeros) {
  return numeros.reduce((suma, n) => suma + n, 0) / numeros.length;
}

// coeficiente de Pearson entre dos arrays
function pearson(x, y) {
  const mx = promedio(x);
  const my = promedio(y);
  let covarianza = 0;
  let sumaX = 0;
  let sumaY = 0;

  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    covarianza += dx * dy;
    sumaX += dx * dx;
    sumaY += dy * dy;
  }
  return covarianza / Math.sqrt(sumaX * sumaY);
}

// dos puntos de la recta de mínimos cuadrados, para dibujar la tendencia
function rectaTendencia(x, y) {
  const mx = promedio(x);
  const my = promedio(y);
  let arriba = 0;
  let abajo = 0;

  for (let i = 0; i < x.length; i++) {
    arriba += (x[i] - mx) * (y[i] - my);
    abajo += (x[i] - mx) ** 2;
  }
  const pendiente = arriba / abajo;
  const ordenada = my - pendiente * mx;
  const xMin = Math.min(...x);
  const xMax = Math.max(...x);

  return [
    { x: xMin, y: pendiente * xMin + ordenada },
    { x: xMax, y: pendiente * xMax + ordenada }
  ];
}

// clasifica la fuerza de la correlación según el valor absoluto de r
function fuerza(r) {
  const valor = Math.abs(r);
  if (valor < 0.4) return "débil";
  if (valor < 0.6) return "moderada";
  if (valor < 0.8) return "fuerte";
  return "muy fuerte";
}

// arma el texto que va debajo de cada gráfico
function describir(r, a, b) {
  const nombreA = VARIABLES[a].nombre.toLowerCase();
  const nombreB = VARIABLES[b].nombre.toLowerCase();

  if (Math.abs(r) < 0.2) {
    return `Con r = ${r.toFixed(3)} no hay una relación lineal clara entre ${nombreA} y ${nombreB}.`;
  }
  const sentido = r > 0 ? "positiva" : "negativa";
  const tendencia = r > 0 ? "aumentar" : "disminuir";
  return `Correlación ${sentido} ${fuerza(r)}: cuando ${nombreA} aumenta, ${nombreB} tiende a ${tendencia}.`;
}

// dibuja la dispersión con la recta de tendencia arriba
function dibujarGrafico(canvas, x, y, a, b) {
  const puntos = x.map((valor, i) => ({ x: valor, y: y[i] }));

  new Chart(canvas, {
    type: "scatter",
    data: {
      datasets: [
        { data: puntos, backgroundColor: "#1f6f8b", pointRadius: 5 },
        {
          type: "line",
          data: rectaTendencia(x, y),
          borderColor: "#8aa0ad",
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0
        }
      ]
    },
    options: {
      aspectRatio: 1.4,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: `${VARIABLES[a].nombre} (${VARIABLES[a].unidad})` } },
        y: { title: { display: true, text: `${VARIABLES[b].nombre} (${VARIABLES[b].unidad})` } }
      }
    }
  });
}

// crea la card de un par y la agrega a la página
function crearCard({ a, b, r, x, y }, esMayor) {
  const card = document.createElement("article");
  card.className = esMayor ? "card mayor" : "card";

  const signo = r > 0.2 ? "positiva" : r < -0.2 ? "negativa" : "neutra";
  const etiqueta = esMayor ? `<p class="etiqueta">Mayor correlación del conjunto</p>` : "";

  card.innerHTML = `
    <header>
      <h2>${VARIABLES[a].nombre} y ${VARIABLES[b].nombre}</h2>
      <span class="valor-r ${signo}">r = ${r.toFixed(3)}</span>
    </header>
    ${etiqueta}
    <canvas></canvas>
    <p>${describir(r, a, b)}</p>
  `;

  contenedor.appendChild(card);
  dibujarGrafico(card.querySelector("canvas"), x, y, a, b);
}

// muestra qué par correlaciona más y qué puede significar
function mostrarResumen(mayor) {
  const nombreA = VARIABLES[mayor.a].nombre.toLowerCase();
  const nombreB = VARIABLES[mayor.b].nombre.toLowerCase();
  const sentido = mayor.r > 0 ? "positiva" : "negativa";
  const lectura = mayor.r > 0
    ? "las dos variables tienden a subir y bajar juntas"
    : "cuando una sube, la otra tiende a bajar";

  resumen.innerHTML = `
    <h2>Par con mayor correlación</h2>
    <p><strong>${nombreA} y ${nombreB}</strong>, con r = ${mayor.r.toFixed(3)} (correlación ${sentido} ${fuerza(mayor.r)}).</p>
    <p>Esto indica que ${lectura}. Es una relación lineal entre los datos, pero no prueba que una variable cause a la otra: pueden influir otros factores, y con solo 10 mediciones el resultado es orientativo.</p>
  `;
}

// pide los datos, calcula todos los pares y arma la página
async function iniciar() {
  try {
    const valores = await obtenerValores();

    const resultados = PARES.map(([a, b]) => {
      const x = valores.map(v => v[a]);
      const y = valores.map(v => v[b]);
      return { a, b, x, y, r: pearson(x, y) };
    });

    const mayor = resultados.reduce((max, actual) =>
      Math.abs(actual.r) > Math.abs(max.r) ? actual : max
    );

    estado.remove();
    mostrarResumen(mayor);
    resultados.forEach(res => crearCard(res, res === mayor));
  } catch (error) {
    estado.textContent = "No se pudieron cargar los datos: " + error.message;
    estado.classList.add("error");
  }
}

iniciar();
