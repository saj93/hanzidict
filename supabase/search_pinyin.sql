-- Run this once in the Supabase SQL editor.
-- Creates an RPC function used by the pinyin search path in db.js.

CREATE OR REPLACE FUNCTION search_pinyin_normalized(query_normalized text)
RETURNS SETOF entries
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM entries
  WHERE regexp_replace(lower(pinyin), '[1-5 ]', '', 'g') ILIKE '%' || query_normalized || '%'
  ORDER BY
    CASE
      WHEN regexp_replace(lower(pinyin), '[1-5 ]', '', 'g') = query_normalized THEN 0
      ELSE 1
    END,
    COALESCE(hsk_level, 999),
    length(simplified)
  LIMIT 20;
$$;
