import { createClient } from '@supabase/supabase-js';
import { missingSupabaseEnvVars, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

// main.tsx shows a setup page instead of loading the app when these are missing.
if (missingSupabaseEnvVars.length > 0) {
  throw new Error(`Missing Supabase settings: ${missingSupabaseEnvVars.join(', ')}`);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
