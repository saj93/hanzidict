import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function getAllPosts() {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('slug, title, description, category, level, date')
    .order('date', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data;
}

export async function getPost(slug) {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error) throw error;
  return {
    slug: data.slug,
    frontmatter: {
      title:       data.title,
      description: data.description,
      category:    data.category,
      level:       data.level,
      date:        data.date,
    },
    content: data.content ?? '',
  };
}
