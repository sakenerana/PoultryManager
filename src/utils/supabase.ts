import { createClient } from '@supabase/supabase-js';

import { createReadOnlyFetch } from './readOnlyFetch';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: createReadOnlyFetch(globalThis.fetch.bind(globalThis), supabaseUrl, import.meta.env.VITE_SUPABASE_USERS_TABLE ?? 'Users'),
  },
});

export default supabase
