const SUPABASE_URL = "https://yrabdazhmmrfoqichxmt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uwqp_xaG8kD_5cVdQMkIkg_mU0gDn-V";

let registrosGlobales = [];
let miGrafica = null;

document.addEventListener("DOMContentLoaded", () => {
  // Validar sesión de admin
  if (localStorage.getItem("adminLogueado") !== "true") {
    window.location.href = "admin-login.html"; // O redirige si es necesario
  }

  const btnCerrar = document.getElementById("btnCerrarSesion");
  if (btnCerrar) {
    btnCerrar.addEventListener("click", () => {
      localStorage.removeItem("adminLogueado");
      window.location.href = "index.html";
    });
  }

  cargarRegistrosAdmin();

  // Buscador en tiempo real
  const inputBuscador = document.getElementById("inputBuscador");
  if (inputBuscador) {
    inputBuscador.addEventListener("input", (e) => {
      const texto = e.target.value.toLowerCase();
      const filtrados = registrosGlobales.filter(r => 
        (r.Nombre_completo && r.Nombre_completo.toLowerCase().includes(texto)) ||
        (r.telefono && r.telefono.toLowerCase().includes(texto)) ||
        (r.direccion && r.direccion.toLowerCase().includes(texto))
      );
      renderizarTarjetas(filtrados);
    });
  }

  // Exportar Excel
  const btnExcel = document.getElementById("btnExportarExcel");
  if (btnExcel) {
    btnExcel.addEventListener("click", () => {
      if (registrosGlobales.length === 0) return alert("No hay datos para exportar");
      const ws = XLSX.utils.json_to_sheet(registrosGlobales);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Congregantes");
      XLSX.writeFile(wb, "Reporte_Congregantes_Manantial.xlsx");
    });
  }

  // Exportar PDF
  const btnPDF = document.getElementById("btnExportarPDF");
  if (btnPDF) {
    btnPDF.addEventListener("click", () => {
      const elemento = document.body;
      const opciones = {
        margin: 1,
        filename: 'Reporte_Manantial.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      html2pdf().from(elemento).save();
    });
  }
});

async function cargarRegistrosAdmin() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/registros_iglesia?select=*`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!response.ok) throw new Error("Error al obtener registros de Supabase");

    registrosGlobales = await response.json();
    
    actualizarKPIs(registrosGlobales);
    renderizarTarjetas(registrosGlobales);
    generarGrafica(registrosGlobales);
    calcularCumpleanos(registrosGlobales);

  } catch (err) {
    console.error("Error:", err);
    document.getElementById("listaTarjetas").innerHTML = `<p class="text-danger text-center">Error al conectar con la base de datos.</p>`;
  }
}

function actualizarKPIs(data) {
  const total = data.length;
  const congregantes = data.filter(r => r.seccion === "Congregantes / Adultos").length;
  const jovenesNinos = data.filter(r => r.seccion === "Jóvenes" || r.seccion === "Niños").length;
  
  // Mes actual
  const mesActual = new Date().getMonth() + 1;
  const cumpleMes = data.filter(r => {
    if (!r.fecha_nacimiento) return false;
    const mesNac = parseInt(r.fecha_nacimiento.split("-")[1], 10);
    return mesNac === mesActual;
  }).length;

  document.getElementById("kpiTotal").textContent = total;
  document.getElementById("kpiCongregantes").textContent = congregantes;
  document.getElementById("kpiJovenes").textContent = jovenesNinos;
  document.getElementById("kpiCumple").textContent = cumpleMes;
}

function renderizarTarjetas(data) {
  const contenedor = document.getElementById("listaTarjetas");
  if (!contenedor) return;

  if (data.length === 0) {
    contenedor.innerHTML = `<p class="text-white-50 text-center py-3">No se encontraron registros en la base de datos.</p>`;
    return;
  }

  let html = "";
  data.forEach((reg, index) => {
    const foto = reg.foto_url || "https://via.placeholder.com/150?text=Sin+Foto";
    const nombre = reg.Nombre_completo || "Sin Nombre";
    const edad = reg.edad || "N/D";
    const seccion = reg.seccion || "General";
    const telefono = reg.telefono || "";
    const semaforoColor = index % 2 === 0 ? "bg-success" : "bg-warning"; // Ejemplo de semáforo

    html += `
      <div class="col-md-4 col-sm-6">
        <div class="card card-preview p-3 text-white" onclick='mostrarDetalle(${JSON.stringify(reg)})' data-bs-toggle="modal" data-bs-target="#modalDetalle">
          <div class="d-flex align-items-center gap-3">
            <img src="${foto}" alt="Foto" class="rounded-circle border border-warning" width="60" height="60" style="object-fit: cover;" onerror="this.src='https://via.placeholder.com/60?text=Foto'">
            <div>
              <h6 class="fw-bold mb-1 text-white">${nombre}</h6>
              <p class="text-white-50 small mb-1">Edad: ${edad} años • <span class="text-gold">${seccion}</span></p>
              <span class="badge ${semaforoColor} text-dark">Estatus Activo</span>
            </div>
          </div>
        </div>
      </div>
    `;
  });
  contenedor.innerHTML = html;
}

function mostrarDetalle(reg) {
  document.getElementById("modalNombreTitulo").textContent = reg.Nombre_completo || "Detalle del Congregante";
  
  const contenido = document.getElementById("modalContenidoDetalle");
  contenido.innerHTML = `
    <div class="text-center mb-3">
      <img src="${reg.foto_url || 'https://via.placeholder.com/120'}" class="rounded-circle border border-warning mb-2" width="100" height="100" style="object-fit: cover;">
    </div>
    <p><b>📌 Sección:</b> ${reg.seccion || 'N/D'}</p>
    <p><b>🎂 Edad:</b> ${reg.edad || 'N/D'} años</p>
    <p><b>🕊️ Creyente / Bautizado:</b> ${reg.creyente || 'N/D'}</p>
    <p><b>📍 Dirección:</b> ${reg.direccion || 'N/D'}</p>
    <p><b>📞 Teléfono:</b> ${reg.telefono || 'N/D'}</p>
    <p><b>📅 Fecha de Nacimiento:</b> ${reg.fecha_nacimiento || 'N/D'}</p>
  `;

  const btnWsp = document.getElementById("btnWhatsAppModal");
  if (reg.telefono) {
    const telLimpio = reg.telefono.replace(/\D/g, '');
    btnWsp.href = `https://wa.me/521${telLimpio}?text=Hola%20${encodeURIComponent(reg.Nombre_completo)},%20te%20contactamos%20de%20la%20Iglesia%20Manantial%20de%20Vida.`;
    btnWsp.style.display = "inline-block";
  } else {
    btnWsp.style.display = "none";
  }
}

