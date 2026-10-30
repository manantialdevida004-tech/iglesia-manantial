// Configuración de conexión con Supabase
const SUPABASE_URL = "https://yrabdazhmmrfoqichxmt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uwqp_xaG8kD_5cVdQMkIkg_mU0gDn-V";

// Inicialización del cliente de Supabase
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

document.addEventListener("DOMContentLoaded", () => {
  const formRegistro = document.getElementById("formRegistro");

  if (!formRegistro) {
    console.error("No se encontró el formulario 'formRegistro' en esta página.");
    return;
  }

  formRegistro.addEventListener("submit", async (e) => {
    e.preventDefault(); // Previene que la página se recargue

    const btnGuardar = document.getElementById("btnGuardar");
    const mensajeAlerta = document.getElementById("mensajeAlerta");

    // Limpia alertas previas
    mensajeAlerta.innerHTML = "";

    // Feedback visual en el botón
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando información...`;

    try {
      if (!supabase) {
        throw new Error("No se pudo conectar con Supabase. Revisa que el script CDN esté cargado en registro.html.");
      }

      // 1. Lectura de campos
      const seccion = document.getElementById("seccion") ? document.getElementById("seccion").value : "Congregantes / Adultos";
      const nombre = document.getElementById("nombre").value.trim();
      const edad = parseInt(document.getElementById("edad").value, 10);
      const bautizado = document.getElementById("bautizado").value;
      const direccion = document.getElementById("direccion").value.trim();
      const telefono = document.getElementById("telefono").value.trim();
      const fecha_nacimiento = document.getElementById("fecha_nacimiento").value;
      const fotoInput = document.getElementById("foto");

      let fotoUrl = null;

      // 2. Carga de foto a Storage (si hay archivo seleccionado)
      if (fotoInput && fotoInput.files.length > 0) {
        const file = fotoInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `fotos/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("congregantes")
          .upload(filePath, file);

        if (uploadError) {
          console.warn("Aviso al subir la foto:", uploadError.message);
        } else {
          const { data: publicUrlData } = supabase.storage
            .from("congregantes")
            .getPublicUrl(filePath);
          fotoUrl = publicUrlData ? publicUrlData.publicUrl : null;
        }
      }

      // 3. Inserción a la base de datos (se prueba mapeo estándar de tabla registros_iglesia)
      const { data, error } = await supabase
        .from("registros_iglesia")
        .insert([
          {
            nombre: nombre,
            seccion: seccion,
            edad: edad,
            bautizado: bautizado,
            direccion: direccion,
            telefono: telefono,
            fecha_nacimiento: fecha_nacimiento,
            foto_url: fotoUrl
          }
        ]);

      if (error) {
        // Intento secundario si la tabla en Supabase tiene el nombre 'congregantes'
        const { error: errAlt } = await supabase
          .from("congregantes")
          .insert([
            {
              nombre: nombre,
              seccion: seccion,
              edad: edad,
              es_creyente: bautizado,
              direccion: direccion,
              telefono: telefono,
              fecha_nacimiento: fecha_nacimiento,
              foto_url: fotoUrl
            }
          ]);
        if (errAlt) throw errAlt;
      }

      // 4. Muestra la alerta de confirmación exitosa
      mensajeAlerta.innerHTML = `
        <div class="alert alert-success alert-dismissible fade show border border-success" role="alert">
          <strong>¡Registro guardado con éxito!</strong> La información de <b>${nombre}</b> ha sido registrada en la base de datos.
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
      `;

      formRegistro.reset();

    } catch (err) {
      console.error("Error al guardar en Supabase:", err);

      mensajeAlerta.innerHTML = `
        <div class="alert alert-danger alert-dismissible fade show border border-danger" role="alert">
          <strong>Error al guardar:</strong> ${err.message || "Verifica las políticas RLS en Supabase o el nombre de las columnas."}
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
      `;
    } finally {
      btnGuardar.disabled = false;
      btnGuardar.innerHTML = `💾 Registrar Información`;
    }
  });
});
