-- Records which event-marking device drove the session's COM triggers, since
-- testing rigs differ: AD Instruments PowerLab + Black Box ToolKit ('AD_BBT'),
-- or Biopac via parallel-port card ('Biopac_Left' / 'Biopac_Right').
-- Adding a column only; existing belt_sessions RLS policies cover all columns.
ALTER TABLE belt_sessions ADD COLUMN IF NOT EXISTS trigger_device text;
