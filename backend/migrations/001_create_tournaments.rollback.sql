-- DESTRUCTIVE ROLLBACK:
-- This permanently deletes every row in tournaments, along with the table's
-- indexes and constraints. Back up and review the target database before use.
-- No CASCADE is used; rollback will fail if later tables reference tournaments.

BEGIN;

DROP TRIGGER IF EXISTS eleven_tournaments_v1_before_write
    ON tournaments;

DROP TABLE tournaments;

DROP FUNCTION eleven_tournaments_v1_before_write();

COMMIT;
