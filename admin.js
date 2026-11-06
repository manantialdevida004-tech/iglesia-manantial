const SUPABASE_URL = "https://yrabdazhmmrfoqichxmt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uwqp_xaG8kD_5cVdQMkIkg_mU0gDn-V";

let registrosGlobales = [];
let visitasGlobales = [];
let miGrafica = null;
let indiceCumpleActual = 0;
let listaCumpleanosOrdenados = [];

// Variable de simulación de fecha/hora para las visitas (Estilo Mecatrónica)
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

  // Buscador de congregantes
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

  // Botón Calendario Anual de Cumpleaños PDF
  const btnPDFCalendario = document.getElementById("btnGenerarPDFCalendario");
  if (btnPDFCalendario) {
    btnPDFCalendario.addEventListener("click", () => {
      generarPDFCalendarioAnual(registrosGlobales);
    });
  }

  // Guardar Visita Pastoral desde el panel principal
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

  // Exportar PDF Reporte General
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

/* =========================================================
   SISTEMA INTERACTIVO DE VISITAS (ESTILO HORARIO DE CLASES)
   ========================================================= */

function abrirHorarioVisitasApp() {
  actualizarUIHorarioVisitas();
  const modal = new bootstrap.Modal(document.getElementById('modalAppVisitas'));
  modal.show();
}

