import { createClient } from '@libsql/client';
import { createReadStream } from 'fs';
import * as readline from 'readline';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Récupère le nombre d'entrées déjà importées
const result = await client.execute('SELECT COUNT(*) as count FROM entries');
const alreadyImported = result.rows[0].count;
console.log(`Déjà importé : ${alreadyImported} entrées, on reprend depuis là.`);

const filePath = process.env.CEDICT_PATH;
const rl = readline.createInterface({ input: createReadStream(filePath) });

let count = 0;
let batch = [];
let skipped = 0;

for await (const line of rl) {
  if (line.startsWith('#') || line.trim() === '') continue;
  const match = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/$/);
  if (!match) continue;

  skipped++;
  if (skipped <= alreadyImported) continue;

  const [, traditional, simplified, pinyin, defsRaw] = match;
  const definitions = defsRaw.split('/').join(' | ');
  batch.push([traditional, simplified, pinyin, definitions]);

  if (batch.length === 500) {
    await insertBatch(batch);
    count += batch.length;
    console.log(`Importé : ${alreadyImported + count} entrées`);
    batch = [];
  }
}

if (batch.length > 0) {
  await insertBatch(batch);
  count += batch.length;
}

console.log(`✓ Import terminé : ${alreadyImported + count} entrées au total`);
await client.close();

async function insertBatch(rows) {
  for (const [traditional, simplified, pinyin, definitions] of rows) {
    await client.execute({
      sql: 'INSERT INTO entries (traditional, simplified, pinyin, definitions) VALUES (?, ?, ?, ?)',
      args: [traditional, simplified, pinyin, definitions],
    });
  }
}