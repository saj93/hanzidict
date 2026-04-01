-- Run this once in the Supabase SQL editor.
-- Step 1: Add search_vector column and populate it
ALTER TABLE entries ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE entries SET search_vector =
  setweight(to_tsvector('english', coalesce(definitions, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(simplified, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(traditional, '')), 'B');

CREATE INDEX IF NOT EXISTS entries_search_idx ON entries USING GIN(search_vector);

-- Step 2: RPC function called by db.js for English FTS
CREATE OR REPLACE FUNCTION search_english_fts(query_text text)
RETURNS TABLE (
  simplified text,
  traditional text,
  pinyin text,
  definitions text,
  hsk_level integer,
  ts_rank_val float4
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    simplified, traditional, pinyin, definitions, hsk_level,
    ts_rank(search_vector, plainto_tsquery('english', query_text)) AS ts_rank_val
  FROM entries
  WHERE search_vector @@ plainto_tsquery('english', query_text)
  ORDER BY
    ts_rank(search_vector, plainto_tsquery('english', query_text)) DESC,
    COALESCE(hsk_level, 999) ASC,
    length(simplified) ASC
  LIMIT 20;
$$;
