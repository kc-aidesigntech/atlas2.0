DO $$
DECLARE
  v_enrollee_id uuid;
  v_public_url text := '/assets/portraits/elena-rodriguez.jpeg';
BEGIN
  SELECT e.id
  INTO v_enrollee_id
  FROM atlas.enrollees e
  JOIN atlas.people p ON p.id = e.person_id
  WHERE lower(p.display_name) = 'elena rodriguez'
  LIMIT 1;

  IF v_enrollee_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE atlas.enrollees
  SET avatar_url = v_public_url,
      updated_at = now()
  WHERE id = v_enrollee_id;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'atlas'
      AND table_name = 'profile_images'
  ) THEN
    UPDATE atlas.profile_images
    SET is_primary = false,
        updated_at = now()
    WHERE enrollee_id = v_enrollee_id
      AND is_primary = true;

    INSERT INTO atlas.profile_images (
      enrollee_id,
      storage_bucket,
      storage_path,
      public_url,
      original_filename,
      mime_type,
      intake_source,
      intake_status,
      is_primary,
      alt_text,
      metadata,
      ready_at
    )
    VALUES (
      v_enrollee_id,
      'profile-images',
      'manual/elena-rodriguez.jpeg',
      v_public_url,
      'elena-rodriguez.jpeg',
      'image/jpeg',
      'manual',
      'ready',
      true,
      'Elena Rodriguez profile portrait',
      jsonb_build_object('linked_from', 'local_asset'),
      now()
    )
    ON CONFLICT (storage_path) DO UPDATE
    SET enrollee_id = excluded.enrollee_id,
        public_url = excluded.public_url,
        original_filename = excluded.original_filename,
        mime_type = excluded.mime_type,
        intake_source = excluded.intake_source,
        intake_status = excluded.intake_status,
        is_primary = excluded.is_primary,
        alt_text = excluded.alt_text,
        metadata = excluded.metadata,
        ready_at = excluded.ready_at,
        updated_at = now();
  END IF;
END $$;
