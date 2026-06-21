-- Run this in the Supabase SQL editor once
CREATE TABLE IF NOT EXISTS blog_posts (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  slug        text        UNIQUE NOT NULL,
  title       text        NOT NULL,
  description text,
  category    text,
  level       text,
  date        date,
  content     text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
