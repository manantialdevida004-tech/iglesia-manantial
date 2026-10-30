// Configuración de Supabase
const SUPABASE_URL = "https://yrabdazhmmrfoqichxmt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uwqp_xaG8kD_5cVdQMkIkg_mU0gDn-V";

document.addEventListener("DOMContentLoaded", () => {
  const formRegistro = document.getElementById("formRegistro");

  if (!formRegistro) return;

  formRegistro.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btnGuardar = document.getElementById("btnGuardar");
    const mensajeAlerta = document.getElementById("mensajeAlerta");

    if (mensajeAlerta) mensajeAlerta.innerHTML = "";

    if (btnGuardar) {
      btnGuardar.disabled = true;
      btnGuardar.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...`;
    }

    try {
      // 1. Lectura de campos del formulario
      const seccion = document.getElementById("seccion") ? document.getElementById("seccion").value : "Congregantes / Adultos";
      const nombre = document.getElementById("nombre") ? document.getElementById("nombre").value.trim() : "";
      const edad = parseInt(document.getElementById("edad").value, 10) || 0;
      const bautizado = document.getElementById("bautizado") ? document.getElementById("bautizado").value : "Sí";
      const direccion = document.getElementById("direccion") ? document.getElementById("direccion").value.trim() : "";
      const telefono = document.getElementById("telefono") ? document.getElementById("telefono").value.trim() : "";
      const fecha_nacimiento = document.getElementById("fecha_nacimiento") ? document.getElementById("fecha_nacimiento").value : null;

      // 2. Objeto con el nombre de columna exacto de tu Supabase ('creyente')
      const payload = {
        nombre: nombre,
        seccion: seccion,
        edad: edad,
        creyente: bautizado, 
        direccion: direccion,
        telefono: telefono,
        fecha_nacimiento: fecha_nacimiento || null
      };

      // 3. Envío por API REST a Supabase
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
        throw new Error(errData.message || `Error al guardar en la base de datos (${response.status})`);
      }

      // 4. Mensaje de éxito en pantalla
      if (mensajeAlerta) {
        mensajeAlerta.innerHTML = `
          <div class="alert alert-success alert-dismissible fade show border border-success" role="alert">
            <strong>¡Registro Guardado!</strong> La información de <b>${nombre}</b> se ha registrado exitosamente en la base de datos.
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
          </div>
        `;
      }

      formRegistro.reset();

    } catch (err) {
      console.error("Error:", err);
      if (mensajeAlerta) {
        mensajeAlerta.innerHTML = `
          <div class="alert alert-danger alert-dismissible fade show border border-danger" role="alert">
            <strong>Error al guardar:</strong> ${err.message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
          </div>
        `;
      }
    } finally {
      if (btnGuardar) {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = `💾 Registrar Información`;
      }
    }
  });
});
