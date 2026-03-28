import { createClient } from '@libsql/client';
import { createReadStream } from 'fs';
import * as readline from 'readline';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const rl = readline.createInterface({
  input: createReadStream('./hsk30-master/hsk30.csv'),
});

let count = 0;
let first = true;

for await (const line of rl) {
  if (first) { first = false; continue; } // skip header
  
  const cols = line.split(',');
  const simplified = cols[1];
  const traditional = cols[2];
  const level = parseInt(cols[5]);

  if (!simplified || !level) continue;

  await client.execute({
    sql: `UPDATE entries SET hsk_level = ? 
          WHERE simplified = ? OR traditional = ?`,
    args: [level, simplified, traditional],
  });

  count++;
  if (count % 100 === 0) console.log(`Mis à jour : ${count} entrées`);
}

console.log(`✓ HSK terminé : ${count} entrées mises à jour`);
await client.close();