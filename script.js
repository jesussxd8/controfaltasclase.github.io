import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyCw-vPulec3ToBUzSV3N_7M4t4tGyzgAgM",
  authDomain: "controlfaltasclase.firebaseapp.com",
  projectId: "controlfaltasclase",
  storageBucket: "controlfaltasclase.firebasestorage.app",
  messagingSenderId: "874486434099",
  appId: "1:874486434099:web:778b916b3a17ad1b349646",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- VARIABLES ---
let horario = {}; // cargado por usuario
let maxFaltas = {}; // personalizado por usuario
let faltas = {};
let currentUser = null;
let chart;

// --- ELEMENTOS DOM ---
const loader = document.getElementById("loader");
const loginSection = document.getElementById("loginSection");
const appSection = document.getElementById("appSection");
const horarioSection = document.getElementById("horarioSection");
const horarioForm = document.getElementById("horarioForm");

const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const btnEditarHorario = document.getElementById("btnEditarHorario");
const btnGuardarHorario = document.getElementById("btnGuardarHorario");
const btnVolverApp = document.getElementById("btnVolverApp");

const fechaFalta = document.getElementById("fechaFalta");
const asignaturasDelDia = document.getElementById("asignaturasDelDia");
const tablaResumen = document.getElementById("tablaResumen");
const btnRegistrar = document.getElementById("btnRegistrar");
const btnReiniciar = document.getElementById("btnReiniciar");
const btnExportar = document.getElementById("btnExportar");
const btnExportarPDF = document.getElementById("btnExportarPDF");
const btnExportarCSV = document.getElementById("btnExportarCSV");
const inputImportJson = document.getElementById("inputImportJson");
const inputImportTxt = document.getElementById("inputImportTxt");
const toast = document.getElementById("toast");
const toggleTheme = document.getElementById("toggleTheme");
const tipoGrafico = document.getElementById("tipoGrafico");

// --- FUNCIONES UI ---
function showToast(msg, color = "#0d6efd") {
  toast.textContent = msg;
  toast.style.background = color;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 3000);
}

function showLoader(show) {
  loader.style.display = show ? "flex" : "none";
}

function toggleDarkMode() {
  const current = document.body.getAttribute("data-theme");
  const newTheme = current === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  toggleTheme.textContent = newTheme === "dark" ? "☀️" : "🌙";
}

// --- AUTH ---
btnLogin.onclick = async () => {
  try {
    showLoader(true);
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error("Error al iniciar sesión:", e);
    showToast("Error al iniciar sesión", "red");
  } finally {
    showLoader(false);
  }
};

btnLogout.onclick = async () => {
  await signOut(auth);
  mostrarLogin();
  showToast("Sesión cerrada");
};

// --- ESTADO DE SESIÓN ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    mostrarApp();
    await cargarDatosUsuario();
  } else {
    mostrarLogin();
  }
});

// --- SECCIONES ---
function mostrarLogin() {
  showLoader(false);
  loginSection.classList.remove("oculto");
  appSection.classList.add("oculto");
  horarioSection.classList.add("oculto");
  btnLogout.classList.add("oculto");
}

function mostrarApp() {
  loginSection.classList.add("oculto");
  appSection.classList.remove("oculto");
  horarioSection.classList.add("oculto");
  btnLogout.classList.remove("oculto");
  showLoader(false);
}

function mostrarHorarioEditor() {
  appSection.classList.add("oculto");
  horarioSection.classList.remove("oculto");
}

function volverApp() {
  horarioSection.classList.add("oculto");
  appSection.classList.remove("oculto");
}

// --- FIRESTORE ---
async function cargarDatosUsuario() {
  try {
    showLoader(true);
    const ref = doc(db, "usuarios", currentUser.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      horario = { Monday: {}, Tuesday: {}, Wednesday: {}, Thursday: {}, Friday: {} };
      maxFaltas = {};
      faltas = {};
      await setDoc(ref, { horario, maxFaltas, faltas });
      renderHorarioForm();
      mostrarHorarioEditor();
      return;
    }

    const data = snap.data();
    horario = data.horario || { Monday: {}, Tuesday: {}, Wednesday: {}, Thursday: {}, Friday: {} };
    maxFaltas = data.maxFaltas || {};
    faltas = data.faltas || {};

    if (Object.keys(horario).length === 0) {
      renderHorarioForm();
      mostrarHorarioEditor();
      return;
    }

    actualizarTabla();
    actualizarGrafico();
  } catch (err) {
    console.error("Error al cargar datos:", err);
    showToast("Error al cargar datos", "red");
  } finally {
    showLoader(false);
  }
}

