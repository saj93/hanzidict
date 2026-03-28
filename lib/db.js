import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function searchEntries(query) {
  const result = await client.execute({
    sql: `SELECT * FROM entries 
          WHERE simplified LIKE ? 
          OR traditional LIKE ? 
          OR pinyin LIKE ? 
          OR definitions LIKE ?
          LIMIT 20`,
    args: [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`],
  });
  return result.rows;
}

export async function getEntry(simplified) {
  const result = await client.execute({
    sql: `SELECT * FROM entries WHERE simplified = ? OR traditional = ? LIMIT 1`,
    args: [simplified, simplified],
  });
  return result.rows[0] || null;
}