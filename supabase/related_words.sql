-- Run once in Supabase SQL Editor
CREATE OR REPLACE FUNCTION get_related_words(query_simplified text, excluded_simplified text)
RETURNS TABLE (
  simplified text,
  traditional text,
  pinyin text,
  definitions text,
  hsk_level integer
)
LANGUAGE sql
STABLE
AS $$
  -- HSK words sharing at least one character, random order, limit 5
  WITH chars AS (
    SELECT regexp_split_to_table(query_simplified, '') AS ch
  ),
  hsk_matches AS (
    SELECT DISTINCT e.simplified, e.traditional, e.pinyin, e.definitions, e.hsk_level
    FROM entries e
    JOIN chars c ON e.simplified LIKE '%' || c.ch || '%'
    WHERE e.simplified != excluded_simplified
      AND e.hsk_level IS NOT NULL
    ORDER BY random()
    LIMIT 5
  ),
  fallback AS (
    SELECT DISTINCT e.simplified, e.traditional, e.pinyin, e.definitions, e.hsk_level
    FROM entries e
    JOIN chars c ON e.simplified LIKE '%' || c.ch || '%'
    WHERE e.simplified != excluded_simplified
      AND e.hsk_level IS NULL
      AND e.simplified NOT IN (SELECT simplified FROM hsk_matches)
    ORDER BY random()
    LIMIT (5 - (SELECT COUNT(*) FROM hsk_matches))
  )
  SELECT * FROM hsk_matches
  UNION ALL
  SELECT * FROM fallback;
$$;
