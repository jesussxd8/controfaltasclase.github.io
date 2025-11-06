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
let horario = {};
let maxFaltas = {};
let faltas = {};
let currentUser = null;
let chart;

// --- ELEMENTOS DOM ---
const loader = document.getElementById("loader");
const loginSection = document.getElementById("loginSection");
const appSection = document.getElementById("appSection");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const btnEditarHorario = document.getElementById("btnEditarHorario");
const fechaFalta = document.getElementById("fechaFalta");
const asignaturasDelDia = document.getElementById("asignaturasDelDia");
const tablaResumen = document.getElementById("tablaResumen");
const btnRegistrar = document.getElementById("btnRegistrar");
const btnReiniciar = document.getElementById("btnReiniciar");
const toast = document.getElementById("toast");
const toggleTheme = document.getElementById("toggleTheme");
const tipoGrafico = document.getElementById("tipoGrafico");

// Modal de horario
const modal = document.getElementById("modalHorario");
const horarioTabs = document.getElementById("horarioTabs");
const contenidoHorario = document.getElementById("contenidoHorario");
const btnGuardarHorario = document.getElementById("btnGuardarHorario");
const btnCerrarModal = document.getElementById("btnCerrarModal");

// --- UI ---
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
    console.error(e);
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

// --- SESIÓN ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    mostrarApp();
    await cargarDatosUsuario();
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
      showToast("Crea tu horario en el botón superior", "#0d6efd");
      return;
    }

    const data = snap.data();
    horario = data.horario || {};
    maxFaltas = data.maxFaltas || {};
    faltas = data.faltas || {};

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
  const ref = doc(db, "usuarios", currentUser.uid);
  await setDoc(ref, { horario, maxFaltas, faltas }, { merge: true });
}

// --- MODAL DE HORARIO ---
btnEditarHorario.onclick = () => {
  modal.classList.remove("oculto");
  generarTabs();
  renderDia("Monday");
};
btnCerrarModal.onclick = () => {
  modal.classList.add("oculto");
};

function generarTabs() {
  const dias = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  horarioTabs.innerHTML = "";
  dias.forEach((dia, i) => {
    const btn = document.createElement("button");
    btn.textContent = dia;
    btn.classList.toggle("active", i === 0);
    btn.onclick = () => {
      document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderDia(dia);
    };
    horarioTabs.appendChild(btn);
  });
}

function renderDia(dia) {
  contenidoHorario.innerHTML = "";
  const clases = horario[dia] || {};
  const lista = document.createElement("div");

  Object.entries(clases).forEach(([materia, datos]) => {
    const fila = crearFilaHorario(materia, datos.horas, datos.max);
    lista.appendChild(fila);
  });

  const btnAdd = document.createElement("button");
  btnAdd.className = "btn-accent";
  btnAdd.textContent = "➕ Añadir asignatura";
  btnAdd.onclick = () => lista.appendChild(crearFilaHorario());
  contenidoHorario.appendChild(lista);
  contenidoHorario.appendChild(btnAdd);
}

function crearFilaHorario(materia = "", horas = "", max = "") {
  const fila = document.createElement("div");
  fila.className = "fila-horario";
  fila.innerHTML = `
    <input type="text" class="materia" placeholder="Asignatura" value="${materia}" />
    <input type="number" class="horas" placeholder="Horas" value="${horas}" min="1" max="10" />
    <input type="number" class="max" placeholder="Límite" value="${max}" min="1" max="100" />
    <button class="btn-secondary eliminar">🗑️</button>
  `;
  fila.querySelector(".eliminar").onclick = () => fila.remove();
  return fila;
}

