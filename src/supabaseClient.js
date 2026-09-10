import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  process.env.REACT_APP_SUPABASE_URL ||
  'https://hdxqoozhrvthnobpjffl.supabase.co';

const supabaseAnonKey = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  'sb_publishable_wQ_JEWk80D8aVqyZg7Zgtw_LTWDY-Ea';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
