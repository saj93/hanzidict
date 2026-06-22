-- Add chengyu_priority column for curated ordering of Chengyu of the Day.
-- Run in Supabase Dashboard → SQL Editor → New query

alter table entries
  add column if not exists chengyu_priority integer default null;

-- Curated high-frequency chengyu (priority 1 = shown first in rotation)
update entries set chengyu_priority = 1
where simplified in (
  '一举两得',
  '不可思议',
  '莫名其妙',
  '乱七八糟',
  '半途而废',
  '一帆风顺',
  '入乡随俗',
  '一心一意',
  '一目了然',
  '半斤八两'
)
and is_chengyu = true;