btnGuardarHorario.onclick = async () => {
  const diaActivo = document.querySelector(".tabs button.active").textContent;
  const filas = contenidoHorario.querySelectorAll(".fila-horario");
  const clases = {};
  filas.forEach(f => {
    const materia = f.querySelector(".materia").value.trim();
    const horas = parseInt(f.querySelector(".horas").value || 0);
    const max = parseInt(f.querySelector(".max").value || 0);
    if (materia && horas > 0) clases[materia] = { horas, max };
  });
  horario[diaActivo] = clases;

  // Actualizar límites globales
  maxFaltas = {};
  Object.values(horario).forEach(clasesDia => {
    Object.entries(clasesDia).forEach(([m, d]) => {
      if (d.max) maxFaltas[m] = d.max;
    });
  });

  await guardarDatosUsuario();
  modal.classList.add("oculto");
  actualizarTabla();
  actualizarGrafico();
  showToast("Horario guardado correctamente", "#198754");
};

// --- FALTAS ---
fechaFalta.onchange = mostrarAsignaturasDelDia;
function mostrarAsignaturasDelDia() {
  const fecha = fechaFalta.value;
  asignaturasDelDia.innerHTML = "";
  if (!fecha) return;
  const dia = new Date(fecha).toLocaleDateString("en-US", { weekday: "long" });
  const clases = horario[dia];
  if (!clases || Object.keys(clases).length === 0)
    return (asignaturasDelDia.innerHTML = "<p>No hay clases este día.</p>");
  for (const materia in clases) {
    const horas = clases[materia].horas || 0;
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${materia}"> ${materia} (${horas}h)`;
    asignaturasDelDia.appendChild(label);
  }
}

btnRegistrar.onclick = async () => {
  const fecha = fechaFalta.value;
  if (!fecha) return showToast("Selecciona una fecha", "red");
  const dia = new Date(fecha).toLocaleDateString("en-US", { weekday: "long" });
  const checks = asignaturasDelDia.querySelectorAll("input[type='checkbox']");
  checks.forEach(cb => {
    if (cb.checked) {
      const materia = cb.value;
      const horas = horario[dia]?.[materia]?.horas || 0;
      if (!faltas[materia]) faltas[materia] = { total: 0, historial: [] };
      faltas[materia].total += horas;
      faltas[materia].historial.push(`${fecha} (${horas}h)`);
    }
  });
  await guardarDatosUsuario();
  actualizarTabla();
  actualizarGrafico();
  showToast("Faltas registradas", "#198754");
};

btnReiniciar.onclick = async () => {
  if (!confirm("¿Seguro que deseas reiniciar todas las faltas?")) return;
  faltas = {};
  await guardarDatosUsuario();
  actualizarTabla();
  actualizarGrafico();
  showToast("Faltas reiniciadas", "orange");
};

// --- TABLA Y GRAFICO ---
function actualizarTabla() {
  tablaResumen.innerHTML = "";
  let historialHTML = "<h3>Historial de faltas</h3>";
  const todas = new Set([...Object.keys(maxFaltas), ...Object.keys(faltas)]);

  todas.forEach(m => {
    const datos = faltas[m] || { total: 0, historial: [] };
    const total = datos.total;
    const max = maxFaltas[m] || 10;
    const restantes = Math.max(0, max - total);
    const sobrepasado = total >= max ? 'style="color:red;font-weight:bold;"' : "";
    if (total >= max) showToast(`${m} ha superado el límite`, "red");

    tablaResumen.innerHTML += `
      <tr ${sobrepasado}>
        <td>${m}</td>
        <td>${total}</td>
        <td>${max}</td>
        <td>${restantes}</td>
      </tr>`;
    if (datos.historial?.length)
      historialHTML += `<p><b>${m}:</b> ${datos.historial.join(", ")}</p>`;
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

// --- INIT ---
toggleTheme.onclick = toggleDarkMode;
tipoGrafico.onchange = actualizarGrafico;

window.addEventListener("load", () => {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.body.setAttribute("data-theme", savedTheme);
  toggleTheme.textContent = savedTheme === "dark" ? "☀️" : "🌙";
  showLoader(false);
});
