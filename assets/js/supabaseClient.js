// =============================================
//  SUPABASE CLIENT – Conexão Oficial do Sistema
// =============================================

// Sua URL e Public ANON Key (confirmadas)
const SUPABASE_URL = "https://kypkyrtgjskbyaglrrku.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jDHtKXC-mLcSsCWbUhUkeQ_SBqVvjjr";

// IMPORTANTE:
// Usamos window.supabase (do script CDN)
// e criamos um cliente disponível em window.supa
// NÃO declaramos "const supa" aqui para não conflitar com outros arquivos.
window.supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // recomendado pelo Supabase
  },
});

console.log("Supabase conectado:", SUPABASE_URL);
