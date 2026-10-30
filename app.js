// Configuración de Supabase (Carga el SDK desde CDN en los HTMLs)
const SUPABASE_URL = 'https://yrabdazhmmrfoqichxmt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uwqp_xaG8kD_5cVdQMkIkg_mU0gDn-V'

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener("DOMContentLoaded", () => {
  const formRegistro = document.getElementById("formRegistro");

  if (formRegistro) {
    formRegistro.addEventListener("submit", async (e) => {
      e.preventDefault();

      const btnGuardar = document.getElementById("btnGuardar");
      const mensajeAlerta = document.getElementById("mensajeAlerta");

      // Feedback visual mientras guarda
      btnGuardar.disabled = true;
      btnGuardar.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando...`;

      try {
        // 1. Captura de valores del formulario
        const seccion = document.getElementById("seccion").value;
        const nombre = document.getElementById("nombre").value.trim();
        const edad = parseInt(document.getElementById("edad").value, 10);
        const bautizado = document.getElementById("bautizado").value;
        const direccion = document.getElementById("direccion").value.trim();
        const telefono = document.getElementById("telefono").value.trim();
        const fecha_nacimiento = document.getElementById("fecha_nacimiento").value;
        const fotoInput = document.getElementById("foto");

        let fotoUrl = null;

        // 2. Subir imagen a Supabase Storage (si seleccionó foto)
        if (fotoInput.files.length > 0) {
          const file = fotoInput.files[0];
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `fotos/${fileName}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("congregantes")
            .upload(filePath, file);

          if (uploadError) {
            console.error("Error al subir foto:", uploadError);
          } else {
            const { data: publicUrlData } = supabase.storage
              .from("congregantes")
              .getPublicUrl(filePath);
            fotoUrl = publicUrlData.publicUrl;
          }
        }

        // 3. Insertar registro en la tabla de Supabase
        const { data, error } = await supabase
          .from("congregantes")
          .insert([
            {
              seccion: seccion,
              nombre: nombre,
              edad: edad,
              es_creyente: bautizado,
              direccion: direccion,
              telefono: telefono,
              fecha_nacimiento: fecha_nacimiento,
              foto_url: fotoUrl
            }
          ]);

        if (error) throw error;

        // 4. Mostrar mensaje de éxito
        mensajeAlerta.innerHTML = `
          <div class="alert alert-success alert-dismissible fade show" role="alert">
            <strong>¡Registro exitoso!</strong> La información de <b>${nombre}</b> ha sido guardada correctamente.
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
          </div>
        `;

        formRegistro.reset();

      } catch (err) {
        console.error("Error en la operación:", err);
        mensajeAlerta.innerHTML = `
          <div class="alert alert-danger alert-dismissible fade show" role="alert">
            <strong>Error:</strong> No se pudo guardar el registro. Verifica tu conexión o intenta nuevamente.
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
          </div>
        `;
      } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = `💾 Registrar Información`;
      }
    });
  }
});
