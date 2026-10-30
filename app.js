// Configuración de Supabase (Carga el SDK desde CDN en los HTMLs)
const SUPABASE_URL = 'https://yrabdazhmmrfoqichxmt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uwqp_xaG8kD_5cVdQMkIkg_mU0gDn-V';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
