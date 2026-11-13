const SUPABASE_URL = "https://yrabdazhmmrfoqichxmt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uwqp_xaG8kD_5cVdQMkIkg_mU0gDn-V";

let registrosGlobales = [];
let miGrafica = null;
let registroSeleccionadoActual = null;
let filtroSeccionActual = "todos";

document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("adminLogueado") !== "true") {
    window.location.href = "admin-login.html";
  }

  const btnCerrar = document.getElementById("btnCerrarSesion");
  if (btnCerrar) {
    btnCerrar.addEventListener("click", () => {
      localStorage.removeItem("adminLogueado");
      window.location.href = "index.html";
    });
  }

  cargarRegistrosAdmin();

  // Buscador
  const inputBuscador = document.getElementById("inputBuscador");
  if (inputBuscador) {
    inputBuscador.addEventListener("input", () => {
      aplicarFiltrosYBusqueda();
    });
  }

  // Filtros rápidos funcionales
  document.querySelectorAll(".filtro-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".filtro-btn").forEach(b => {
        b.classList.remove("btn-kraft", "active");
        b.classList.add("btn-outline-light");
      });
      e.target.classList.remove("btn-outline-light");
      e.target.classList.add("btn-kraft", "active");

      filtroSeccionActual = e.target.getAttribute("data-filtro");
      aplicarFiltrosYBusqueda();
    });
  });

  // Botón Exportar Excel
  document.getElementById("btnExportarExcel").addEventListener("click", () => {
    if (registrosGlobales.length === 0) return alert("No hay datos para exportar");
    const ws = XLSX.utils.json_to_sheet(registrosGlobales);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Congregantes");
    XLSX.writeFile(wb, "Directorio_Congregantes_Manantial.xlsx");
  });

  // Botón Exportar PDF funcional
  document.getElementById("btnExportarPDF").addEventListener("click", () => {
    const elemento = document.getElementById("listaTarjetas");
    if (!elemento || registrosGlobales.length === 0) return alert("No hay datos para generar el PDF.");
    
    html2pdf().from(elemento).set({
      margin: 10,
      filename: 'Directorio_Manantial_Vida.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
    }).save();
  });

  // Botón Editar desde el Modal de Detalle
  const btnEditarModal = document.getElementById("btnEditarRegistroModal");
  if (btnEditarModal) {
    btnEditarModal.addEventListener("click", () => {
      if (!registroSeleccionadoActual) return;
      const modalDetalleEl = document.getElementById("modalDetalle");
      const modalDetalleInstance = bootstrap.Modal.getInstance(modalDetalleEl);
      if (modalDetalleInstance) modalDetalleInstance.hide();
      
      abrirModalEdicion(registroSeleccionadoActual);
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

    if (!response.ok) throw new Error("Error al obtener registros");
    registrosGlobales = await response.json();
    
    actualizarKPIs(registrosGlobales);
    renderizarTarjetas(registrosGlobales);
    generarGrafica(registrosGlobales);

  } catch (err) {
    console.error("Error al cargar registros:", err);
  }
}

function actualizarKPIs(data) {
  document.getElementById("kpiTotal").textContent = data.length;
  document.getElementById("kpiCongregantes").textContent = data.filter(r => r.seccion === "Congregantes / Adultos").length;
  document.getElementById("kpiJovenes").textContent = data.filter(r => r.seccion === "Jóvenes").length;
  document.getElementById("kpiNinos").textContent = data.filter(r => r.seccion === "Niños").length;
  document.getElementById("kpiAdolescentes").textContent = data.filter(r => r.seccion === "adolescente").length;

  const mesActual = new Date().getMonth() + 1;
  const cumpleMes = data.filter(r => {
    if (!r.fecha_nacimiento) return false;
    return parseInt(r.fecha_nacimiento.split("-")[1], 10) === mesActual;
  }).length;
  document.getElementById("kpiCumple").textContent = cumpleMes;
}

function aplicarFiltrosYBusqueda() {
  const texto = document.getElementById("inputBuscador").value.toLowerCase();
  
  const filtrados = registrosGlobales.filter(r => {
    const cumpleTexto = (
      (r.nombre_completo && r.nombre_completo.toLowerCase().includes(texto)) ||
      (r.telefono && r.telefono.toLowerCase().includes(texto)) ||
      (r.direccion && r.direccion.toLowerCase().includes(texto))
    );

    const cumpleSeccion = (filtroSeccionActual === "todos" || r.seccion === filtroSeccionActual);

    return cumpleTexto && cumpleSeccion;
  });

  renderizarTarjetas(filtrados);
}

function renderizarTarjetas(data) {
  const contenedor = document.getElementById("listaTarjetas");
  if (!contenedor) return;

  if (data.length === 0) {
    contenedor.innerHTML = `<p class="text-white-50 text-center py-3">No se encontraron registros con este filtro.</p>`;
    return;
  }

  let html = "";
  data.forEach((reg) => {
    const foto = reg.foto_url && reg.foto_url.trim() !== "" ? reg.foto_url : "https://via.placeholder.com/150?text=Sin+Foto";
    const nombre = reg.nombre_completo || "Sin Nombre";
    const edad = reg.edad || "N/D";
    const seccion = reg.seccion || "General";

    let badgeColor = "bg-success text-dark";
    if (seccion === "Jóvenes") badgeColor = "bg-info text-dark";
    else if (seccion === "Niños") badgeColor = "bg-warning text-dark";
    else if (seccion === "adolescente") badgeColor = "bg-success text-white";
    else if (seccion === "Visita") badgeColor = "bg-danger text-white";

    html += `
      <div class="col-md-4 col-sm-6">
        <div class="card card-preview p-3 text-white" onclick='mostrarDetalle(${JSON.stringify(reg)})' data-bs-toggle="modal" data-bs-target="#modalDetalle">
          <div class="d-flex align-items-center gap-3">
            <img src="${foto}" class="rounded-circle border border-warning" width="60" height="60" style="object-fit: cover;" onerror="this.src='https://via.placeholder.com/60?text=Foto'">
            <div>
              <h6 class="fw-bold mb-1 text-white">${nombre}</h6>
              <p class="text-white-50 small mb-1">Edad: ${edad} • <span class="text-gold">${seccion}</span></p>
              <span class="badge ${badgeColor}">${seccion}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  });
  contenedor.innerHTML = html;
}

function mostrarDetalle(reg) {
  registroSeleccionadoActual = reg;
  document.getElementById("modalNombreTitulo").textContent = reg.nombre_completo || "Detalle";
  const foto = reg.foto_url && reg.foto_url.trim() !== "" ? reg.foto_url : "https://via.placeholder.com/120?text=Sin+Foto";

  document.getElementById("modalContenidoDetalle").innerHTML = `
    <div class="text-center mb-3">
      <img src="${foto}" class="rounded-circle border border-warning mb-2" width="100" height="100" style="object-fit: cover;">
    </div>
    <p><b>📌 Sección:</b> ${reg.seccion || 'N/D'}</p>
    <p><b>🎂 Edad:</b> ${reg.edad || 'N/D'} años</p>
    <p><b>🕊️ Creyente:</b> ${reg.creyente || 'N/D'}</p>
    <p><b>📍 Dirección:</b> ${reg.direccion || 'N/D'}</p>
    <p><b>📞 Teléfono:</b> ${reg.telefono || 'N/D'}</p>
    <p><b>📅 Fecha de Nacimiento:</b> ${reg.fecha_nacimiento || 'N/D'}</p>
  `;

  const btnWsp = document.getElementById("btnWhatsAppModal");
  if (reg.telefono) {
    const telLimpio = reg.telefono.replace(/\D/g, '');
    btnWsp.href = `https://wa.me/521${telLimpio}?text=Hola%20${encodeURIComponent(reg.nombre_completo)},%20te%20contactamos%20de%20la%20Iglesia.`;
    btnWsp.style.display = "inline-block";
  } else {
    btnWsp.style.display = "none";
  }
}

function abrirModalEdicion(reg) {
  document.getElementById("editId").value = reg.id;
  document.getElementById("editNombre").value = reg.nombre_completo || "";
  document.getElementById("editSeccion").value = reg.seccion || "Congregantes / Adultos";
  document.getElementById("editEdad").value = reg.edad || "";
  document.getElementById("editTelefono").value = reg.telefono || "";
  document.getElementById("editDireccion").value = reg.direccion || "";

  const modalEdit = new bootstrap.Modal(document.getElementById("modalEdicion"));
  modalEdit.show();
}

async function guardarEdicionCongregante() {
  const id = document.getElementById("editId").value;
  const payload = {
    nombre_completo: document.getElementById("editNombre").value.trim(),
    seccion: document.getElementById("editSeccion").value,
    edad: parseInt(document.getElementById("editEdad").value) || null,
    telefono: document.getElementById("editTelefono").value.trim(),
    direccion: document.getElementById("editDireccion").value.trim()
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/registros_iglesia?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("Error al actualizar");

    alert("¡Registro actualizado con éxito!");
    bootstrap.Modal.getInstance(document.getElementById("modalEdicion")).hide();
    cargarRegistrosAdmin();
  } catch (err) {
    console.error(err);
    alert("Error al actualizar el registro en la base de datos.");
  }
}

function generarGrafica(data) {
  const ctx = document.getElementById('graficaSecciones');
  if (!ctx) return;
  const conteo = {};
  data.forEach(r => {
    const sec = r.seccion || "General";
    conteo[sec] = (conteo[sec] || 0) + 1;
  });

  if (miGrafica) miGrafica.destroy();
  miGrafica = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(conteo),
      datasets: [{
        label: 'Registros por Sección',
        data: Object.values(conteo),
        backgroundColor: ['#cbb281', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#ffffff' } } },
      scales: {
        x: { ticks: { color: '#ffffff' } },
        y: { ticks: { color: '#ffffff' }, grid: { color: '#374151' } }
      }
    }
  });
}