async function guardarDatosUsuario() {
  try {
    const ref = doc(db, "usuarios", currentUser.uid);
    await setDoc(ref, { horario, maxFaltas, faltas }, { merge: true });
  } catch (err) {
    console.error("Error al guardar datos:", err);
  }
}

// --- HORARIO PERSONALIZADO ---
function renderHorarioForm() {
  const dias = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  if (!horario || Object.keys(horario).length === 0)
    horario = { Monday: {}, Tuesday: {}, Wednesday: {}, Thursday: {}, Friday: {} };
  horarioForm.innerHTML = "";

  dias.forEach(dia => {
    const clases = horario[dia] || {};
    const container = document.createElement("div");
    container.className = "horario-dia";
    container.innerHTML = `<h3>${dia}</h3>`;

    const wrapper = document.createElement("div");
    wrapper.className = "horario-dia-clases";

    if (Object.keys(clases).length === 0) {
      const emptyRow = crearFilaHorario();
      wrapper.appendChild(emptyRow);
    } else {
      Object.entries(clases).forEach(([materia, horas]) => {
        const fila = crearFilaHorario(materia, horas);
        wrapper.appendChild(fila);
      });
    }

    const btnAdd = document.createElement("button");
    btnAdd.className = "btn-accent";
    btnAdd.textContent = "➕ Añadir asignatura";
    btnAdd.onclick = () => wrapper.appendChild(crearFilaHorario());

    container.appendChild(wrapper);
    container.appendChild(btnAdd);
    horarioForm.appendChild(container);
  });

  // Bloque adicional: configuración de máximos
  const maxContainer = document.createElement("div");
  maxContainer.className = "horario-dia";
  maxContainer.innerHTML = `<h3>Máximos de faltas por asignatura</h3>`;
  const table = document.createElement("div");
  table.className = "horario-dia-clases";

  const todas = new Set();
  Object.values(horario).forEach(clases => {
    Object.keys(clases).forEach(m => todas.add(m));
  });
  if (todas.size === 0) todas.add("Ejemplo");

  todas.forEach(m => {
    const row = document.createElement("div");
    row.className = "fila-horario";
    row.innerHTML = `
      <input type="text" class="materia" value="${m}" placeholder="Asignatura" />
      <input type="number" class="max" value="${maxFaltas[m] || 10}" min="1" max="100" />
    `;
    table.appendChild(row);
  });

  maxContainer.appendChild(table);
  horarioForm.appendChild(maxContainer);
}

function crearFilaHorario(materia = "", horas = "") {
  const row = document.createElement("div");
  row.className = "fila-horario";
  row.innerHTML = `
    <input type="text" class="materia" value="${materia}" placeholder="Asignatura" />
    <input type="number" class="horas" value="${horas}" placeholder="Horas" min="1" max="6" />
    <button class="btn-secondary eliminar">🗑️</button>
  `;
  row.querySelector(".eliminar").onclick = () => row.remove();
  return row;
}

async function guardarHorario() {
  const dias = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const nuevoHorario = {};
  dias.forEach((dia, i) => {
    const container = horarioForm.children[i];
    const materias = container.querySelectorAll(".fila-horario");
    const clases = {};
    materias.forEach(row => {
      const materia = row.querySelector(".materia").value.trim();
      const horas = parseInt(row.querySelector(".horas")?.value || 0);
      if (materia && horas > 0) clases[materia] = horas;
    });
    nuevoHorario[dia] = clases;
  });
  horario = nuevoHorario;

  // máximos
  const maxDiv = horarioForm.lastElementChild;
  const filas = maxDiv.querySelectorAll(".fila-horario");
  const nuevosMax = {};
  filas.forEach(f => {
    const materia = f.querySelector(".materia").value.trim();
    const max = parseInt(f.querySelector(".max").value || 0);
    if (materia) nuevosMax[materia] = max;
  });
  maxFaltas = nuevosMax;

  await guardarDatosUsuario();
  showToast("Horario y máximos guardados correctamente", "#198754");
  volverApp();
  actualizarTabla();
  actualizarGrafico();
}

