const SUPABASE_URL = "https://yrabdazhmmrfoqichxmt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uwqp_xaG8kD_5cVdQMkIkg_mU0gDn-V";

let registrosGlobales = [];
let visitasGlobales = [];
let eventosGlobales = [];
let miGrafica = null;
let indiceCumpleActual = 0;
let listaCumpleanosOrdenados = [];
let registroSeleccionadoActual = null;
let filtroSeccionActual = "todos";

let fechaSimuladaVisitas = new Date();
const nombresDias = { 1: 'LUNES', 2: 'MARTES', 3: 'MIÉRCOLES', 4: 'JUEVES', 5: 'VIERNES', 6: 'SÁBADO', 7: 'DOMINGO' };

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
  cargarVisitasYEventos();

  // Buscador
  const inputBuscador = document.getElementById("inputBuscador");
  if (inputBuscador) {
    inputBuscador.addEventListener("input", () => {
      aplicarFiltrosYBusqueda();
    });
  }

  // Filtros Rápidos
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

  document.getElementById("btnProximoCumple").addEventListener("click", () => {
    if (listaCumpleanosOrdenados.length === 0) return;
    indiceCumpleActual = (indiceCumpleActual + 1) % listaCumpleanosOrdenados.length;
    mostrarCumpleDestacado(indiceCumpleActual);
  });

  document.getElementById("btnAnteriorCumple").addEventListener("click", () => {
    if (listaCumpleanosOrdenados.length === 0) return;
    indiceCumpleActual = (indiceCumpleActual - 1 + listaCumpleanosOrdenados.length) % listaCumpleanosOrdenados.length;
    mostrarCumpleDestacado(indiceCumpleActual);
  });

  // Guardar Visita Recurrente
  const btnGuardarVisita = document.getElementById("btnGuardarVisita");
  if (btnGuardarVisita) {
    btnGuardarVisita.addEventListener("click", async () => {
      const nombre = document.getElementById("visitaNombre").value.trim();
      const diaSemana = document.getElementById("visitaDiaSemana").value;
      const hora = document.getElementById("visitaHora").value;

      if (!nombre || !diaSemana || !hora) return alert("Completa los campos de visita.");

      const tituloVisita = `Visita a ${nombre} (${diaSemana}s a las ${hora})`;
      const fechaBase = new Date().toISOString().split('T')[0] + `T${hora}:00Z`;

      try {
        const payload = {
          titulo: tituloVisita,
          fecha_hora: fechaBase,
          tipo: 'Visita',
          descripcion: `Recurrente todos los ${diaSemana} a las ${hora}`
        };

        const res = await fetch(`${SUPABASE_URL}/rest/v1/agenda_pastor`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "Prefer": "return=representation"
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Error al guardar");

        alert("¡Visita guardada correctamente!");
        document.getElementById("visitaNombre").value = "";
        document.getElementById("visitaHora").value = "";
        cargarVisitasYEventos();
      } catch (err) {
        console.error(err);
        alert("Error al conectar con la base de datos.");
      }
    });
  }

  // Guardar Evento
  const btnGuardarEvento = document.getElementById("btnGuardarEvento");
  if (btnGuardarEvento) {
    btnGuardarEvento.addEventListener("click", async () => {
      const titulo = document.getElementById("eventoTitulo").value.trim();
      const fecha = document.getElementById("eventoFecha").value;
      const hora = document.getElementById("eventoHora").value;
      const relevance = document.getElementById("eventoRelevancia").value;

      if (!titulo || !fecha || !hora) return alert("Completa los campos del evento.");

      const fechaHoraCompleta = `${fecha}T${hora}:00Z`;

      const existeDuplicado = eventosGlobales.some(e => e.titulo.toLowerCase() === titulo.toLowerCase() && e.fecha_hora === fechaHoraCompleta);
      if (existeDuplicado) {
        return alert("⚠️ Este evento ya se encuentra registrado con la misma fecha y hora.");
      }

      try {
        const payload = {
          titulo: titulo,
          fecha_hora: fechaHoraCompleta,
          tipo: 'EventoPastor',
          descripcion: `Relevancia: ${relevance}`
        };

        const res = await fetch(`${SUPABASE_URL}/rest/v1/agenda_pastor`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "Prefer": "return=representation"
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Error al guardar");

        alert("¡Evento guardado correctamente!");
        document.getElementById("eventoTitulo").value = "";
        document.getElementById("eventoFecha").value = "";
        document.getElementById("eventoHora").value = "";
        cargarVisitasYEventos();
      } catch (err) {
        console.error(err);
        alert("Error al conectar con la base de datos.");
      }
    });
  }

  // Excel y PDF
  document.getElementById("btnExportarExcel").addEventListener("click", () => {
    if (registrosGlobales.length === 0) return alert("No hay datos para exportar");
    const ws = XLSX.utils.json_to_sheet(registrosGlobales);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Congregantes");
    XLSX.writeFile(wb, "Directorio_Congregantes_Manantial.xlsx");
  });

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

  document.getElementById("btnEditarRegistroModal").addEventListener("click", () => {
    if (!registroSeleccionadoActual) return;
    const modalDetalleEl = document.getElementById("modalDetalle");
    const modalDetalleInstance = bootstrap.Modal.getInstance(modalDetalleEl);
    if (modalDetalleInstance) modalDetalleInstance.hide();
    
    abrirModalEdicion(registroSeleccionadoActual);
  });
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
    procesarCumpleanosCongregacion(registrosGlobales);

  } catch (err) {
    console.error(err);
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
    contenedor.innerHTML = `<p class="text-white-50 text-center py-3">No se encontraron registros.</p>`;
    return;
  }

  let html = "";
  data.forEach((reg) => {
    const foto = reg.foto_url && reg.foto_url.trim() !== "" ? reg.foto_url : "https://via.placeholder.com/150?text=Sin+Foto";
    const nombre = reg.nombre_completo || "Sin Nombre";
    const edad = reg.edad || "N/D";
    const seccion = reg.seccion || "General";

    let badgeColor = "bg-success";
    let estatusTexto = "Activo";
    if (seccion === "Jóvenes" || seccion === "adolescente") {
      badgeColor = "bg-warning text-dark";
      estatusTexto = "En Seguimiento";
    } else if (seccion === "Visita") {
      badgeColor = "bg-danger";
      estatusTexto = "Visita Pendiente";
    }

    html += `
      <div class="col-md-4 col-sm-6">
        <div class="card card-preview p-3 text-white" onclick='mostrarDetalle(${JSON.stringify(reg)})' data-bs-toggle="modal" data-bs-target="#modalDetalle">
          <div class="d-flex align-items-center gap-3">
            <img src="${foto}" class="rounded-circle border border-warning" width="60" height="60" style="object-fit: cover;">
            <div>
              <h6 class="fw-bold mb-1 text-white">${nombre}</h6>
              <p class="text-white-50 small mb-1">Edad: ${edad} • <span class="text-gold">${seccion}</span></p>
              <span class="badge ${badgeColor}">${estatusTexto}</span>
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

async function cargarVisitasYEventos() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/agenda_pastor?select=*`, {
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (!res.ok) return;
    const todos = await res.json();

    visitasGlobales = todos.filter(i => i.tipo === 'Visita');
    eventosGlobales = todos.filter(i => i.tipo === 'EventoPastor' || !i.tipo);

    const hoyStr = new Date().toISOString().split("T")[0];
    const mesStr = (new Date().getMonth() + 1).toString().padStart(2, '0');

    document.getElementById("conteoVisitasHoy").textContent = visitasGlobales.filter(v => v.fecha_hora && v.fecha_hora.startsWith(hoyStr)).length;
    document.getElementById("conteoVisitasMes").textContent = visitasGlobales.filter(v => v.fecha_hora && v.fecha_hora.split("-")[1] === mesStr).length;

    // Renderizar Visitas con botones Editar / Eliminar
    let htmlV = "";
    visitasGlobales.forEach(v => {
      htmlV += `
        <div class="list-group-item bg-dark text-white border-secondary mb-2 rounded p-2 d-flex justify-content-between align-items-center">
          <div>
            📍 <b>${v.titulo}</b><br><small class="text-warning">${v.descripcion || ''}</small>
          </div>
          <div class="d-flex gap-1">
            <button class="btn btn-sm btn-outline-warning py-0 px-2" onclick='abrirModalEditarAgenda(${JSON.stringify(v)})'>✏️</button>
            <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick='eliminarItemAgenda(${v.id})'>🗑️</button>
          </div>
        </div>`;
    });
    document.getElementById("listaVisitasAdmin").innerHTML = htmlV || '<p class="text-white-50 small">Sin visitas.</p>';

    document.getElementById("conteoEventosHoy").textContent = eventosGlobales.filter(e => e.fecha_hora && e.fecha_hora.startsWith(hoyStr)).length;
    document.getElementById("conteoEventosMes").textContent = eventosGlobales.filter(e => e.fecha_hora && e.fecha_hora.split("-")[1] === mesStr).length;

    // Renderizar Eventos con botones Editar / Eliminar
    let htmlE = "";
    eventosGlobales.forEach(e => {
      const fechaLimpia = e.fecha_hora ? e.fecha_hora.replace('T', ' ').substring(0, 16) : '';
      htmlE += `
        <div class="list-group-item bg-dark text-white border-secondary mb-2 rounded p-2 d-flex justify-content-between align-items-center">
          <div>
            📖 <b>${e.titulo}</b><br><small class="text-info">📅 ${fechaLimpia} hrs • ${e.descripcion || ''}</small>
          </div>
          <div class="d-flex gap-1">
            <button class="btn btn-sm btn-outline-warning py-0 px-2" onclick='abrirModalEditarAgenda(${JSON.stringify(e)})'>✏️</button>
            <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick='eliminarItemAgenda(${e.id})'>🗑️</button>
          </div>
        </div>`;
    });
    document.getElementById("listaEventosAdmin").innerHTML = htmlE || '<p class="text-white-50 small">Sin eventos.</p>';
  } catch (err) {
    console.error(err);
  }
}

function abrirModalEditarAgenda(item) {
  document.getElementById("editAgendaId").value = item.id;
  document.getElementById("editAgendaTipo").value = item.tipo || 'EventoPastor';
  document.getElementById("editAgendaTitulo").value = item.titulo || '';
  
  if (item.fecha_hora) {
    const fechaLimpia = item.fecha_hora.replace('Z', '').substring(0, 16);
    document.getElementById("editAgendaFechaHora").value = fechaLimpia;
  } else {
    document.getElementById("editAgendaFechaHora").value = '';
  }

  document.getElementById("editAgendaDescripcion").value = item.descripcion || '';

  const modal = new bootstrap.Modal(document.getElementById("modalEdicionAgenda"));
  modal.show();
}

async function guardarCambiosAgenda() {
  const id = document.getElementById("editAgendaId").value;
  const tipo = document.getElementById("editAgendaTipo").value;
  const titulo = document.getElementById("editAgendaTitulo").value.trim();
  const fechaHoraInput = document.getElementById("editAgendaFechaHora").value;
  const descripcion = document.getElementById("editAgendaDescripcion").value.trim();

  if (!titulo || !fechaHoraInput) {
    return alert("El título y la fecha/hora son obligatorios.");
  }

  const payload = {
    titulo: titulo,
    fecha_hora: `${fechaHoraInput}:00Z`,
    tipo: tipo,
    descripcion: descripcion
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/agenda_pastor?id=eq.${id}`, {
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

    alert("¡Registro de agenda actualizado con éxito!");
    bootstrap.Modal.getInstance(document.getElementById("modalEdicionAgenda")).hide();
    cargarVisitasYEventos();
  } catch (err) {
    console.error(err);
    alert("Error al conectar con la base de datos.");
  }
}

async function eliminarItemAgenda(id) {
  if (!confirm("¿Estás seguro de eliminar este registro de la agenda?")) return;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/agenda_pastor?id=eq.${id}`, {
      method: "DELETE",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!res.ok) throw new Error("Error al eliminar");

    alert("Registro eliminado correctamente.");
    cargarVisitasYEventos();
  } catch (err) {
    console.error(err);
    alert("Error al eliminar el registro.");
  }
}

function abrirHorarioVisitasApp() { new bootstrap.Modal(document.getElementById('modalAppVisitas')).show(); }
function abrirHorarioEventosApp() { new bootstrap.Modal(document.getElementById('modalAppEventos')).show(); }
function abrirCalendarioCumpleanosApp() {
  const mesesInfo = [
    { nombre: "ENERO", num: 1, color: "#3b82f6" }, { nombre: "FEBRERO", num: 2, color: "#06b6d4" },
    { nombre: "MARZO", num: 3, color: "#10b981" }, { nombre: "ABRIL", num: 4, color: "#f59e0b" },
    { nombre: "MAYO", num: 5, color: "#ec4899" }, { nombre: "JUNIO", num: 6, color: "#8b5cf6" },
    { nombre: "JULIO", num: 7, color: "#ef4444" }, { nombre: "AGOSTO", num: 8, color: "#14b8a6" },
    { nombre: "SEPTIEMBRE", num: 9, color: "#f97316" }, { nombre: "OCTUBRE", num: 10, color: "#6366f1" },
    { nombre: "NOVIEMBRE", num: 11, color: "#d946ef" }, { nombre: "DICIEMBRE", num: 12, color: "#eab308" }
  ];

  const gridContainer = document.getElementById("gridCalendarioCumpleanosModal");
  let htmlMeses = "";
  mesesInfo.forEach((mes) => {
    const cumpleMes = registrosGlobales.filter(r => r.fecha_nacimiento && parseInt(r.fecha_nacimiento.split("-")[1], 10) === mes.num);
    htmlMeses += `
      <div class="col-md-4 col-sm-6">
        <div class="card bg-black border border-secondary rounded-3 h-100 p-2">
          <div class="py-1 text-white fw-bold text-center rounded" style="background-color: ${mes.color}; font-size: 12px;">🎈 ${mes.nombre}</div>
          <div class="p-2" style="max-height: 140px; overflow-y: auto;">
    `;
    if (cumpleMes.length === 0) {
      htmlMeses += `<p class="text-white-50 small text-center mb-0">Sin cumpleaños</p>`;
    } else {
      cumpleMes.forEach(c => {
        const dia = c.fecha_nacimiento.split("-")[2];
        htmlMeses += `<div class="d-flex justify-content-between small text-white border-bottom border-secondary py-1"><span>🎂 ${c.nombre_completo}</span><span class="badge bg-warning text-dark">Día ${dia}</span></div>`;
      });
    }
    htmlMeses += `</div></div></div>`;
  });
  gridContainer.innerHTML = htmlMeses;
  new bootstrap.Modal(document.getElementById('modalAppCumpleanos')).show();
}

function procesarCumpleanosCongregacion(data) {
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const validos = data.filter(r => r.fecha_nacimiento && r.fecha_nacimiento.includes("-"));

  listaCumpleanosOrdenados = validos.map(person => {
    const parts = person.fecha_nacimiento.split("-");
    let proximo = new Date(anioActual, parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    if (proximo < new Date(anioActual, hoy.getMonth(), hoy.getDate())) proximo = new Date(anioActual + 1, parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const diasFaltantes = Math.ceil((proximo - new Date(anioActual, hoy.getMonth(), hoy.getDate())) / (1000 * 60 * 60 * 24));
    return { ...person, diasFaltantes };
  }).sort((a, b) => a.diasFaltantes - b.diasFaltantes);

  if (listaCumpleanosOrdenados.length > 0) mostrarCumpleDestacado(0);
}

function mostrarCumpleDestacado(index) {
  const persona = listaCumpleanosOrdenados[index];
  if (!persona) return;
  const foto = persona.foto_url && persona.foto_url.trim() !== "" ? persona.foto_url : "https://via.placeholder.com/100?text=Foto";
  const badge = document.getElementById("badgeDiasRestantes");

  badge.textContent = persona.diasFaltantes === 0 ? "🎂 ¡ES HOY!" : `En ${persona.diasFaltantes} días`;
  document.getElementById("cumpleDestacadoContainer").innerHTML = `
    <img src="${foto}" class="rounded-circle border border-success shadow" width="75" height="75" style="object-fit: cover;">
    <div>
      <h5 class="text-white mb-1 fw-bold">${persona.nombre_completo}</h5>
      <p class="text-success small mb-0">🎂 Cumpleaños: <b>${persona.fecha_nacimiento}</b></p>
      <small class="text-white-50">Sección: ${persona.seccion}</small>
    </div>
  `;
}
