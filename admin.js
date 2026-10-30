const SUPABASE_URL = "https://yrabdazhmmrfoqichxmt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uwqp_xaG8kD_5cVdQMkIkg_mU0gDn-V";

let registrosGlobales = [];
let miGrafica = null;
let indiceCumpleActual = 0;
let listaCumpleMesGlobal = [];

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
    inputBuscador.addEventListener("input", (e) => {
      const texto = e.target.value.toLowerCase();
      const filtrados = registrosGlobales.filter(r => 
        (r.nombre_completo && r.nombre_completo.toLowerCase().includes(texto)) ||
        (r.telefono && r.telefono.toLowerCase().includes(texto)) ||
        (r.direccion && r.direccion.toLowerCase().includes(texto))
      );
      renderizarTarjetas(filtrados);
    });
  }

  // Botones de navegación de cumpleañeros
  document.getElementById("btnProximoCumple").addEventListener("click", () => {
    if (listaCumpleMesGlobal.length === 0) return;
    indiceCumpleActual = (indiceCumpleActual + 1) % listaCumpleMesGlobal.length;
    mostrarCumpleDestacado(indiceCumpleActual);
  });

  document.getElementById("btnAnteriorCumple").addEventListener("click", () => {
    if (listaCumpleMesGlobal.length === 0) return;
    indiceCumpleActual = (indiceCumpleActual - 1 + listaCumpleMesGlobal.length) % listaCumpleMesGlobal.length;
    mostrarCumpleDestacado(indiceCumpleActual);
  });

  // Guardar Visita Pastoral
  document.getElementById("btnGuardarVisita").addEventListener("click", async () => {
    const nombre = document.getElementById("visitaNombre").value.trim();
    const fecha = document.getElementById("visitaFecha").value;
    if (!nombre || !fecha) return alert("Por favor completa los campos de la visita.");

    try {
      const { error } = await supabaseInsertarVisita({ titulo: `Visita a ${nombre}`, fecha_hora: fecha, tipo: 'Visita' });
      if (error) throw error;
      alert("Visita guardada exitosamente.");
      document.getElementById("visitaNombre").value = "";
      document.getElementById("visitaFecha").value = "";
      cargarVisitasYEventos();
    } catch (err) {
      console.error(err);
      alert("Error al guardar la visita.");
    }
  });

  // Guardar Evento del Pastor
  document.getElementById("btnGuardarEvento").addEventListener("click", async () => {
    const titulo = document.getElementById("eventoTitulo").value.trim();
    const fecha = document.getElementById("eventoFecha").value;
    if (!titulo || !fecha) return alert("Por favor completa los campos del evento.");

    try {
      const { error } = await supabaseInsertarVisita({ titulo: titulo, fecha_hora: fecha, tipo: 'EventoPastor' });
      if (error) throw error;
      alert("Evento guardado exitosamente.");
      document.getElementById("eventoTitulo").value = "";
      document.getElementById("eventoFecha").value = "";
      cargarVisitasYEventos();
    } catch (err) {
      console.error(err);
      alert("Error al guardar el evento.");
    }
  });

  // Exportar Excel
  document.getElementById("btnExportarExcel").addEventListener("click", () => {
    if (registrosGlobales.length === 0) return alert("No hay datos para exportar");
    const ws = XLSX.utils.json_to_sheet(registrosGlobales);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Congregantes");
    XLSX.writeFile(wb, "Reporte_Congregantes_Manantial.xlsx");
  });

  // Exportar PDF
  document.getElementById("btnExportarPDF").addEventListener("click", () => {
    html2pdf().from(document.body).save('Reporte_Manantial.pdf');
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
    console.error("Error:", err);
  }
}

function actualizarKPIs(data) {
  document.getElementById("kpiTotal").textContent = data.length;
  document.getElementById("kpiCongregantes").textContent = data.filter(r => r.seccion === "Congregantes / Adultos").length;
  document.getElementById("kpiJovenes").textContent = data.filter(r => r.seccion === "Jóvenes" || r.seccion === "Niños" || r.seccion === "adolescente").length;
  
  const mesActual = new Date().getMonth() + 1;
  const cumpleMes = data.filter(r => {
    if (!r.fecha_nacimiento) return false;
    return parseInt(r.fecha_nacimiento.split("-")[1], 10) === mesActual;
  }).length;
  document.getElementById("kpiCumple").textContent = cumpleMes;
}

