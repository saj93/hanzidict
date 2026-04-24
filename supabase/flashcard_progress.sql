-- Flashcard progress table for SM-2 spaced repetition
CREATE TABLE flashcard_progress (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  simplified TEXT NOT NULL,
  hsk_level INTEGER,
  ease_factor FLOAT DEFAULT 2.5,
  interval INTEGER DEFAULT 1,
  due_date TIMESTAMP DEFAULT NOW(),
  reviews INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, simplified)
);

CREATE INDEX fp_user_idx ON flashcard_progress(user_id);
CREATE INDEX fp_due_idx ON flashcard_progress(user_id, due_date);

-- Row Level Security: users can only see/edit their own rows
ALTER TABLE flashcard_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own progress"
  ON flashcard_progress
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
