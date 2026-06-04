-- Run once in Supabase SQL Editor
-- Returns counts of entries per HSK level for the stats display

CREATE OR REPLACE FUNCTION get_hsk_counts()
RETURNS TABLE (hsk_level integer, count bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT hsk_level, COUNT(*) AS count
  FROM entries
  WHERE hsk_level IS NOT NULL
  GROUP BY hsk_level
  ORDER BY hsk_level;
$$;
