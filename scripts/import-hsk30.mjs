#!/usr/bin/env node
// Import official HSK 3.0 word list from ivankra/hsk30
// Source: https://raw.githubusercontent.com/ivankra/hsk30/master/hsk30.csv
//
// Usage: node scripts/import-hsk30.mjs
// Steps:
//   1. Resets all hsk_level values to NULL
//   2. Sets hsk_level for every simplified form in the official list
//   3. Prints a count summary to verify against official numbers

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = join(__dir, '..', '.env.local');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const CSV_URL = 'https://raw.githubusercontent.com/ivankra/hsk30/master/hsk30.csv';

function parseCSV(text) {
  const lines = text.split('\n');
  const headers = lines[0].split(',');
  const rows = [];
  let i = 1;
  while (i < lines.length) {
    // Handle quoted fields containing commas/newlines
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fields = [];
    let field = '';
    let inQuote = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"' && !inQuote) { inQuote = true; }
      else if (ch === '"' && inQuote) { inQuote = false; }
      else if (ch === ',' && !inQuote) { fields.push(field); field = ''; }
      else { field += ch; }
    }
    fields.push(field);
    if (fields.length >= headers.length) {
      const row = {};
      headers.forEach((h, idx) => { row[h.trim()] = (fields[idx] || '').trim(); });
      rows.push(row);
    }
    i++;
  }
  return rows;
}

function expandSimplified(row) {
  // Returns array of simplified strings for this row
  if (!row.Simplified.includes('|')) return [row.Simplified];
  // Use Variants JSON if available
  try {
    const variants = JSON.parse(row.Variants);
    return variants.map(v => v.Simplified).filter(Boolean);
  } catch {
    return row.Simplified.split('|').map(s => s.trim()).filter(Boolean);
  }
}

async function main() {
  console.log('Fetching HSK 3.0 word list…');
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`);
  const text = await res.text();
  const rows = parseCSV(text);
  console.log(`Parsed ${rows.length} rows.`);

  // Build map: simplified → hsk_level (integer, 7-9 → 7)
  const wordMap = new Map();
  for (const row of rows) {
    const level = row.Level === '7-9' ? 7 : parseInt(row.Level, 10);
    if (isNaN(level)) continue;
    for (const simplified of expandSimplified(row)) {
      if (simplified) wordMap.set(simplified, level);
    }
  }
  console.log(`Unique simplified forms: ${wordMap.size}`);

  // Step 1: Reset all hsk_level values
  console.log('\nStep 1: Resetting all hsk_level values to NULL…');
  const { error: resetError } = await supabase
    .from('entries')
    .update({ hsk_level: null })
    .not('hsk_level', 'is', null);
  if (resetError) throw new Error('Reset failed: ' + resetError.message);
  console.log('  Done.');

  // Step 2: Set hsk_level for each word
  console.log('\nStep 2: Importing HSK levels…');
  const entries = [...wordMap.entries()];
  let updated = 0;
  let notFound = 0;
  const BATCH = 50;

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    await Promise.all(batch.map(async ([simplified, level]) => {
      const { error, count } = await supabase
        .from('entries')
        .update({ hsk_level: level })
        .eq('simplified', simplified)
        .select('*', { count: 'exact', head: true });
      if (error) {
        console.error(`  Error for ${simplified}:`, error.message);
      } else if (count === 0) {
        notFound++;
      } else {
        updated += count;
      }
    }));

    if ((i + BATCH) % 1000 === 0 || i + BATCH >= entries.length) {
      console.log(`  ${Math.min(i + BATCH, entries.length)} / ${entries.length} words processed`);
    }
  }

  console.log(`\n  Updated ${updated} entries, ${notFound} words not found in DB.`);

  // Step 3: Verify counts
  console.log('\nStep 3: Verifying counts…');
  const official = { 1: 500, 2: 772, 3: 973, 4: 1000, 5: 1071, 6: 1140, 7: 5636 };
  console.log('\nHSK | DB entries | Official words');
  console.log('----|------------|---------------');
  for (let level = 1; level <= 7; level++) {
    const { count } = await supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('hsk_level', level);
    const off = official[level];
    const match = count >= off ? '✓' : `✗ (missing ${off - count})`;
    console.log(`HSK ${level} | ${String(count ?? '?').padEnd(10)} | ${off} ${match}`);
  }

  console.log('\nDone!');
}

main().catch(console.error);
