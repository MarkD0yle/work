-- Full-text index for the Entity Picker: description and issuer search over 1,000,000 securities.
-- It is an external-content index over `securities`; the seed rebuilds it after loading.
CREATE VIRTUAL TABLE securities_fts USING fts5(description, issuer, content='securities', content_rowid='rowid', prefix='2 3 4');
