-- Cognito access tokens provide a verified `sub`, but not necessarily profile
-- claims. Keep optional profile columns for seeded/admin data without requiring
-- fake values when the API creates a user from an access token.
ALTER TABLE users ALTER COLUMN username DROP NOT NULL;
ALTER TABLE users ALTER COLUMN email_address DROP NOT NULL;
ALTER TABLE users ALTER COLUMN name DROP NOT NULL;

-- Clear the synthetic profile values previously assigned to API-created users.
UPDATE users
SET username = NULL,
    email_address = NULL,
    name = NULL
WHERE email_address LIKE '%@users.invalid';
