import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Cliente Supabase para uso no Frontend e em componentes públicos (sujeito às regras de RLS).
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Cria cliente administrativo com Service Role Key para operações seguras de backend (bypass de RLS).
 * NUNCA utilize esta chave no lado do cliente (browser).
 */
export function getServiceRoleClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada nas variáveis de ambiente.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
