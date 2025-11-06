import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- FIREBASE ---
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
    await signInWithPopup(auth, provider);
  } catch {
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
  } else mostrarLogin();
});

// --- MOSTRAR SECCIONES ---
function mostrarLogin() {
  showLoader(false);
  loginSection.classList.remove("oculto");
  appSection.classList.add("oculto");
  btnLogout.classList.add("oculto");
}

function mostrarApp() {
  loginSection.classList.add("oculto");
  appSection.classList.remove("oculto");
  btnLogout.classList.remove("oculto");
  showLoader(false);
}

// --- FIRESTORE ---
async function cargarFaltas() {
  showLoader(true);
  const ref = doc(db, "usuarios", currentUser.uid);
  const snap = await getDoc(ref);
  faltas = snap.exists() ? snap.data().faltas || {} : {};
  await setDoc(ref, { faltas }, { merge: true });
  actualizarTabla();
  actualizarGrafico();
  showLoader(false);
}

async function guardarFaltas() {
  const ref = doc(db, "usuarios", currentUser.uid);
  await setDoc(ref, { faltas });
  actualizarTabla();
  actualizarGrafico();
  showToast("Datos guardados correctamente", "#198754");
}

// --- LÓGICA PRINCIPAL ---
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
      if (!faltas[materia]) faltas[materia] = { total: 0, historial: [] };
      faltas[materia].total += horas;
      faltas[materia].historial.push(fecha);
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
  try {
    const data = JSON.parse(await file.text());
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
  text.split(/\r?\n/).forEach(line => {
    const [m, v] = line.split(":").map(x => x.trim());
    if (m && !isNaN(v)) faltas[m] = { total: parseInt(v), historial: [] };
  });
  await guardarFaltas();
  showToast("Importación TXT completada");
}

// --- EXPORTAR PDF / CSV ---
btnExportarPDF.onclick = () => {
  const elemento = document.querySelector(".table-container");
  const opciones = { margin: 0.5, filename: "faltas.pdf", html2canvas: { scale: 2 }, jsPDF: { unit: "in", format: "a4" } };
  html2pdf().set(opciones).from(elemento).save();
};

btnExportarCSV.onclick = () => {
  const filas = [["Asignatura", "Faltas", "Máximo", "Restantes"]];
  for (const materia in maxFaltas) {
    const datos = faltas[materia] || { total: 0 };
    const total = datos.total;
    const max = maxFaltas[materia];
    const restantes = Math.max(0, max - total);
    filas.push([materia, total, max, restantes]);
  }
  const csv = filas.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "faltas.csv";
  a.click();
};

// --- TABLA Y GRÁFICO ---
function actualizarTabla() {
  tablaResumen.innerHTML = "";
  for (const materia in maxFaltas) {
    const datos = faltas[materia] || { total: 0, historial: [] };
    const total = datos.total;
    const max = maxFaltas[materia];
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
  }
}

function actualizarGrafico() {
  const ctx = document.getElementById("graficoFaltas");
  const labels = Object.keys(maxFaltas);
  const usados = labels.map(m => (faltas[m]?.total) || 0);
  const restantes = labels.map(m => Math.max(0, maxFaltas[m] - (faltas[m]?.total || 0)));

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
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
    }
  });
}

// --- EVENTOS ---
fechaFalta.onchange = mostrarAsignaturasDelDia;
btnRegistrar.onclick = registrarFaltas;
btnReiniciar.onclick = reiniciarFaltas;
btnExportar.onclick = exportarFaltas;
inputImportJson.onchange = importarFaltas;
inputImportTxt.onchange = importarFaltasTxt;
toggleTheme.onclick = toggleDarkMode;
tipoGrafico.onchange = actualizarGrafico;

// --- INIT ---
window.addEventListener("load", () => {
  showLoader(true);
  const savedTheme = localStorage.getItem("theme") || "light";
  document.body.setAttribute("data-theme", savedTheme);
  toggleTheme.textContent = savedTheme === "dark" ? "☀️" : "🌙";
  setTimeout(() => showLoader(false), 800);
});