function generarGrafica(data) {
  const ctx = document.getElementById('graficaSecciones');
  if (!ctx) return;

  const conteo = {
    "Congregantes / Adultos": 0,
    "Jóvenes": 0,
    "Niños": 0,
    "Visita": 0
  };

  data.forEach(r => {
    if (conteo[r.seccion] !== undefined) {
      conteo[r.seccion]++;
    } else {
      conteo[r.seccion] = 1;
    }
  });

  if (miGrafica) miGrafica.destroy();

  miGrafica = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(conteo),
      datasets: [{
        label: 'Registros por Sección',
        data: Object.values(conteo),
        backgroundColor: ['#cbb281', '#3b82f6', '#10b981', '#f59e0b'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#ffffff' } }
      },
      scales: {
        x: { ticks: { color: '#ffffff' } },
        y: { ticks: { color: '#ffffff' }, grid: { color: '#374151' } }
      }
    }
  });
}

function calcularCumpleanos(data) {
  const contenedor = document.getElementById("listaCumpleanosModal");
  if (!contenedor) return;

  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const diaActual = hoy.getDate();

  const cumpleDelDia = [];
  const cumpleDelMes = [];

  data.forEach(r => {
    if (!r.fecha_nacimiento) return;
    const partes = r.fecha_nacimiento.split("-");
    const mesNac = parseInt(partes[1], 10);
    const diaNac = parseInt(partes[2], 10);

    if (mesNac === mesActual) {
      cumpleDelMes.push(r);
      if (diaNac === diaActual) {
        cumpleDelDia.push(r);
      }
    }
  });

  let html = `<h6 class="text-warning">🎉 Cumpleañeros de Hoy:</h6>`;
  if (cumpleDelDia.length > 0) {
    cumpleDelDia.forEach(c => {
      html += `<p class="mb-1 text-white">🎂 <b>${c.Nombre_completo}</b> (${c.telefono || 'Sin teléfono'})</p>`;
    });
  } else {
    html += `<p class="text-white-50 small">Ninguno hoy.</p>`;
  }

  html += `<h6 class="text-success mt-3">📅 Cumpleañeros del Mes:</h6>`;
  if (cumpleDelMes.length > 0) {
    cumpleDelMes.forEach(c => {
      html += `<p class="mb-1 text-white">🎈 <b>${c.Nombre_completo}</b> - ${c.fecha_nacimiento}</p>`;
    });
  } else {
    html += `<p class="text-white-50 small">No hay cumpleañeros este mes.</p>`;
  }

  contenedor.innerHTML = html;
}