// --- FALTAS ---
function mostrarAsignaturasDelDia() {
  const fecha = fechaFalta.value;
  asignaturasDelDia.innerHTML = "";
  if (!fecha) return;
  const dia = new Date(fecha).toLocaleDateString("en-US", { weekday: "long" });
  const clases = horario[dia];
  if (!clases || Object.keys(clases).length === 0)
    return (asignaturasDelDia.innerHTML = "<p>No hay clases este día.</p>");
  for (const materia in clases) {
    const horas = clases[materia];
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${materia}"> ${materia} (${horas}h)`;
    asignaturasDelDia.appendChild(label);
  }
}

async function registrarFaltas() {
  const fecha = fechaFalta.value;
  if (!fecha) return showToast("Selecciona una fecha", "red");
  const dia = new Date(fecha).toLocaleDateString("en-US", { weekday: "long" });
  const checks = asignaturasDelDia.querySelectorAll("input[type='checkbox']");
  checks.forEach(cb => {
    if (cb.checked) {
      const materia = cb.value;
      const horas = horario[dia]?.[materia] || 0;
      if (!faltas[materia]) faltas[materia] = { total: 0, historial: [] };
      faltas[materia].total += horas;
      faltas[materia].historial.push(`${fecha} (${horas}h)`);
    }
  });
  await guardarDatosUsuario();
  actualizarTabla();
  actualizarGrafico();
  showToast("Faltas registradas", "#198754");
}

async function reiniciarFaltas() {
  if (!confirm("¿Seguro que deseas reiniciar todas las faltas?")) return;
  faltas = {};
  await guardarDatosUsuario();
  actualizarTabla();
  actualizarGrafico();
  showToast("Faltas reiniciadas", "orange");
}

// --- TABLA Y GRAFICO ---
function actualizarTabla() {
  tablaResumen.innerHTML = "";
  let historialHTML = "<h3>Historial de faltas</h3>";

  const todas = new Set([...Object.keys(maxFaltas), ...Object.keys(faltas)]);
  todas.forEach(materia => {
    const datos = faltas[materia] || { total: 0, historial: [] };
    const total = datos.total;
    const max = maxFaltas[materia] || 10;
    const restantes = Math.max(0, max - total);
    const sobrepasado = total >= max ? 'style="color:red;font-weight:bold;"' : "";
    if (total >= max) showToast(`${materia} ha superado el límite`, "red");
    tablaResumen.innerHTML += `
      <tr ${sobrepasado}>
        <td>${materia}</td>
        <td>${total}</td>
        <td>${max}</td>
        <td>${restantes}</td>
      </tr>`;
    if (datos.historial?.length)
      historialHTML += `<p><b>${materia}:</b> ${datos.historial.join(", ")}</p>`;
  });

  document.getElementById("historialFaltas").innerHTML = historialHTML;
}

function actualizarGrafico() {
  const ctx = document.getElementById("graficoFaltas");
  const labels = Object.keys(maxFaltas);
  const usados = labels.map(m => (faltas[m]?.total) || 0);
  const restantes = labels.map(m => Math.max(0, (maxFaltas[m] || 10) - (faltas[m]?.total || 0)));
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: tipoGrafico.value,
    data: {
      labels,
      datasets: [
        { label: "Usadas", data: usados, backgroundColor: "#0d6efd" },
        { label: "Restantes", data: restantes, backgroundColor: "#198754" }
      ]
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } }
  });
}

// --- EVENTOS ---
fechaFalta.onchange = mostrarAsignaturasDelDia;
btnRegistrar.onclick = registrarFaltas;
btnReiniciar.onclick = reiniciarFaltas;
btnEditarHorario.onclick = () => { renderHorarioForm(); mostrarHorarioEditor(); };
btnGuardarHorario.onclick = guardarHorario;
btnVolverApp.onclick = volverApp;
toggleTheme.onclick = toggleDarkMode;
tipoGrafico.onchange = actualizarGrafico;

// --- INIT ---
window.addEventListener("load", () => {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.body.setAttribute("data-theme", savedTheme);
  toggleTheme.textContent = savedTheme === "dark" ? "☀️" : "🌙";
  showLoader(false);
});
