import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function searchEntries(query) {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .or(`simplified.ilike.%${query}%,traditional.ilike.%${query}%,pinyin.ilike.%${query}%,definitions.ilike.%${query}%`)
    .limit(20);

  if (error) throw error;
  return data;
}

export async function getEntry(simplified) {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .or(`simplified.eq.${simplified},traditional.eq.${simplified}`)
    .limit(1);

  if (error) throw error;
  return data[0] || null;
}