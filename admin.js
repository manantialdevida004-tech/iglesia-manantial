const SUPABASE_URL = "https://yrabdazhmmrfoqichxmt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uwqp_xaG8kD_5cVdQMkIkg_mU0gDn-V";

let registrosGlobales = [];
let miGrafica = null;
let indiceCumpleActual = 0;
let listaCumpleanosOrdenados = [];

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

  // Navegación entre cumpleañeros próximos
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
    
    // Procesamiento dinámico de cumpleaños
    procesarCumpleanosCongregacion(registrosGlobales);
    renderizarCalendarioMensual(registrosGlobales);
    renderizarCalendarioAnual(registrosGlobales);

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

/* =========================================================
   SISTEMA DE CUMPLEAÑOS DINÁMICO (PRÓXIMO, MENSUAL Y ANUAL)
   ========================================================= */

function procesarCumpleanosCongregacion(data) {
  const hoy = new Date();
  const anioActual = hoy.getFullYear();

  const validos = data.filter(r => r.fecha_nacimiento && r.fecha_nacimiento.includes("-"));

  // Calcular la fecha del próximo cumpleaños de cada persona
  const procesados = validos.map(person => {
    const parts = person.fecha_nacimiento.split("-");
    const mes = parseInt(parts[1], 10) - 1;
    const dia = parseInt(parts[2], 10);

    let proximoCumple = new Date(anioActual, mes, dia);
    
    // Ajustar si el cumpleaños de este año ya transcurrió
    if (proximoCumple < new Date(anioActual, hoy.getMonth(), hoy.getDate())) {
      proximoCumple = new Date(anioActual + 1, mes, dia);
    }

    const diffTiempo = proximoCumple - new Date(anioActual, hoy.getMonth(), hoy.getDate());
    const diasFaltantes = Math.ceil(diffTiempo / (1000 * 60 * 60 * 24));

    return {
      ...person,
      proximoCumple,
      diasFaltantes,
      diaNac: dia,
      mesNac: mes + 1
    };
  });

  // Ordenar de menor a mayor días faltantes
  listaCumpleanosOrdenados = procesados.sort((a, b) => a.diasFaltantes - b.diasFaltantes);

  if (listaCumpleanosOrdenados.length > 0) {
    indiceCumpleActual = 0;
    mostrarCumpleDestacado(indiceCumpleActual);
  } else {
    document.getElementById("cumpleDestacadoContainer").innerHTML = `<p class="text-white-50">No hay fechas de nacimiento registradas.</p>`;
  }
}

function mostrarCumpleDestacado(index) {
  const persona = listaCumpleanosOrdenados[index];
  if (!persona) return;

  const foto = persona.foto_url && persona.foto_url.trim() !== "" ? persona.foto_url : "https://via.placeholder.com/100?text=Foto";
  const container = document.getElementById("cumpleDestacadoContainer");
  const btnWsp = document.getElementById("btnEnviarMensajeCumple");
  const badge = document.getElementById("badgeDiasRestantes");

  if (persona.diasFaltantes === 0) {
    badge.textContent = "🎂 ¡ES HOY!";
    badge.className = "badge bg-danger text-white fs-6 animate-pulse";
  } else if (persona.diasFaltantes === 1) {
    badge.textContent = "🎈 Mañana";
    badge.className = "badge bg-warning text-dark fs-6";
  } else {
    badge.textContent = `En ${persona.diasFaltantes} días`;
    badge.className = "badge bg-success text-dark fs-6";
  }

  container.innerHTML = `
    <img src="${foto}" class="rounded-circle border border-success shadow" width="75" height="75" style="object-fit: cover;">
    <div>
      <h5 class="text-white mb-1 fw-bold">${persona.nombre_completo}</h5>
      <p class="text-success small mb-0">🎂 Cumpleaños: <b>${persona.fecha_nacimiento}</b></p>
      <small class="text-white-50">Sección: ${persona.seccion || 'General'}</small>
    </div>
  `;

  if (persona.telefono) {
    const telLimpio = persona.telefono.replace(/\D/g, '');
    btnWsp.href = `https://wa.me/521${telLimpio}?text=¡Hola%20${encodeURIComponent(persona.nombre_completo)}!%20Te%20enviamos%20un%20caluroso%20saludo%20y%20bendiciones%20de%20parte%20de%20la%20Iglesia%20Manantial%20de%20Vida%20por%20tu%20próximo%20cumpleaños.`;
    btnWsp.style.display = "inline-block";
  } else {
    btnWsp.style.display = "none";
  }
}

/* =========================================================
   GENERACIÓN DE CALENDARIO MENSUAL
   ========================================================= */

