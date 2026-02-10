
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// VALUES FOR YOU TO FILL IN
const SUPABASE_URL = 'https://bresnpfsjtzmolwzmhhd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Y5iqm1X3-42amerhvm4Q6w_SsUmxHqK';

// Create a single supabase client for interacting with your database
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { supabase };
