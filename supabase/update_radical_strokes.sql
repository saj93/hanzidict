CREATE OR REPLACE FUNCTION bulk_update_radical_strokes(updates JSONB)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE entries e
  SET radical = u.radical,
      stroke_count = u.stroke_count::integer
  FROM jsonb_to_recordset(updates) AS u(id integer, radical text, stroke_count integer)
  WHERE e.id = u.id;
END;
$$;
