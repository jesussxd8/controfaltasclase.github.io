import {
  auth, db, provider,
  signInWithPopup, signOut, onAuthStateChanged,
  doc, getDoc, setDoc
} from "./firebase.js";

let faltas = {};
let historial = [];
let chart;

// --- ELEMENTOS ---
const loader = document.getElementById("loader");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const appSection = document.getElementById("appSection");
const loginSection = document.getElementById("loginSection");
const cardsContainer = document.getElementById("cardsContainer");
const historialContainer = document.getElementById("historialContainer");
const toast = document.getElementById("toast");
const toggleTheme = document.getElementById("toggleTheme");

// --- HORARIOS Y FALTAS MÁXIMAS ---
const maxFaltas = { SRD: 41, SGY: 41, SSG: 22, IMW: 32, ADE: 14, IPW: 21, SOJ: 6, ADD: 41 };

// --- UTILS ---
const showToast = (msg, color = "#0dcaf0") => {
  toast.textContent = msg;
  toast.style.background = color;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 3000);
};

const showLoader = (show) => loader.style.display = show ? "flex" : "none";

function toggleDarkMode() {
  document.body.dataset.theme = document.body.dataset.theme === "light" ? "dark" : "light";
  localStorage.setItem("theme", document.body.dataset.theme);
}

// --- AUTH ---
btnLogin.onclick = async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch {
    showToast("Error al iniciar sesión", "#ff6b6b");
  }
};

btnLogout.onclick = async () => {
  await signOut(auth);
  loginSection.classList.remove("oculto");
  appSection.classList.add("oculto");
  showToast("Sesión cerrada");
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginSection.classList.add("oculto");
    appSection.classList.remove("oculto");
    await cargarDatos(user.uid);
  } else {
    loginSection.classList.remove("oculto");
    appSection.classList.add("oculto");
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
  } else {
    await setDoc(ref, { faltas: {}, historial: [] });
  }
  actualizarDashboard();
  renderHistorial();
  showLoader(false);
}

async function guardarDatos(uid) {
  const ref = doc(db, "usuarios", uid);
  await setDoc(ref, { faltas, historial });
}

// --- UI ---
function actualizarDashboard() {
  cardsContainer.innerHTML = "";
  Object.keys(maxFaltas).forEach((materia) => {
    const usadas = faltas[materia] || 0;
    const total = maxFaltas[materia];
    const porcentaje = ((usadas / total) * 100).toFixed(1);
    const card = document.createElement("div");
    card.className = "card-summary";
    card.innerHTML = `
      <h3>${materia}</h3>
      <p>${usadas} / ${total} faltas</p>
      <div class="bar-bg"><div class="bar-fill" style="width:${porcentaje}%;"></div></div>
    `;
    cardsContainer.appendChild(card);
  });
  renderChart();
}

function renderChart() {
  const ctx = document.getElementById("graficoFaltas");
  if (!ctx) return;
  const labels = Object.keys(maxFaltas);
  const usados = labels.map(m => faltas[m] || 0);
  const restantes = labels.map(m => Math.max(0, maxFaltas[m] - (faltas[m] || 0)));
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Usadas", data: usados, backgroundColor: "#0dcaf0" },
        { label: "Restantes", data: restantes, backgroundColor: "#20c997" }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
  });
}

function renderHistorial() {
  historialContainer.innerHTML = historial.length
    ? historial.map(h => `<div class="historial-entry"><b>${h.fecha}</b> → ${h.materias.join(", ")}</div>`).join("")
    : "<p>No hay registros aún.</p>";
}

// --- INIT ---
window.addEventListener("load", () => {
  document.body.dataset.theme = localStorage.getItem("theme") || "dark";
  showLoader(true);
  setTimeout(() => showLoader(false), 1000);
});
toggleTheme.onclick = toggleDarkMode;
