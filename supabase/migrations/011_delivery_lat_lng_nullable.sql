-- lat/lng on deliveries are optional at creation (driver GPS fills them in later)
ALTER TABLE deliveries
  ALTER COLUMN lat DROP NOT NULL,
  ALTER COLUMN lng DROP NOT NULL;
