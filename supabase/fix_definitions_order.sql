-- Fix entries where CC-CEDICT lists a rare/archaic meaning first and a common
-- meaning later. Run once in the Supabase SQL editor.
--
-- 号 [hao4]: CEDICT lists "bugle; trumpet" before "ordinal number".
-- "Ordinal number / sign / mark" is the primary modern meaning (号码, 号码, etc.)
UPDATE entries
SET definitions =
  -- move the leading "bugle; trumpet | " to the end
  regexp_replace(definitions, '^bugle; trumpet \| ', '')
  || ' | bugle; trumpet'
WHERE simplified = '号'
  AND definitions LIKE 'bugle; trumpet | %';