function actualizarUIHorarioVisitas() {
  let dia = fechaSimuladaVisitas.getDay();
  if (dia === 0) dia = 7;
  let hora = fechaSimuladaVisitas.getHours();
  let minuto = fechaSimuladaVisitas.getMinutes();

  document.getElementById('lblDiaSim').innerText = nombresDias[dia] || 'DOMINGO';
  document.getElementById('lblHoraSim').innerText = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')} hrs`;

  // Filtrar visitas programadas para este día simulado
  const visitasDelDia = visitasGlobales.filter(v => {
    if (!v.fecha_hora) return false;
    const fechaV = new Date(v.fecha_hora);
    let diaV = fechaV.getDay();
    if (diaV === 0) diaV = 7;
    return diaV === dia;
  });

  let visitaEnCurso = null;
  visitasDelDia.forEach(v => {
    const fechaV = new Date(v.fecha_hora);
    const horaV = fechaV.getHours();
    if (hora === horaV) {
      visitaEnCurso = v;
    }
  });

  if (visitaEnCurso) {
    document.getElementById('lblVisitaActual').innerText = visitaEnCurso.titulo;
    const info = document.getElementById('lblInfoVisitaActual');
    info.style.display = 'block';
    info.innerText = `Programada para hoy • ${new Date(visitaEnCurso.fecha_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  } else {
    document.getElementById('lblVisitaActual').innerText = 'Sin visita programada en este horario';
    document.getElementById('lblInfoVisitaActual').style.display = 'none';
  }
}

function abrirSelectorSimulacion() {
  let diaActual = fechaSimuladaVisitas.getDay();
  if (diaActual === 0) diaActual = 7;
  document.getElementById('selectSimDia').value = diaActual;
  document.getElementById('inputSimHora').value = fechaSimuladaVisitas.getHours();
  document.getElementById('inputSimMinuto').value = fechaSimuladaVisitas.getMinutes();

  const modalSim = new bootstrap.Modal(document.getElementById('modalSimulacionTiempo'));
  modalSim.show();
}

function aplicarSimulacionVisitas() {
  const nuevoDia = parseInt(document.getElementById('selectSimDia').value);
  const nuevaHora = parseInt(document.getElementById('inputSimHora').value);
  const nuevoMinuto = parseInt(document.getElementById('inputSimMinuto').value);

  if (isNaN(nuevaHora) || nuevaHora < 0 || nuevaHora > 23 || isNaN(nuevoMinuto) || nuevoMinuto < 0 || nuevoMinuto > 59) {
    return alert("Por favor ingresa una hora y minutos válidos.");
  }

  let jsDayTarget = nuevoDia === 7 ? 0 : nuevoDia;
  let diferencia = jsDayTarget - fechaSimuladaVisitas.getDay();
  fechaSimuladaVisitas.setDate(fechaSimuladaVisitas.getDate() + diferencia);
  fechaSimuladaVisitas.setHours(nuevaHora);
  fechaSimuladaVisitas.setMinutes(nuevoMinuto);

  bootstrap.Modal.getInstance(document.getElementById('modalSimulacionTiempo')).hide();
  actualizarUIHorarioVisitas();
}

function abrirHorarioHoyVisitas() {
  let dia = fechaSimuladaVisitas.getDay();
  if (dia === 0) dia = 7;
  
  const visitasDelDia = visitasGlobales.filter(v => {
    if (!v.fecha_hora) return false;
    let diaV = new Date(v.fecha_hora).getDay();
    if (diaV === 0) diaV = 7;
    return diaV === dia && v.tipo === 'Visita';
  });

  document.getElementById('tituloHorarioDiaVisita').innerText = `Visitas: ${nombresDias[dia]}`;
  const contenedor = document.getElementById('listaVisitasDiaModal');
  contenedor.innerHTML = '';

  if (visitasDelDia.length === 0) {
    contenedor.innerHTML = '<div class="text-white-50 text-center py-3 small">No hay visitas programadas para este día.</div>';
  } else {
    visitasDelDia.forEach((v, idx) => {
      const horaFormateada = new Date(v.fecha_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      contenedor.innerHTML += `
        <div class="class-item" id="visita-item-${idx}">
          <input type="checkbox" onchange="toggleTachadoVisita(${idx})">
          <div class="class-info" style="flex:1;">
            <h6 class="text-white mb-1 fw-bold">${v.titulo}</h6>
            <p class="time mb-0 small" style="color: var(--accent-red);">⏰ ${horaFormateada} hrs</p>
          </div>
        </div>
      `;
    });
  }

  document.getElementById('subPantallaSemana').style.display = 'none';
  document.getElementById('subPantallaDia').style.display = 'block';
}

function toggleTachadoVisita(idx) {
  const item = document.getElementById(`visita-item-${idx}`);
  item.classList.toggle('completed');
}

function abrirHorarioSemanalVisitas() {
  document.getElementById('subPantallaDia').style.display = 'none';
  document.getElementById('subPantallaSemana').style.display = 'block';
  cambiarTabVisitasSemana(1);
}

function cambiarTabVisitasSemana(diaNum) {
  document.querySelectorAll('#subPantallaSemana .tab').forEach((t, idx) => {
    if ((idx + 1) === diaNum) t.classList.add('active');
    else t.classList.remove('active');
  });

  const visitasSemana = visitasGlobales.filter(v => {
    if (!v.fecha_hora || v.tipo !== 'Visita') return false;
    let diaV = new Date(v.fecha_hora).getDay();
    if (diaV === 0) diaV = 7;
    return diaV === diaNum;
  });

  const contenedor = document.getElementById('listaVisitasSemanaModal');
  contenedor.innerHTML = '';

  if (visitasSemana.length === 0) {
    contenedor.innerHTML = '<div class="text-white-50 text-center py-3 small">Sin visitas este día.</div>';
  } else {
    visitasSemana.forEach(v => {
      const horaFormateada = new Date(v.fecha_hora).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      contenedor.innerHTML += `
        <div class="class-item py-2">
          <div class="class-info" style="flex:1;">
            <h6 class="text-white mb-1 fw-bold">${v.titulo}</h6>
            <p class="time mb-0 small" style="color: #9ca3af;">📅 ${v.fecha_hora.split('T')[0]} • ${horaFormateada} hrs</p>
          </div>
        </div>
      `;
    });
  }
}

function cerrarSubPantallaVisitas() {
  document.getElementById('subPantallaDia').style.display = 'none';
  document.getElementById('subPantallaSemana').style.display = 'none';
}

/* =========================================================
   CUMPLEAÑERO MÁS PRÓXIMO EN TIEMPO REAL
   ========================================================= */

function procesarCumpleanosCongregacion(data) {
  const hoy = new Date();
  const anioActual = hoy.getFullYear();

  const validos = data.filter(r => r.fecha_nacimiento && r.fecha_nacimiento.includes("-"));

  const procesados = validos.map(person => {
    const parts = person.fecha_nacimiento.split("-");
    const mes = parseInt(parts[1], 10) - 1;
    const dia = parseInt(parts[2], 10);

    let proximoCumple = new Date(anioActual, mes, dia);
    
    if (proximoCumple < new Date(anioActual, hoy.getMonth(), hoy.getDate())) {
      proximoCumple = new Date(anioActual + 1, mes, dia);
    }

    const diffTiempo = proximoCumple - new Date(anioActual, hoy.getMonth(), hoy.getDate());
    const diasFaltantes = Math.ceil(diffTiempo / (1000 * 60 * 60 * 24));

    return {
      ...person,
      proximoCumple,
      diasFaltantes
    };
  });

  listaCumpleanosOrdenados = procesados.sort((a, b) => a.diasFaltantes - b.diasFaltantes);

  if (listaCumpleanosOrdenados.length > 0) {
    indiceCumpleActual = 0;
    mostrarCumpleDestacado(indiceCumpleActual);
  } else {
    document.getElementById("cumpleDestacadoContainer").innerHTML = `<p class="text-white-50">No hay cumpleaños registrados.</p>`;
  }

  // Llenar modal de cumpleaños
  const contenedorModal = document.getElementById("listaCumpleanosModal");
  if (contenedorModal) {
    const mesActualNum = hoy.getMonth() + 1;
    const cumpleDelMes = data.filter(r => {
      if (!r.fecha_nacimiento) return false;
      return parseInt(r.fecha_nacimiento.split("-")[1], 10) === mesActualNum;
    });

    let html = `<h6 class="text-success">🎈 Cumpleañeros del Mes (${cumpleDelMes.length}):</h6>`;
    if (cumpleDelMes.length > 0) {
      cumpleDelMes.forEach(c => {
        html += `<p class="mb-1 text-white">🎂 <b>${c.nombre_completo}</b> - ${c.fecha_nacimiento}</p>`;
      });
    } else {
      html += `<p class="text-white-50 small">Ninguno este mes.</p>`;
    }
    contenedorModal.innerHTML = html;
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
    badge.className = "badge bg-danger text-white fs-6";
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
   GENERACIÓN DE CALENDARIO ANUAL EN PDF
   ========================================================= */

function generarPDFCalendarioAnual(data) {
  if (!data || data.length === 0) {
    return alert("No hay datos en Supabase para construir el calendario.");
  }

  const mesesInfo = [
    { nombre: "ENERO", num: 1, color: "#0099e6" },
    { nombre: "FEBRERO", num: 2, color: "#0099e6" },
    { nombre: "MARZO", num: 3, color: "#0099e6" },
    { nombre: "ABRIL", num: 4, color: "#ffb300" },
    { nombre: "MAYO", num: 5, color: "#ffb300" },
    { nombre: "JUNIO", num: 6, color: "#ffb300" },
    { nombre: "JULIO", num: 7, color: "#00b359" },
    { nombre: "AGOSTO", num: 8, color: "#00b359" },
    { nombre: "SEPTIEMBRE", num: 9, color: "#00b359" },
    { nombre: "OCTUBRE", num: 10, color: "#ff334b" },
    { nombre: "NOVIEMBRE", num: 11, color: "#ff334b" },
    { nombre: "DICIEMBRE", num: 12, color: "#ff334b" }
  ];

  const gridContainer = document.getElementById("gridMesesPDF");
  if (!gridContainer) return;

  let htmlMeses = "";
  mesesInfo.forEach((mes) => {
    const cumpleMes = data.filter(r => {
      if (!r.fecha_nacimiento) return false;
      return parseInt(r.fecha_nacimiento.split("-")[1], 10) === mes.num;
    });

    cumpleMes.sort((a, b) => {
      return parseInt(a.fecha_nacimiento.split("-")[2], 10) - parseInt(b.fecha_nacimiento.split("-")[2], 10);
    });

    htmlMeses += `
      <div style="width: 31%; margin-bottom: 12px; border: 1px solid #e0e0e0; border-radius: 4px; overflow: hidden; background: #ffffff;">
        <div style="background-color: ${mes.color}; color: #ffffff; text-align: center; font-weight: bold; font-size: 11px; padding: 5px; text-transform: uppercase;">
          ${mes.nombre}
        </div>
        <div style="padding: 5px; min-height: 90px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 9px; color: #333333;">
    `;

    if (cumpleMes.length === 0) {
      htmlMeses += `<tr><td colspan="2" style="text-align: center; color: #aaa; padding: 8px;">Sin cumpleaños</td></tr>`;
    } else {
      cumpleMes.forEach(c => {
        const dia = parseInt(c.fecha_nacimiento.split("-")[2], 10);
        htmlMeses += `
          <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 2px; font-weight: 600; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.nombre_completo}</td>
            <td style="padding: 2px; text-align: right; font-weight: bold;">${dia}</td>
          </tr>
        `;
      });
    }
    htmlMeses += `</table></div></div>`;
  });

  gridContainer.innerHTML = htmlMeses;

  const elementoPDF = document.getElementById("printCalendarioAnual");
  const originalStyle = elementoPDF.getAttribute("style") || "";

  elementoPDF.style.position = "fixed";
  elementoPDF.style.left = "-9999px";
  elementoPDF.style.top = "0px";
  elementoPDF.style.width = "750px";
  elementoPDF.style.display = "block";

  html2pdf().from(elementoPDF).set({
    margin: [8, 8, 8, 8],
    filename: 'Calendario_Anual_Cumpleanos_Manantial.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
  }).save().then(() => {
    elementoPDF.setAttribute("style", originalStyle);
  });
}

/* =========================================================
   FUNCIONES GENERALES DE PANEL Y TARJETAS
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
    visitasGlobales = await res.json();

    const visitas = visitasGlobales.filter(i => i.tipo === 'Visita');
    const eventos = visitasGlobales.filter(i => i.tipo === 'EventoPastor' || !i.tipo);

    const hoyStr = new Date().toISOString().split("T")[0];
    const visitasHoy = visitas.filter(v => v.fecha_hora && v.fecha_hora.startsWith(hoyStr)).length;
    const mesStr = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const visitasMes = visitas.filter(v => v.fecha_hora && v.fecha_hora.split("-")[1] === mesStr).length;

    document.getElementById("conteoVisitasHoy").textContent = visitasHoy;
    document.getElementById("conteoVisitasMes").textContent = visitasMes;

    let htmlV = "";
    visitas.forEach(v => {
      htmlV += `<div class="list-group-item bg-dark text-white border-secondary mb-1 rounded">📍 <b>${v.titulo}</b> <br><small class="text-warning">${v.fecha_hora || ''}</small></div>`;
    });
    document.getElementById("listaVisitasAdmin").innerHTML = htmlV || '<p class="text-white-50 small">No hay visitas registradas.</p>';

    let htmlE = "";
    eventos.forEach(e => {
      htmlE += `<div class="list-group-item bg-dark text-white border-secondary mb-1 rounded">📖 <b>${e.titulo}</b> <br><small class="text-info">${e.fecha_hora || ''}</small></div>`;
    });
    document.getElementById("listaEventosAdmin").innerHTML = htmlE || '<p class="text-white-50 small">No hay eventos o cuentos registrados.</p>';

  } catch (err) {
    console.error("Error al cargar agenda:", err);
  }
}
