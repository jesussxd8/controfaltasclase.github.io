import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

const horario = {
  Monday: { SRD: 1, SGY: 2, SSG: 1, IMW: 2 },
  Tuesday: { SRD: 2, SGY: 1, ADE: 1, IPW: 2 },
  Wednesday: { SGY: 2, IMW: 2, SSG: 1, SOJ: 1 },
  Thursday: { SSG: 1, ADD: 2, IPW: 1 },
  Friday: { SRD: 2, ADE: 1, ADD: 3 },
};
const maxFaltas = { SRD: 41, SGY: 41, SSG: 22, IMW: 32, ADE: 14, IPW: 21, SOJ: 6, ADD: 41 };

let faltas = {};
let historial = [];
let chart;

// --- ELEMENTOS ---
const loader = document.getElementById("loader");
const loginSection = document.getElementById("loginSection");
const appSection = document.getElementById("appSection");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const fechaFalta = document.getElementById("fechaFalta");
const asignaturasDelDia = document.getElementById("asignaturasDelDia");
const tablaResumen = document.getElementById("tablaResumen");
const btnRegistrar = document.getElementById("btnRegistrar");
const btnReiniciar = document.getElementById("btnReiniciar");
const btnExportar = document.getElementById("btnExportar");
const inputImportJson = document.getElementById("inputImportJson");
const inputImportTxt = document.getElementById("inputImportTxt");
const toast = document.getElementById("toast");
const toggleTheme = document.getElementById("toggleTheme");
const historialContainer = document.getElementById("historialContainer");

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
  const newTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
  document.body.dataset.theme = newTheme;
  localStorage.setItem("theme", newTheme);
  toggleTheme.textContent = newTheme === "dark" ? "☀️" : "🌙";
}

// --- AUTH ---
btnLogin.onclick = async () => signInWithPopup(auth, provider).catch(() => showToast("Error de inicio", "red"));
btnLogout.onclick = async () => { await signOut(auth); showToast("Sesión cerrada"); };

onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginSection.classList.add("oculto");
    appSection.classList.remove("oculto");
    btnLogout.classList.remove("oculto");
    await cargarDatos(user.uid);
  } else {
    loginSection.classList.remove("oculto");
    appSection.classList.add("oculto");
    btnLogout.classList.add("oculto");
  }
});

// --- FIRESTORE ---
async function cargarDatos(uid) {
  showLoader(true);
  const ref = doc(db, "usuarios", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    faltas = snap.data().faltas || {};
    historial = snap.data().historial || [];
  } else await setDoc(ref, { faltas: {}, historial: [] });
  actualizarTabla();
  actualizarGrafico();
  renderHistorial();
  showLoader(false);
}

async function guardarDatos(uid) {
  const ref = doc(db, "usuarios", uid);
  await setDoc(ref, { faltas, historial });
}

// --- FUNCIONES PRINCIPALES ---
function mostrarAsignaturasDelDia() {
  const fecha = fechaFalta.value;
  asignaturasDelDia.innerHTML = "";
  if (!fecha) return;
  const dia = new Date(fecha).toLocaleDateString("en-US", { weekday: "long" });
  const clases = horario[dia];
  if (!clases) return asignaturasDelDia.innerHTML = "<p>No hay clases.</p>";
  for (const m in clases) {
    const horas = clases[m];
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${m}"> ${m} (${horas}h)`;
    asignaturasDelDia.appendChild(label);
  }
}

btnRegistrar.onclick = async () => {
  const fecha = fechaFalta.value;
  if (!fecha) return showToast("Selecciona una fecha", "red");
  const dia = new Date(fecha).toLocaleDateString("en-US", { weekday: "long" });
  const checks = asignaturasDelDia.querySelectorAll("input[type='checkbox']");
  const faltasHoy = [];
  checks.forEach(cb => {
    if (cb.checked) {
      const m = cb.value;
      faltas[m] = (faltas[m] || 0) + (horario[dia][m] || 0);
      faltasHoy.push(m);
    }
  });
  if (faltasHoy.length) {
    historial.unshift({ fecha, materias: faltasHoy });
    await guardarDatos(auth.currentUser.uid);
    actualizarTabla();
    actualizarGrafico();
    renderHistorial();
    showToast("Faltas registradas", "#198754");
  }
};

btnReiniciar.onclick = async () => {
  if (!confirm("¿Borrar todos los datos?")) return;
  faltas = {}; historial = [];
  await guardarDatos(auth.currentUser.uid);
  actualizarTabla(); actualizarGrafico(); renderHistorial();
};

btnExportar.onclick = () => {
  const blob = new Blob([JSON.stringify({ faltas, historial }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "faltas.json";
  a.click();
};

inputImportJson.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const data = JSON.parse(await file.text());
  faltas = data.faltas || {};
  historial = data.historial || [];
  await guardarDatos(auth.currentUser.uid);
  actualizarTabla(); actualizarGrafico(); renderHistorial();
};

inputImportTxt.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const lines = (await file.text()).split(/\r?\n/);
  lines.forEach(l => { const [m, v] = l.split(":").map(s => s.trim()); if (m && !isNaN(v)) faltas[m] = +v; });
  await guardarDatos(auth.currentUser.uid);
  actualizarTabla(); actualizarGrafico();
};

fechaFalta.onchange = mostrarAsignaturasDelDia;
toggleTheme.onclick = toggleDarkMode;

// --- TABLA Y GRÁFICO ---
function actualizarTabla() {
  tablaResumen.innerHTML = "";
  for (const m in maxFaltas) {
    const total = faltas[m] || 0;
    const max = maxFaltas[m];
    const rest = Math.max(0, max - total);
    tablaResumen.innerHTML += `<tr><td>${m}</td><td>${total}</td><td>${max}</td><td>${rest}</td></tr>`;
  }
}
function actualizarGrafico() {
  const ctx = document.getElementById("graficoFaltas");
  if (!ctx) return;
  const labels = Object.keys(maxFaltas);
  const usados = labels.map(m => faltas[m] || 0);
  const restantes = labels.map(m => Math.max(0, maxFaltas[m] - (faltas[m] || 0)));
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [
      { label: "Usadas", data: usados, backgroundColor: "#0d6efd" },
      { label: "Restantes", data: restantes, backgroundColor: "#198754" }
    ]},
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
  });
}

// --- HISTORIAL ---
function renderHistorial() {
  historialContainer.innerHTML = historial.length
    ? historial.map(h => `<div class="historial-entry"><b>${h.fecha}</b>: ${h.materias.join(", ")}</div>`).join("")
    : "<p>No hay registros aún.</p>";
}

// --- INIT ---
window.addEventListener("load", () => {
  showLoader(true);
  const theme = localStorage.getItem("theme") || "light";
  document.body.dataset.theme = theme;
  toggleTheme.textContent = theme === "dark" ? "☀️" : "🌙";
  setTimeout(() => showLoader(false), 1000);
});
