-- Migration 007: Reduce award_type to 3 categories

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tickets'
      AND column_name = 'award_type'
  ) THEN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'award_type_new') THEN
      DROP TYPE award_type_new;
    END IF;

    CREATE TYPE award_type_new AS ENUM (
      'activity_enrichment',
      'creativity_innovation',
      'good_behavior'
    );

    ALTER TABLE tickets
      ALTER COLUMN award_type TYPE award_type_new
      USING (
        CASE award_type::text
          WHEN 'innovation' THEN 'creativity_innovation'::award_type_new
          WHEN 'entrepreneurship' THEN 'creativity_innovation'::award_type_new
          WHEN 'moral_ethics' THEN 'good_behavior'::award_type_new
          ELSE 'activity_enrichment'::award_type_new
        END
      );

    DROP TYPE IF EXISTS award_type;
    ALTER TYPE award_type_new RENAME TO award_type;
  END IF;
END $$;
