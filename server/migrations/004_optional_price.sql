-- Beta mode has no money, so an idea does not need a price.
ALTER TABLE ideas ALTER COLUMN price_paise DROP NOT NULL;
ALTER TABLE ideas DROP CONSTRAINT IF EXISTS ideas_price_paise_check;
ALTER TABLE ideas ADD CONSTRAINT ideas_price_paise_check CHECK (price_paise IS NULL OR price_paise > 0);
