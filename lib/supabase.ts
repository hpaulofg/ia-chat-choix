import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

/** Cliente admin; `null` se `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` estiverem em falta (evita crash do SDK). */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !key) return null;
  if (!_admin) {
    _admin = createClient(url, key);
  }
  return _admin;
}
