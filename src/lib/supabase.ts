import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Configuration check
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.error('❌ [Supabase] Missing environment variables:');
  if (!supabaseUrl) console.error('   - VITE_SUPABASE_URL not set');
  if (!supabaseAnonKey) console.error('   - VITE_SUPABASE_ANON_KEY not set');
  console.error('   Cloud sync will be disabled. Set these in your .env file or Netlify dashboard.');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

// Fixed user ID for single-user mode (no auth required)
const USER_ID = '895cd28a-37ea-443c-b7bb-eca88c857d05';

export function getCurrentUserId(): string {
  return USER_ID;
}

export function checkSupabaseConfig(): { ok: boolean; error?: string } {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      error: 'Supabase not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.'
    };
  }
  return { ok: true };
}
