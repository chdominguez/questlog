-- User-course unlocks hold the lesson version they paid for; an edited lesson needs a new unlock.
ALTER TABLE narration_unlocks ADD COLUMN version TEXT;
