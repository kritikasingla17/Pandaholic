export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

export const missingSupabaseEnvVars: string[] = [
  ...(SUPABASE_URL ? [] : ['VITE_SUPABASE_URL']),
  ...(SUPABASE_ANON_KEY ? [] : ['VITE_SUPABASE_ANON_KEY']),
];
