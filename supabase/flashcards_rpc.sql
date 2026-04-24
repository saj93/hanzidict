-- Random words for a given HSK level (used by flashcard API)
CREATE OR REPLACE FUNCTION get_random_hsk_words(p_hsk_level integer, p_limit integer)
RETURNS TABLE (simplified text, traditional text, pinyin text, definitions text, hsk_level integer)
LANGUAGE sql STABLE AS $$
  SELECT simplified, traditional, pinyin, definitions, hsk_level
  FROM entries
  WHERE hsk_level = p_hsk_level
  ORDER BY random()
  LIMIT p_limit;
$$;
