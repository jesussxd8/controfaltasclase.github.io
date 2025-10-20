// Configuración Firebase personalizada del usuario
const firebaseConfig = {
  apiKey: "AIzaSyCw-vPulec3ToBUzSV3N_7M4t4tGyzgAgM",
  authDomain: "controlfaltasclase.firebaseapp.com",
  projectId: "controlfaltasclase",
  storageBucket: "controlfaltasclase.firebasestorage.app",
  messagingSenderId: "874486434099",
  appId: "1:874486434099:web:778b916b3a17ad1b349646",
  measurementId: "G-X864VDXE06"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const horario = {
  "Monday": { SRD: 1, SGY: 2, SSG: 1, IMW: 2 },
  "Tuesday": { SRD: 2, SGY: 1, ADE: 1, IPW: 2 },
  "Wednesday": { SGY: 2, IMW: 2, SSG: 1, SOJ: 1 },
  "Thursday": { SSG: 1, ADD: 2, IPW: 1 },
  "Friday": { SRD: 2, ADE: 1, ADD: 3 }
};

const maxFaltas = {
  SRD: 41,
  SGY: 41,
  SSG: 22,
  IMW: 32,
  ADE: 14,
  IPW: 21,
  SOJ: 6,
  ADD: 41
};

let faltas = {};

const btnLogin = document.getElementById("btnLogin");
const loginDiv = document.getElementById("loginDiv");
const appDiv = document.getElementById("appDiv");

btnLogin.onclick = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider)
    .then(result => {
      const user = result.user;
      iniciarParaUsuario(user.uid);
    })
    .catch(error => {
      console.error(error);
      alert("Error en login.");
    });
};

function iniciarParaUsuario(uid) {
  loginDiv.style.display = "none";
  appDiv.style.display = "block";

  const docRef = db.collection("usuarios").doc(uid);
  docRef.get().then(doc => {
    if (doc.exists) {
      faltas = doc.data().faltas || {};
    } else {
      faltas = {
        SRD: 2, SGY: 5, SSG: 4, IMW: 4,
        ADE: 2, IPW: 13, SOJ: 1, ADD: 7
      };
      docRef.set({ faltas });
    }
    actualizarTabla();
  }).catch(error => {
    console.error(error);
    alert("Error al cargar datos.");
    actualizarTabla();
  });
}

function mostrarAsignaturasDelDia() {
  const fecha = document.getElementById("fechaFalta").value;
  const contenedor = document.getElementById("asignaturasDelDia");
  contenedor.innerHTML = "";

  if (!fecha) return;

  const dia = new Date(fecha).toLocaleDateString("en-US", { weekday: "long" });
  const clases = horario[dia];

  if (!clases) {
    contenedor.innerHTML = "<p>No hay clases este día.</p>";
    return;
  }

  for (let materia in clases) {
    const horas = clases[materia];
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${materia}"> ${materia} (${horas}h)`;
    contenedor.appendChild(label);
  }
}

function registrarFaltas() {
  const fecha = document.getElementById("fechaFalta").value;
  if (!fecha) {
    alert("Selecciona una fecha.");
    return;
  }

  const checkboxes = document.querySelectorAll("#asignaturasDelDia input[type='checkbox']");
  const dia = new Date(fecha).toLocaleDateString("en-US", { weekday: "long" });

  checkboxes.forEach(cb => {
    if (cb.checked) {
      const materia = cb.value;
      const horas = horario[dia][materia] || 0;
      if (!faltas[materia]) faltas[materia] = 0;
      faltas[materia] += horas;
    }
  });

  const uid = auth.currentUser.uid;
  db.collection("usuarios").doc(uid).set({ faltas })
    .then(() => {
      actualizarTabla();
      mostrarAsignaturasDelDia();
    })
    .catch(error => {
      console.error("Error guardando faltas:", error);
      alert("Error al guardar datos.");
    });
}

function actualizarTabla() {
  const tbody = document.getElementById("tablaResumen");
  tbody.innerHTML = "";

  Object.keys(maxFaltas).forEach(materia => {
    const total = faltas[materia] || 0;
    const max = maxFaltas[materia];
    const restantes = Math.max(0, max - total);

    const row = `<tr>
      <td>${materia}</td>
      <td>${total}</td>
      <td>${max}</td>
      <td>${restantes}</td>
    </tr>`;
    tbody.innerHTML += row;
  });
}

function reiniciarFaltas() {
  if (confirm("¿Seguro que quieres borrar todas las faltas registradas?")) {
    faltas = {};
    const uid = auth.currentUser.uid;
    db.collection("usuarios").doc(uid).set({ faltas })
      .then(() => {
        actualizarTabla();
        mostrarAsignaturasDelDia();
      })
      .catch(error => {
        console.error("Error al reiniciar:", error);
        alert("Error al reiniciar datos.");
      });
  }
}

function exportarFaltas() {
  const datos = JSON.stringify(faltas, null, 2);
  const blob = new Blob([datos], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "faltas.json";
  a.click();

  URL.revokeObjectURL(url);
}

function importarFaltas(event) {
  const archivo = event.target.files[0];
  if (!archivo) return;

  const lector = new FileReader();
  lector.onload = function(e) {
    try {
      const datosImportados = JSON.parse(e.target.result);
      if (typeof datosImportados === "object") {
        faltas = datosImportados;
        const uid = auth.currentUser.uid;
        db.collection("usuarios").doc(uid).set({ faltas })
          .then(() => {
            actualizarTabla();
            mostrarAsignaturasDelDia();
            alert("Faltas importadas correctamente.");
          })
          .catch(error => {
            console.error("Error al importar faltas:", error);
            alert("Error al guardar datos importados.");
          });
      } else {
        throw new Error("Formato incorrecto.");
      }
    } catch {
      alert("Error al importar el archivo. Asegúrate de que sea un archivo válido.");
    }
  };
  lector.readAsText(archivo);
}


// Función para importar faltas desde archivo TXT (estructura tipo SRD: 2)
function importarFaltasDesdeTxt(event) {
  const archivo = event.target.files[0];
  if (!archivo) return;

  const lector = new FileReader();
  lector.onload = function(e) {
    const contenido = e.target.result;
    const lineas = contenido.split(/\r?\n/);
    const faltasImportadas = {};

    for (let linea of lineas) {
      const [asignatura, valor] = linea.split(":").map(s => s.trim());
      if (asignatura && valor && !isNaN(parseInt(valor))) {
        faltasImportadas[asignatura] = parseInt(valor);
      }
    }

    if (Object.keys(faltasImportadas).length > 0) {
      faltas = { ...faltas, ...faltasImportadas };
      const uid = auth.currentUser.uid;
      db.collection("usuarios").doc(uid).set({ faltas })
        .then(() => {
          actualizarTabla();
          mostrarAsignaturasDelDia();
          alert("Faltas importadas desde archivo .txt correctamente.");
        })
        .catch(error => {
          console.error("Error al guardar datos importados:", error);
          alert("Error al guardar datos importados.");
        });
    } else {
      alert("El archivo no contiene una estructura válida.");
    }
  };

  lector.readAsText(archivo);
}