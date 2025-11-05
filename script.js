import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- CONFIG FIREBASE ---
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
const horario = {
  Monday: { SRD: 1, SGY: 2, SSG: 1, IMW: 2 },
  Tuesday: { SRD: 2, SGY: 1, ADE: 1, IPW: 2 },
  Wednesday: { SGY: 2, IMW: 2, SSG: 1, SOJ: 1 },
  Thursday: { SSG: 1, ADD: 2, IPW: 1 },
  Friday: { SRD: 2, ADE: 1, ADD: 3 },
};
const maxFaltas = { SRD: 41, SGY: 41, SSG: 22, IMW: 32, ADE: 14, IPW: 21, SOJ: 6, ADD: 41 };
let faltas = {};
let currentUser = null;
let chart;

// --- ELEMENTOS DOM ---
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

// --- UI Helpers ---
function showToast(msg, color = "#0d6efd") {
  toast.textContent = msg;
  toast.style.background = color;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 3000);
}

// --- AUTH ---
btnLogin.onclick = async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    showToast("Error al iniciar sesión", "red");
  }
};

btnLogout.onclick = async () => {
  await signOut(auth);
  mostrarLogin();
  showToast("Sesión cerrada");
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    mostrarApp();
    await cargarFaltas();
  } else {
    mostrarLogin();
  }
});

function mostrarLogin() {
  loginSection.classList.remove("oculto");
  appSection.classList.add("oculto");
  btnLogout.classList.add("oculto");
}

function mostrarApp() {
  loginSection.classList.add("oculto");
  appSection.classList.remove("oculto");
  btnLogout.classList.remove("oculto");
}

// --- FIRESTORE ---
async function cargarFaltas() {
  const ref = doc(db, "usuarios", currentUser.uid);
  const snap = await getDoc(ref);
  faltas = snap.exists() ? snap.data().faltas || {} : {};
  await setDoc(ref, { faltas }, { merge: true });
  actualizarTabla();
  actualizarGrafico();
}

async function guardarFaltas() {
  const ref = doc(db, "usuarios", currentUser.uid);
  await setDoc(ref, { faltas });
  actualizarTabla();
  actualizarGrafico();
  showToast("Datos guardados correctamente", "#198754");
}

// --- FUNCIONALIDAD ---
function mostrarAsignaturasDelDia() {
  const fecha = fechaFalta.value;
  asignaturasDelDia.innerHTML = "";
  if (!fecha) return;
  const dia = new Date(fecha).toLocaleDateString("en-US", { weekday: "long" });
  const clases = horario[dia];
  if (!clases) return (asignaturasDelDia.innerHTML = "<p>No hay clases este día.</p>");
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
      const horas = horario[dia][materia] || 0;
      faltas[materia] = (faltas[materia] || 0) + horas;
    }
  });
  await guardarFaltas();
}

async function reiniciarFaltas() {
  if (!confirm("¿Seguro que deseas reiniciar todas las faltas?")) return;
  faltas = {};
  await guardarFaltas();
  showToast("Faltas reiniciadas", "orange");
}

function exportarFaltas() {
  const blob = new Blob([JSON.stringify(faltas, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "faltas.json";
  a.click();
}

async function importarFaltas(e) {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    faltas = data;
    await guardarFaltas();
    showToast("Importación JSON exitosa");
  } catch {
    showToast("Archivo JSON inválido", "red");
  }
}

async function importarFaltasTxt(e) {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  lines.forEach(line => {
    const [m, v] = line.split(":").map(x => x.trim());
    if (m && !isNaN(v)) faltas[m] = parseInt(v);
  });
  await guardarFaltas();
  showToast("Importación TXT completada");
}

// --- TABLA + GRAFICO ---
function actualizarTabla() {
  tablaResumen.innerHTML = "";
  for (const materia in maxFaltas) {
    const total = faltas[materia] || 0;
    const max = maxFaltas[materia];
    const restantes = Math.max(0, max - total);
    tablaResumen.innerHTML += `<tr><td>${materia}</td><td>${total}</td><td>${max}</td><td>${restantes}</td></tr>`;
  }
}

function actualizarGrafico() {
  const ctx = document.getElementById("graficoFaltas");
  const labels = Object.keys(maxFaltas);
  const usados = labels.map(m => faltas[m] || 0);
  const restantes = labels.map(m => Math.max(0, maxFaltas[m] - (faltas[m] || 0)));

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "bar",
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
btnExportar.onclick = exportarFaltas;
inputImportJson.onchange = importarFaltas;
inputImportTxt.onchange = importarFaltasTxt;
