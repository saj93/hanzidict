// Run once: node scripts/create-pinyin-function.mjs
// Requires SUPABASE_DB_PASSWORD in .env.local
// Find it in Supabase dashboard → Settings → Database → Database password

import pg from 'pg';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').trim().split('\n')
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })
);

const projectRef = env.SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
const password = env.SUPABASE_DB_PASSWORD;

if (!password) {
  console.error('Add SUPABASE_DB_PASSWORD to .env.local');
  console.error('Find it in Supabase dashboard → Settings → Database → Database password');
  process.exit(1);
}

const client = new pg.Client({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password,
  ssl: { rejectUnauthorized: false },
});

const sql = readFileSync('supabase/search_pinyin.sql', 'utf8');

await client.connect();
await client.query(sql);
await client.end();
console.log('✓ search_pinyin_normalized function created');
