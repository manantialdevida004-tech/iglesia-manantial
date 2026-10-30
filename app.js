// Configuración de Supabase
const SUPABASE_URL = "https://yrabdazhmmrfoqichxmt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uwqp_xaG8kD_5cVdQMkIkg_mU0gDn-V";

document.addEventListener("DOMContentLoaded", () => {
  const formRegistro = document.getElementById("formRegistro");

  if (!formRegistro) return;

  formRegistro.addEventListener("submit", async (e) => {
    e.preventDefault(); // Evita que la página se recargue

    const btnGuardar = document.getElementById("btnGuardar");
    const mensajeAlerta = document.getElementById("mensajeAlerta");

    if (mensajeAlerta) mensajeAlerta.innerHTML = "";

    // Feedback en el botón
    if (btnGuardar) {
      btnGuardar.disabled = true;
      btnGuardar.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...`;
    }

    try {
      // 1. Obtención de datos del formulario
      const seccion = document.getElementById("seccion") ? document.getElementById("seccion").value : "Congregantes / Adultos";
      const nombre = document.getElementById("nombre") ? document.getElementById("nombre").value.trim() : "";
      const edadVal = document.getElementById("edad") ? document.getElementById("edad").value : "0";
      const edad = parseInt(edadVal, 10) || 0;
      const bautizado = document.getElementById("bautizado") ? document.getElementById("bautizado").value : "Sí";
      const direccion = document.getElementById("direccion") ? document.getElementById("direccion").value.trim() : "";
      const telefono = document.getElementById("telefono") ? document.getElementById("telefono").value.trim() : "";
      const fecha_nacimiento = document.getElementById("fecha_nacimiento") ? document.getElementById("fecha_nacimiento").value : null;

      // 2. Construcción del objeto de envío
      const payload = {
        nombre: nombre,
        seccion: seccion,
        edad: edad,
        bautizado: bautizado,
        direccion: direccion,
        telefono: telefono,
        fecha_nacimiento: fecha_nacimiento || null
      };

      // 3. Envío directo por Fetch API REST a la tabla registros_iglesia
      const response = await fetch(`${SUPABASE_URL}/rest/v1/registros_iglesia`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Error del servidor (${response.status})`);
      }

      // 4. Muestra la alerta de confirmación en pantalla
      if (mensajeAlerta) {
        mensajeAlerta.innerHTML = `
          <div class="alert alert-success alert-dismissible fade show border border-success" role="alert">
            <strong>¡Registro Guardado!</strong> La información de <b>${nombre}</b> se registró correctamente en la base de datos.
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
          </div>
        `;
      } else {
        alert(`¡Registro exitoso! Guardado: ${nombre}`);
      }

      formRegistro.reset();

    } catch (err) {
      console.error("Error al registrar:", err);
      if (mensajeAlerta) {
        mensajeAlerta.innerHTML = `
          <div class="alert alert-danger alert-dismissible fade show border border-danger" role="alert">
            <strong>Error al guardar:</strong> ${err.message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
          </div>
        `;
      } else {
        alert("Error al guardar: " + err.message);
      }
    } finally {
      if (btnGuardar) {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = `💾 Registrar Información`;
      }
    }
  });
});
