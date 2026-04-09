import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    const url = process.env.SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    _admin = createClient(url, key);
  }
  return _admin;
}
