import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const areSupabaseKeysMissing = !supabaseUrl || !supabaseAnonKey;

// Create the client with potentially empty strings, but the flag will prevent its use.
// This stops the app from crashing on import.
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    storage: sessionStorage,
  }
});