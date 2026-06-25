-- Run this once in the Supabase SQL editor to redeploy.
-- Fixes: LIMIT 20 was too low; frequency_rank now used as tiebreaker so
-- common words (好, 是...) with null HSK don't fall below rarer tagged entries.

CREATE OR REPLACE FUNCTION search_pinyin_normalized(query_normalized text)
RETURNS SETOF entries
LANGUAGE sql
STABLE
SET search_path = public
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
    COALESCE(frequency_rank, 999999),
    length(simplified)
  LIMIT 200;
$$;