function renderizarTarjetas(data) {
  const contenedor = document.getElementById("listaTarjetas");
  if (!contenedor) return;

  if (data.length === 0) {
    contenedor.innerHTML = `<p class="text-white-50 text-center py-3">No hay registros en la base de datos.</p>`;
    return;
  }

  let html = "";
  data.forEach((reg, index) => {
    const foto = reg.foto_url && reg.foto_url.trim() !== "" ? reg.foto_url : "https://via.placeholder.com/150?text=Sin+Foto";
    const nombre = reg.nombre_completo || "Sin Nombre";
    const edad = reg.edad || "N/D";
    const seccion = reg.seccion || "General";
    const semaforoColor = index % 2 === 0 ? "bg-success" : "bg-warning";

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
  const nombre = reg.nombre_completo || "Detalle del Congregante";
  document.getElementById("modalNombreTitulo").textContent = nombre;
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
    btnWsp.href = `https://wa.me/521${telLimpio}?text=Hola%20${encodeURIComponent(nombre)},%20te%20contactamos%20de%20la%20Iglesia%20Manantial%20de%20Vida.`;
    btnWsp.style.display = "inline-block";
  } else {
    btnWsp.style.display = "none";
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
        backgroundColor: ['#cbb281', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'],
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

function procesarCumpleanosCongregacion(data) {
  const mesActual = new Date().getMonth() + 1;
  listaCumpleMesGlobal = data.filter(r => {
    if (!r.fecha_nacimiento) return false;
    return parseInt(r.fecha_nacimiento.split("-")[1], 10) === mesActual;
  });

  if (listaCumpleMesGlobal.length > 0) {
    indiceCumpleActual = 0;
    mostrarCumpleDestacado(indiceCumpleActual);
  } else {
    document.getElementById("cumpleDestacadoContainer").innerHTML = `<p class="text-white-50">No hay cumpleañeros registrados este mes.</p>`;
  }

  // Llenar modal general de cumpleaños
  const contenedorModal = document.getElementById("listaCumpleanosModal");
  if (contenedorModal) {
    let html = `<h6 class="text-success">🎈 Cumpleañeros del Mes (${listaCumpleMesGlobal.length}):</h6>`;
    if (listaCumpleMesGlobal.length > 0) {
      listaCumpleMesGlobal.forEach(c => {
        html += `<p class="mb-1 text-white">🎂 <b>${c.nombre_completo}</b> - ${c.fecha_nacimiento}</p>`;
      });
    } else {
      html += `<p class="text-white-50 small">Ninguno este mes.</p>`;
    }
    contenedorModal.innerHTML = html;
  }
}

function mostrarCumpleDestacado(index) {
  const persona = listaCumpleMesGlobal[index];
  if (!persona) return;

  const foto = persona.foto_url || "https://via.placeholder.com/100?text=Foto";
  const container = document.getElementById("cumpleDestacadoContainer");
  const btnWsp = document.getElementById("btnEnviarMensajeCumple");

  container.innerHTML = `
    <img src="${foto}" class="rounded-circle border border-success" width="70" height="70" style="object-fit: cover;">
    <div>
      <h5 class="text-white mb-1">${persona.nombre_completo}</h5>
      <p class="text-success small mb-0">🎉 Cumpleaños: <b>${persona.fecha_nacimiento}</b></p>
      <small class="text-white-50">Sección: ${persona.seccion}</small>
    </div>
  `;

  if (persona.telefono) {
    const telLimpio = persona.telefono.replace(/\D/g, '');
    btnWsp.href = `https://wa.me/521${telLimpio}?text=¡Feliz%20cumpleaños%20${encodeURIComponent(persona.nombre_completo)}!%20La%20Iglesia%20Manantial%20de%20Vida%20te%20envía%20una%20gran%20bendición%20en%20tu%20día.`;
    btnWsp.style.display = "inline-block";
  } else {
    btnWsp.style.display = "none";
  }
}

async function supabaseInsertarVisita(dataObj) {
  return await fetch(`${SUPABASE_URL}/rest/v1/agenda_pastor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Prefer": "return=minimal"
    },
    body: JSON.stringify(dataObj)
  });
}

async function cargarVisitasYEventos() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/agenda_pastor?select=*`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (!res.ok) return;
    const items = await res.json();

    const visitas = items.filter(i => i.tipo === 'Visita');
    const eventos = items.filter(i => i.tipo === 'EventoPastor' || !i.tipo);

    // Contadores de visitas
    const hoyStr = new Date().toISOString().split("T")[0];
    const visitasHoy = visitas.filter(v => v.fecha_hora && v.fecha_hora.startsWith(hoyStr)).length;
    const mesStr = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const visitasMes = visitas.filter(v => v.fecha_hora && v.fecha_hora.split("-")[1] === mesStr).length;

    document.getElementById("conteoVisitasHoy").textContent = visitasHoy;
    document.getElementById("conteoVisitasMes").textContent = visitasMes;

    // Renderizar lista visitas
    let htmlV = "";
    visitas.forEach(v => {
      htmlV += `<div class="list-group-item bg-dark text-white border-secondary mb-1 rounded">📍 <b>${v.titulo}</b> <br><small class="text-warning">${v.fecha_hora || ''}</small></div>`;
    });
    document.getElementById("listaVisitasAdmin").innerHTML = htmlV || '<p class="text-white-50 small">No hay visitas registradas.</p>';

    // Renderizar lista eventos
    let htmlE = "";
    eventos.forEach(e => {
      htmlE += `<div class="list-group-item bg-dark text-white border-secondary mb-1 rounded">📖 <b>${e.titulo}</b> <br><small class="text-info">${e.fecha_hora || ''}</small></div>`;
    });
    document.getElementById("listaEventosAdmin").innerHTML = htmlE || '<p class="text-white-50 small">No hay eventos o cuentos registrados.</p>';

  } catch (err) {
    console.error("Error al cargar agenda:", err);
  }
}
