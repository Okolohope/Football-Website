BEGIN;

CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organiser_coach_id UUID NOT NULL
        CONSTRAINT eleven_tournaments_v1_organiser_fk
        REFERENCES coaches(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    name TEXT NOT NULL
        CONSTRAINT eleven_tournaments_v1_name_check
        CHECK (
            name = btrim(
                name,
                E' \t\n\r\f' || chr(11)
            )
            AND char_length(name) BETWEEN 2 AND 100
        ),

    description TEXT
        CONSTRAINT eleven_tournaments_v1_description_check
        CHECK (
            description IS NULL
            OR (
                description = btrim(
                    description,
                    E' \t\n\r\f' || chr(11)
                )
                AND char_length(description) <= 2000
            )
        ),

    banner_key TEXT
        CONSTRAINT eleven_tournaments_v1_banner_key_check
        CHECK (
            banner_key IS NULL
            OR (
                banner_key = btrim(
                    banner_key,
                    E' \t\n\r\f' || chr(11)
                )
                AND char_length(banner_key) BETWEEN 1 AND 512
            )
        ),

    location TEXT NOT NULL
        CONSTRAINT eleven_tournaments_v1_location_check
        CHECK (
            location = btrim(
                location,
                E' \t\n\r\f' || chr(11)
            )
            AND char_length(location) BETWEEN 1 AND 120
        ),

    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    registration_deadline DATE NOT NULL,

    age_category TEXT NOT NULL
        CONSTRAINT eleven_tournaments_v1_age_category_check
        CHECK (
            age_category IN (
                'U9',
                'U10',
                'U11',
                'U12',
                'U13',
                'U14',
                'U15',
                'U16',
                'U17',
                'U18',
                'U19',
                'Open / Senior',
                'Mixed / Other'
            )
        ),

    max_teams INTEGER NOT NULL
        CONSTRAINT eleven_tournaments_v1_max_teams_check
        CHECK (max_teams BETWEEN 2 AND 256),

    format TEXT NOT NULL
        CONSTRAINT eleven_tournaments_v1_format_check
        CHECK (
            format IN (
                'League',
                'Knockout',
                'Groups + Knockout'
            )
        ),

    organiser_contact TEXT
        CONSTRAINT eleven_tournaments_v1_organiser_contact_check
        CHECK (
            organiser_contact IS NULL
            OR (
                organiser_contact = btrim(
                    organiser_contact,
                    E' \t\n\r\f' || chr(11)
                )
                AND char_length(organiser_contact) <= 160
            )
        ),

    status TEXT NOT NULL DEFAULT 'draft'
        CONSTRAINT eleven_tournaments_v1_status_check
        CHECK (
            status IN (
                'draft',
                'published',
                'in_progress',
                'completed',
                'archived'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,

    CONSTRAINT eleven_tournaments_v1_dates_check
        CHECK (end_date >= start_date),

    CONSTRAINT eleven_tournaments_v1_registration_deadline_check
        CHECK (registration_deadline <= start_date),

    CONSTRAINT eleven_tournaments_v1_published_timestamp_check
        CHECK (
            (status = 'draft' AND published_at IS NULL)
            OR
            (
                status IN (
                    'published',
                    'in_progress',
                    'completed',
                    'archived'
                )
                AND published_at IS NOT NULL
            )
        )
);

CREATE INDEX eleven_tournaments_v1_organiser_status_idx
    ON tournaments (organiser_coach_id, status);

CREATE INDEX eleven_tournaments_v1_status_idx
    ON tournaments (status);

CREATE INDEX eleven_tournaments_v1_dates_idx
    ON tournaments (start_date, end_date);

CREATE INDEX eleven_tournaments_v1_published_at_idx
    ON tournaments (published_at)
    WHERE published_at IS NOT NULL;

CREATE FUNCTION eleven_tournaments_v1_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'draft' OR NEW.published_at IS NOT NULL THEN
            RAISE EXCEPTION 'tournaments must be created as drafts';
        END IF;
    ELSE
        IF OLD.published_at IS NULL AND NEW.status = 'published' THEN
            NEW.published_at := NOW();
        ELSIF NEW.published_at IS DISTINCT FROM OLD.published_at THEN
            RAISE EXCEPTION 'published_at cannot be changed';
        END IF;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER eleven_tournaments_v1_before_write
BEFORE INSERT OR UPDATE ON tournaments
FOR EACH ROW
EXECUTE FUNCTION eleven_tournaments_v1_before_write();

COMMIT;
