-- Cache for fetched YouTube transcripts (so we don't re-pay the provider per video).
CREATE TABLE IF NOT EXISTS youtube_transcripts (
  video_id text PRIMARY KEY,
  transcript text,
  language text,
  provider text,
  fetched_at timestamptz DEFAULT now()
);

ALTER TABLE youtube_transcripts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow all for authenticated" ON youtube_transcripts
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
