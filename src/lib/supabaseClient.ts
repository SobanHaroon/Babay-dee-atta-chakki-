import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || "";

export const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