function renderizarCalendarioMensual(data) {
  const hoy = new Date();
  const mesActual = hoy.getMonth();
  const anioActual = hoy.getFullYear();
  const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  document.getElementById("tituloModalMes").textContent = `🗓️ Calendario de ${nombresMeses[mesActual]} ${anioActual}`;

  // Obtener cumpleañeros del mes actual
  const cumpleaniosMes = data.filter(r => {
    if (!r.fecha_nacimiento) return false;
    return parseInt(r.fecha_nacimiento.split("-")[1], 10) === (mesActual + 1);
  });

  // Mapear días que tienen cumpleaños
  const diasConCumple = {};
  cumpleaniosMes.forEach(c => {
    const dia = parseInt(c.fecha_nacimiento.split("-")[2], 10);
    if (!diasConCumple[dia]) diasConCumple[dia] = [];
    diasConCumple[dia].push(c);
  });

  // Construir matriz de días
  const primerDiaSemana = new Date(anioActual, mesActual, 1).getDay(); // 0: Dom
  const totalDiasMes = new Date(anioActual, mesActual + 1, 0).getDate();

  let html = `
    <div class="table-responsive">
      <table class="table table-bordered border-secondary text-center text-white mb-0">
        <thead>
          <tr class="table-dark text-warning">
            <th>Dom</th><th>Lun</th><th>Mar</th><th>Mié</th><th>Jue</th><th>Vie</th><th>Sáb</th>
          </tr>
        </thead>
        <tbody><tr>
  `;

  let celdaCount = 0;

  // Espacios vacíos antes del día 1
  for (let i = 0; i < primerDiaSemana; i++) {
    html += `<td class="bg-dark text-muted opacity-25"></td>`;
    celdaCount++;
  }

  // Días del mes
  for (let d = 1; d <= totalDiasMes; d++) {
    if (celdaCount % 7 === 0 && celdaCount > 0) {
      html += `</tr><tr>`;
    }

    const tieneCumple = diasConCumple[d];
    const esHoy = d === hoy.getDate();
    let bgClass = "";
    
    if (esHoy) bgClass = "bg-primary text-white fw-bold";
    else if (tieneCumple) bgClass = "bg-success text-dark fw-bold";

    html += `
      <td class="${bgClass} position-relative py-3" style="min-width: 45px;">
        ${d}
        ${tieneCumple ? `<br><small style="font-size: 0.65rem;">🎂 (${tieneCumple.length})</small>` : ''}
      </td>
    `;
    celdaCount++;
  }

  // Rellenar espacios restantes del final
  while (celdaCount % 7 !== 0) {
    html += `<td class="bg-dark text-muted opacity-25"></td>`;
    celdaCount++;
  }

  html += `</tr></tbody></table></div>`;
  document.getElementById("gridCalendarioMensual").innerHTML = html;

  // Renderizar la lista detallada de cumpleañeros del mes en el modal
  const contenedorLista = document.getElementById("listaCumpleanosMesModal");
  if (cumpleaniosMes.length === 0) {
    contenedorLista.innerHTML = `<p class="text-white-50 small">No hay cumpleaños registrados para este mes.</p>`;
  } else {
    let listaHtml = "";
    cumpleaniosMes.sort((a,b) => parseInt(a.fecha_nacimiento.split("-")[2]) - parseInt(b.fecha_nacimiento.split("-")[2]))
                  .forEach(c => {
      const dia = c.fecha_nacimiento.split("-")[2];
      listaHtml += `
        <div class="col-md-6">
          <div class="p-2 bg-black rounded border border-secondary d-flex justify-content-between align-items-center">
            <div>
              <span class="text-white fw-bold">${c.nombre_completo}</span>
              <br><small class="text-white-50">${c.seccion || 'General'}</small>
            </div>
            <span class="badge bg-success text-dark">Día ${dia}</span>
          </div>
        </div>
      `;
    });
    contenedorLista.innerHTML = listaHtml;
  }
}

/* =========================================================
   GENERACIÓN DE CALENDARIO ANUAL
   ========================================================= */

function renderizarCalendarioAnual(data) {
  const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const contenedor = document.getElementById("gridCalendarioAnual");
  let html = "";

  nombresMeses.forEach((mesNombre, indexMes) => {
    const numMes = indexMes + 1;
    const cumpleaniosDelMes = data.filter(r => {
      if (!r.fecha_nacimiento) return false;
      return parseInt(r.fecha_nacimiento.split("-")[1], 10) === numMes;
    });

    html += `
      <div class="col-md-4 col-sm-6">
        <div class="card bg-black border-secondary p-3 h-100">
          <h6 class="text-gold fw-bold border-bottom border-secondary pb-2 mb-2 d-flex justify-content-between">
            <span>${mesNombre}</span>
            <span class="badge bg-secondary">${cumpleaniosDelMes.length}</span>
          </h6>
          <div class="small" style="max-height: 140px; overflow-y: auto;">
    `;

    if (cumpleaniosDelMes.length === 0) {
      html += `<p class="text-white-50 mb-0 style="font-size: 0.75rem;">Sin registros</p>`;
    } else {
      cumpleaniosDelMes.sort((a,b) => parseInt(a.fecha_nacimiento.split("-")[2]) - parseInt(b.fecha_nacimiento.split("-")[2]))
                       .forEach(c => {
        const dia = c.fecha_nacimiento.split("-")[2];
        html += `
          <div class="d-flex justify-content-between text-white border-bottom border-dark py-1">
            <span class="text-truncate" style="max-width: 140px;">${c.nombre_completo}</span>
            <span class="text-success fw-bold">${dia}</span>
          </div>
        `;
      });
    }

    html += `
          </div>
        </div>
      </div>
    `;
  });

  contenedor.innerHTML = html;
}

/* =========================================================
   FUNCIONES DE SOPORTE GENERAL (MANTENIDAS)
   ========================================================= */

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
