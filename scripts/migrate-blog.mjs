// One-time migration: reads content/blog/*.md and inserts into blog_posts table.
// Usage: node --env-file=.env.local scripts/migrate-blog.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, '..', 'content', 'blog');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const files = fs.readdirSync(BLOG_DIR).filter(f => /\.mdx?$/.test(f));

for (const file of files) {
  const slug = file.replace(/\.mdx?$/, '');
  const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
  const { data, content } = matter(raw);

  const row = {
    slug,
    title:       data.title       ?? slug,
    description: data.description ?? null,
    category:    data.category    ?? null,
    level:       data.level       ?? null,
    date:        data.date        ? String(data.date) : null,
    content:     content.trim(),
  };

  const { error } = await supabase
    .from('blog_posts')
    .upsert(row, { onConflict: 'slug' });

  if (error) {
    console.error(`✗ ${slug}:`, error.message);
  } else {
    console.log(`✓ ${slug}`);
  }
}
