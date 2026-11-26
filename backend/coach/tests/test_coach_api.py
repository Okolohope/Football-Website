from __future__ import annotations

from coach.storage import MAX_BANNER_BYTES, MAX_LOGO_BYTES, ObjectStorage
from coach.schemas import CoachOnboardingInput, SquadCreateInput
from coach.main import create_app
from coach.config import Settings
from coach.routes import _upload_logo
import asyncio
from contextlib import contextmanager
from io import BytesIO
import os
from datetime import UTC, datetime, timedelta
from unittest.mock import Mock
from uuid import UUID, uuid4

import jwt
import psycopg
import pytest
from botocore.exceptions import ClientError
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import UploadFile
from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.datastructures import Headers
from coach.auth import AuthenticatedUser, get_current_user
from coach.routes import get_pool, get_storage

os.environ.update(
    {
        "DATABASE_URL": "postgresql://test:test@127.0.0.1/test",
        "CLERK_ISSUER_URL": "https://clerk.example.test",
        "FRONTEND_ORIGIN": "http://127.0.0.1:5173",
        "AWS_ENDPOINT_URL_S3": "https://storage.example.test",
        "COACH_STORAGE_BUCKET": "test-bucket",
        "AWS_REGION": "us-east-1",
        "AWS_ACCESS_KEY_ID": "test-access-key",
        "AWS_SECRET_ACCESS_KEY": "test-secret-key",
    }
)


@pytest.fixture
def settings() -> Settings:
    return Settings(
        _env_file=None,
        database_url="postgresql://test:test@127.0.0.1/test",
        clerk_issuer_url="https://clerk.example.test",
        frontend_origin="http://127.0.0.1:5173",
        aws_endpoint_url_s3="https://storage.example.test",
        coach_storage_bucket="coach-logos",
        coach_tournament_storage_bucket="tournament-banners",
        aws_region="us-east-1",
        aws_access_key_id="test-access-key",
        aws_secret_access_key="test-secret-key",
    )


@pytest.fixture
def client(settings: Settings):
    app = create_app(settings, initialize_services=False)
    with TestClient(app) as test_client:
        yield test_client


def test_health_check_does_not_claim_database_readiness(client: TestClient) -> None:
    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "coach-api"}


def test_coach_profile_requires_a_bearer_token(client: TestClient) -> None:
    response = client.get("/api/coaches/me")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize(
    ("method", "path", "kwargs"),
    [
        ("GET", "/api/coaches/me", {}),
        ("GET", "/api/coaches/squads", {}),
        (
            "POST",
            "/api/coaches/squads",
            {
                "json": {
                    "teamName": "ELEVN FC",
                    "cityLocation": "Abuja",
                    "homeGroundPitch": "City stadium",
                    "ageGroup": "U13",
                }
            },
        ),
        (
            "POST",
            "/api/coaches/onboarding",
            {
                "data": {
                    "fullName": "Coach Example",
                    "dateOfBirth": "1990-01-15",
                    "teamName": "ELEVN FC",
                    "cityLocation": "Abuja",
                    "homeGroundPitch": "City stadium",
                    "ageGroup": "U13",
                }
            },
        ),
    ],
)
def test_all_coach_data_endpoints_require_authentication(
    client: TestClient,
    method: str,
    path: str,
    kwargs: dict,
) -> None:
    response = client.request(method, path, **kwargs)

    assert response.status_code == 401


class FakeDatabaseResult:
    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows

    def fetchone(self) -> dict | None:
        return self.rows[0] if self.rows else None

    def fetchall(self) -> list[dict]:
        return self.rows


class FakeS3Client:
    def __init__(self) -> None:
        self.uploads: list[dict] = []
        self.deletes: list[dict] = []
        self.signing_requests: list[dict] = []
        self.fail_delete = False
        self.database: FakeTournamentDatabase | None = None
        self.database_banner_keys_at_delete: list[str | None] = []

    def put_object(self, **kwargs: object) -> None:
        self.uploads.append(kwargs)

    def delete_object(self, **kwargs: object) -> None:
        self.deletes.append(kwargs)
        if self.database is not None:
            tournament_id = UUID(str(kwargs["Key"]).split("/")[1])
            row = self.database.tournaments.get(tournament_id)
            self.database_banner_keys_at_delete.append(
                row["banner_key"] if row else None)
        if self.fail_delete:
            raise ClientError(
                {"Error": {"Code": "AccessDenied", "Message": "denied"}},
                "DeleteObject",
            )

    def generate_presigned_url(
        self,
        operation_name: str,
        *,
        Params: dict,
        ExpiresIn: int,
    ) -> str:
        self.signing_requests.append(
            {
                "operation_name": operation_name,
                "params": Params,
                "expires_in": ExpiresIn,
            }
        )
        return (
            f"https://storage.example.test/signed/{Params['Bucket']}/"
            f"{Params['Key']}"
        )


class FakeTournamentDatabase:
    def __init__(self) -> None:
        self.coach_ids = {
            "user_test_coach": uuid4(),
            "user_other_coach": uuid4(),
        }
        self.tournaments: dict[object, dict] = {}
        self.fail_banner_update = False

    @contextmanager
    def connection(self):
        yield self

    def execute(self, query: str, params: tuple = ()) -> FakeDatabaseResult:
        statement = " ".join(query.split())
        now = datetime.now(UTC)

        if "FROM coaches WHERE clerk_user_id = %s" in statement:
            coach_id = self.coach_ids.get(params[0])
            return FakeDatabaseResult([{"id": coach_id}] if coach_id else [])

        if statement.startswith("INSERT INTO tournaments"):
            (
                coach_id,
                name,
                description,
                location,
                start_date,
                end_date,
                registration_deadline,
                age_category,
                max_teams,
                tournament_format,
                organiser_contact,
            ) = params
            row = {
                "id": uuid4(),
                "organiser_coach_id": coach_id,
                "name": name,
                "description": description,
                "banner_key": None,
                "location": location,
                "start_date": start_date,
                "end_date": end_date,
                "registration_deadline": registration_deadline,
                "age_category": age_category,
                "max_teams": max_teams,
                "format": tournament_format,
                "organiser_contact": organiser_contact,
                "status": "draft",
                "created_at": now,
                "updated_at": now,
                "published_at": None,
            }
            self.tournaments[row["id"]] = row
            return FakeDatabaseResult([row])

        if statement.startswith("SELECT id, status, banner_key FROM tournaments"):
            tournament_id, coach_id = params
            row = self.tournaments.get(tournament_id)
            if not row or row["organiser_coach_id"] != coach_id:
                return FakeDatabaseResult([])
            return FakeDatabaseResult([{
                key: row[key]
                for key in ("id", "status", "banner_key")
            }])

        if statement.startswith("SELECT * FROM tournaments") and "ORDER BY" in statement:
            coach_id = params[0]
            rows = [
                row for row in self.tournaments.values()
                if row["organiser_coach_id"] == coach_id
            ]
            return FakeDatabaseResult(rows)

        if statement.startswith("SELECT id, status, start_date, end_date"):
            tournament_id, coach_id = params
            row = self.tournaments.get(tournament_id)
            if not row or row["organiser_coach_id"] != coach_id:
                return FakeDatabaseResult([])
            return FakeDatabaseResult([{
                key: row[key]
                for key in ("id", "status", "start_date", "end_date", "registration_deadline")
            }])

        if statement.startswith("SELECT * FROM tournaments"):
            tournament_id, coach_id = params
            row = self.tournaments.get(tournament_id)
            if not row or row["organiser_coach_id"] != coach_id:
                return FakeDatabaseResult([])
            return FakeDatabaseResult([row])

        if statement.startswith("UPDATE tournaments SET status = 'published'"):
            tournament_id, coach_id = params
            row = self.tournaments.get(tournament_id)
            if (
                not row
                or row["organiser_coach_id"] != coach_id
                or row["status"] != "draft"
            ):
                return FakeDatabaseResult([])
            row["status"] = "published"
            row["published_at"] = now
            row["updated_at"] = now
            return FakeDatabaseResult([row])

        if statement.startswith("UPDATE tournaments SET banner_key = %s"):
            if self.fail_banner_update:
                raise psycopg.OperationalError("simulated banner update failure")
            banner_key, tournament_id, coach_id = params
            row = self.tournaments.get(tournament_id)
            if (
                not row
                or row["organiser_coach_id"] != coach_id
                or row["status"] != "draft"
            ):
                return FakeDatabaseResult([])
            row["banner_key"] = banner_key
            row["updated_at"] = now
            return FakeDatabaseResult([row])

        if statement.startswith("UPDATE tournaments"):
            set_clause = statement.split(" SET ", 1)[1].split(" WHERE ", 1)[0]
            columns = [assignment.split(" = ", 1)[0] for assignment in set_clause.split(", ")]
            values = params[:len(columns)]
            tournament_id, coach_id = params[-2:]
            row = self.tournaments.get(tournament_id)
            if (
                not row
                or row["organiser_coach_id"] != coach_id
                or row["status"] != "draft"
            ):
                return FakeDatabaseResult([])
            row.update(dict(zip(columns, values)))
            row["updated_at"] = now
            return FakeDatabaseResult([row])

        if statement.startswith("SELECT id FROM tournaments"):
            tournament_id, coach_id = params
            row = self.tournaments.get(tournament_id)
            if not row or row["organiser_coach_id"] != coach_id:
                return FakeDatabaseResult([])
            return FakeDatabaseResult([{"id": row["id"]}])

        raise AssertionError(f"Unexpected SQL in isolated test: {statement}")


@pytest.fixture
def tournament_test_client(settings: Settings, monkeypatch: pytest.MonkeyPatch):
    database = FakeTournamentDatabase()
    s3_client = FakeS3Client()
    s3_client.database = database
    monkeypatch.setattr(
        "coach.storage.boto3.client",
        Mock(return_value=s3_client),
    )
    storage = ObjectStorage(settings)
    app = create_app(settings, initialize_services=False)
    auth_state = {"clerk_user_id": "user_test_coach"}
    app.dependency_overrides[get_pool] = lambda: database
    app.dependency_overrides[get_storage] = lambda: storage
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(
        clerk_user_id=auth_state["clerk_user_id"]
    )
    app.state.test_s3_client = s3_client
    with TestClient(app) as test_client:
        yield test_client, database, auth_state


def _tournament_payload(**overrides: object) -> dict:
    payload = {
        "name": "ELEVN Youth Cup",
        "description": "Tournament rules",
        "location": "Abuja",
        "startDate": "2030-07-10",
        "endDate": "2030-07-12",
        "registrationDeadline": "2030-07-01",
        "ageCategory": "U13",
        "maxTeams": 16,
        "format": "League",
        "organizerContact": "organiser@example.test",
    }
    return {**payload, **overrides}


def test_tournament_create_list_and_retrieve_are_persistent_and_owner_scoped(
    tournament_test_client,
) -> None:
    client, _database, _auth_state = tournament_test_client

    created = client.post("/api/coaches/tournaments", json=_tournament_payload())
    assert created.status_code == 201
    created_body = created.json()
    assert created_body["status"] == "draft"
    assert created_body["organizerContact"] == "organiser@example.test"
    assert "organiserCoachId" not in created_body

    tournament_id = created_body["id"]
    listed = client.get("/api/coaches/tournaments")
    retrieved = client.get(f"/api/coaches/tournaments/{tournament_id}")

    assert listed.status_code == 200
    assert [row["id"] for row in listed.json()] == [tournament_id]
    assert retrieved.status_code == 200
    assert retrieved.json()["id"] == tournament_id
    assert created_body["bannerUrl"] is None
    assert listed.json()[0]["bannerUrl"] is None
    assert retrieved.json()["bannerUrl"] is None


def test_tournament_banner_upload_updates_key_and_returns_signed_urls(
    tournament_test_client,
) -> None:
    client, database, _auth_state = tournament_test_client
    created = client.post("/api/coaches/tournaments", json=_tournament_payload())
    tournament_id = created.json()["id"]

    uploaded = client.post(
        f"/api/coaches/tournaments/{tournament_id}/banner",
        files={"banner": ("banner.png", b"\x89PNG\r\n\x1a\nimage", "image/png")},
    )

    assert uploaded.status_code == 200
    body = uploaded.json()
    key = body["bannerKey"]
    assert key.startswith(f"tournaments/{tournament_id}/banners/")
    assert body["bannerUrl"] == (
        f"https://storage.example.test/signed/tournament-banners/{key}"
    )
    assert database.tournaments[UUID(tournament_id)]["banner_key"] == key
    storage_client = client.app.state.test_s3_client
    assert storage_client.uploads[0]["Bucket"] == "tournament-banners"
    assert storage_client.uploads[0]["ContentType"] == "image/png"
    assert "ACL" not in storage_client.uploads[0]
    assert storage_client.signing_requests[0] == {
        "operation_name": "get_object",
        "params": {"Bucket": "tournament-banners", "Key": key},
        "expires_in": 900,
    }

    listed = client.get("/api/coaches/tournaments").json()[0]
    retrieved = client.get(f"/api/coaches/tournaments/{tournament_id}").json()
    assert listed["bannerKey"] == key
    assert retrieved["bannerKey"] == key
    assert listed["bannerUrl"] == body["bannerUrl"]
    assert retrieved["bannerUrl"] == body["bannerUrl"]


@pytest.mark.parametrize(
    ("image_kind", "expected_detail"),
    [
        ("invalid", "Choose a valid JPEG, PNG, or WebP image"),
        (
            "oversized",
            "The tournament banner must be 5 MB or smaller",
        ),
    ],
    ids=["invalid-signature", "oversized"],
)
def test_tournament_banner_rejects_invalid_or_oversized_images(
    tournament_test_client,
    image_kind: str,
    expected_detail: str,
) -> None:
    client, _database, _auth_state = tournament_test_client
    created = client.post("/api/coaches/tournaments", json=_tournament_payload())
    content = (
        b"not an image"
        if image_kind == "invalid"
        else b"\x89PNG\r\n\x1a\n" + b"x" * MAX_BANNER_BYTES
    )

    response = client.post(
        f"/api/coaches/tournaments/{created.json()['id']}/banner",
        files={"banner": ("banner.png", content, "image/png")},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == expected_detail
    assert client.app.state.test_s3_client.uploads == []


def test_failed_banner_database_update_cleans_up_new_object(
    tournament_test_client,
) -> None:
    client, database, _auth_state = tournament_test_client
    created = client.post("/api/coaches/tournaments", json=_tournament_payload())
    tournament_id = created.json()["id"]
    database.fail_banner_update = True

    response = client.post(
        f"/api/coaches/tournaments/{tournament_id}/banner",
        files={"banner": ("banner.png", b"\x89PNG\r\n\x1a\nimage", "image/png")},
    )

    storage_client = client.app.state.test_s3_client
    assert response.status_code == 503
    assert database.tournaments[UUID(tournament_id)]["banner_key"] is None
    assert len(storage_client.uploads) == 1
    assert storage_client.deletes[0]["Bucket"] == "tournament-banners"
    assert storage_client.deletes[0]["Key"] == storage_client.uploads[0]["Key"]
    assert storage_client.database_banner_keys_at_delete == [None]


def test_banner_replacement_saves_new_key_before_deleting_old_object(
    tournament_test_client,
) -> None:
    client, database, _auth_state = tournament_test_client
    created = client.post("/api/coaches/tournaments", json=_tournament_payload())
    tournament_id = created.json()["id"]
    path = f"/api/coaches/tournaments/{tournament_id}/banner"
    first = client.post(
        path,
        files={"banner": ("first.png", b"\x89PNG\r\n\x1a\nfirst", "image/png")},
    )
    old_key = first.json()["bannerKey"]

    second = client.post(
        path,
        files={"banner": ("second.jpg", b"\xff\xd8\xffsecond", "image/jpeg")},
    )

    new_key = second.json()["bannerKey"]
    storage_client = client.app.state.test_s3_client
    assert second.status_code == 200
    assert new_key != old_key
    assert database.tournaments[UUID(tournament_id)]["banner_key"] == new_key
    assert storage_client.deletes == [
        {"Bucket": "tournament-banners", "Key": old_key}
    ]
    assert storage_client.database_banner_keys_at_delete == [new_key]


def test_failed_old_banner_deletion_does_not_fail_replacement(
    tournament_test_client,
) -> None:
    client, database, _auth_state = tournament_test_client
    created = client.post("/api/coaches/tournaments", json=_tournament_payload())
    tournament_id = created.json()["id"]
    path = f"/api/coaches/tournaments/{tournament_id}/banner"
    first = client.post(
        path,
        files={"banner": ("first.png", b"\x89PNG\r\n\x1a\nfirst", "image/png")},
    )
    storage_client = client.app.state.test_s3_client
    storage_client.fail_delete = True

    second = client.post(
        path,
        files={"banner": ("second.png", b"\x89PNG\r\n\x1a\nsecond", "image/png")},
    )

    assert second.status_code == 200
    assert second.json()["bannerKey"] == database.tournaments[
        UUID(tournament_id)
    ]["banner_key"]
    assert second.json()["bannerKey"] != first.json()["bannerKey"]


@pytest.mark.parametrize("method", ["get", "patch", "post", "banner"])
def test_other_coach_cannot_read_edit_or_publish_tournament(
    tournament_test_client,
    method: str,
) -> None:
    client, _database, auth_state = tournament_test_client
    created = client.post("/api/coaches/tournaments", json=_tournament_payload())
    tournament_id = created.json()["id"]
    auth_state["clerk_user_id"] = "user_other_coach"

    if method == "get":
        response = client.get(f"/api/coaches/tournaments/{tournament_id}")
    elif method == "patch":
        response = client.patch(
            f"/api/coaches/tournaments/{tournament_id}",
            json={"name": "Other coach edit"},
        )
    elif method == "banner":
        response = client.post(
            f"/api/coaches/tournaments/{tournament_id}/banner",
            files={"banner": ("banner.png", b"\x89PNG\r\n\x1a\nimage", "image/png")},
        )
    else:
        response = client.post(
            f"/api/coaches/tournaments/{tournament_id}/publish",
        )

    assert response.status_code == 404


def test_tournament_list_contains_only_authenticated_coachs_records(
    tournament_test_client,
) -> None:
    client, _database, auth_state = tournament_test_client
    owned = client.post("/api/coaches/tournaments", json=_tournament_payload())
    auth_state["clerk_user_id"] = "user_other_coach"
    other = client.post(
        "/api/coaches/tournaments",
        json=_tournament_payload(name="Other Cup"),
    )

    assert owned.status_code == 201
    assert other.status_code == 201
    assert [row["name"] for row in client.get("/api/coaches/tournaments").json()] == [
        "Other Cup"
    ]


def test_tournament_patch_edits_draft_and_trims_optional_text(
    tournament_test_client,
) -> None:
    client, _database, _auth_state = tournament_test_client
    created = client.post("/api/coaches/tournaments", json=_tournament_payload())

    updated = client.patch(
        f"/api/coaches/tournaments/{created.json()['id']}",
        json={"name": "  Updated Cup  ", "description": "  ", "maxTeams": 24},
    )

    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated Cup"
    assert updated.json()["description"] is None
    assert updated.json()["maxTeams"] == 24
    assert updated.json()["publishedAt"] is None


def test_tournament_patch_rejects_date_combinations_invalid_with_existing_values(
    tournament_test_client,
) -> None:
    client, _database, _auth_state = tournament_test_client
    created = client.post("/api/coaches/tournaments", json=_tournament_payload())

    response = client.patch(
        f"/api/coaches/tournaments/{created.json()['id']}",
        json={"startDate": "2030-07-13"},
    )

    assert response.status_code == 422


@pytest.mark.parametrize("tournament_status", ["published", "in_progress", "completed", "archived"])
def test_non_draft_tournaments_cannot_be_edited(
    tournament_test_client,
    tournament_status: str,
) -> None:
    client, database, _auth_state = tournament_test_client
    created = client.post("/api/coaches/tournaments", json=_tournament_payload())
    tournament = database.tournaments[UUID(created.json()["id"])]
    tournament["status"] = tournament_status
    tournament["published_at"] = datetime.now(UTC)

    response = client.patch(
        f"/api/coaches/tournaments/{created.json()['id']}",
        json={"name": "Not editable"},
    )

    assert response.status_code == 409


def test_tournament_publish_sets_status_once_and_rejects_republication(
    tournament_test_client,
) -> None:
    client, database, _auth_state = tournament_test_client
    created = client.post("/api/coaches/tournaments", json=_tournament_payload())
    tournament_id = created.json()["id"]

    published = client.post(f"/api/coaches/tournaments/{tournament_id}/publish")
    republished = client.post(f"/api/coaches/tournaments/{tournament_id}/publish")

    assert published.status_code == 200
    assert published.json()["status"] == "published"
    assert published.json()["publishedAt"] is not None
    assert database.tournaments[UUID(tournament_id)]["published_at"] is not None
    assert republished.status_code == 409


@pytest.mark.parametrize("tournament_status", ["published", "in_progress", "completed", "archived"])
def test_non_draft_tournaments_cannot_be_published(
    tournament_test_client,
    tournament_status: str,
) -> None:
    client, database, _auth_state = tournament_test_client
    created = client.post("/api/coaches/tournaments", json=_tournament_payload())
    tournament = database.tournaments[UUID(created.json()["id"])]
    tournament["status"] = tournament_status
    tournament["published_at"] = datetime.now(UTC)

    response = client.post(
        f"/api/coaches/tournaments/{created.json()['id']}/publish"
    )

    assert response.status_code == 409


@pytest.mark.parametrize(
    "overrides",
    [
        {"name": "   "},
        {"location": "   "},
        {"endDate": "2030-07-09"},
        {"registrationDeadline": "2030-07-11"},
        {"maxTeams": 1},
        {"maxTeams": 257},
        {"maxTeams": 2.5},
        {"format": "league"},
        {"ageCategory": "U20"},
        {"status": "published"},
        {"organiserCoachId": "00000000-0000-0000-0000-000000000001"},
    ],
)
def test_tournament_create_rejects_invalid_or_untrusted_fields(
    tournament_test_client,
    overrides: dict,
) -> None:
    client, _database, _auth_state = tournament_test_client

    response = client.post(
        "/api/coaches/tournaments",
        json=_tournament_payload(**overrides),
    )

    assert response.status_code == 422


@pytest.mark.parametrize("payload", [{}, {"status": "published"}, {"name": None}])
def test_tournament_patch_rejects_empty_unknown_or_null_required_fields(
    tournament_test_client,
    payload: dict,
) -> None:
    client, _database, _auth_state = tournament_test_client
    created = client.post("/api/coaches/tournaments", json=_tournament_payload())

    response = client.patch(
        f"/api/coaches/tournaments/{created.json()['id']}",
        json=payload,
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "path,method,kwargs",
    [
        ("/api/coaches/tournaments", "GET", {}),
        ("/api/coaches/tournaments", "POST", {"json": _tournament_payload()}),
        (
            "/api/coaches/tournaments/00000000-0000-0000-0000-000000000001",
            "PATCH",
            {"json": {"name": "Changed"}},
        ),
        (
            "/api/coaches/tournaments/00000000-0000-0000-0000-000000000001/publish",
            "POST",
            {},
        ),
        (
            "/api/coaches/tournaments/00000000-0000-0000-0000-000000000001/banner",
            "POST",
            {
                "files": {
                    "banner": (
                        "banner.png",
                        b"\x89PNG\r\n\x1a\nimage",
                        "image/png",
                    )
                }
            },
        ),
    ],
)
def test_tournament_routes_require_authentication(
    client: TestClient,
    path: str,
    method: str,
    kwargs: dict,
) -> None:
    response = client.request(method, path, **kwargs)

    assert response.status_code == 401


def test_tournament_route_rejects_invalid_clerk_token(
    client: TestClient,
    settings: Settings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class InvalidJwksClient:
        def get_signing_key_from_jwt(self, _token: str) -> None:
            raise jwt.PyJWKClientError("invalid test token")

    monkeypatch.setattr("coach.auth.get_settings", lambda: settings)
    monkeypatch.setattr(
        "coach.auth._jwks_client",
        lambda _issuer: InvalidJwksClient(),
    )

    response = client.get(
        "/api/coaches/tournaments",
        headers={"Authorization": "Bearer invalid-token"},
    )

    assert response.status_code == 401


def test_cors_allows_patch_for_the_configured_frontend_origin(
    client: TestClient,
) -> None:
    response = client.options(
        "/api/coaches/tournaments/00000000-0000-0000-0000-000000000001",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "PATCH",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
    assert "PATCH" in response.headers["access-control-allow-methods"]


def test_valid_clerk_token_passes_authentication_before_database_access(
    client: TestClient,
    settings: Settings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    private_key = rsa.generate_private_key(
        public_exponent=65537, key_size=2048)

    class SigningKey:
        key = private_key.public_key()

    class JwksClient:
        def get_signing_key_from_jwt(self, _token: str) -> SigningKey:
            return SigningKey()

    monkeypatch.setattr("coach.auth.get_settings", lambda: settings)
    monkeypatch.setattr("coach.auth._jwks_client",
                        lambda _issuer: JwksClient())
    token = jwt.encode(
        {
            "iss": settings.clerk_issuer,
            "sub": "user_test_coach",
            "azp": settings.frontend_origin,
            "exp": datetime.now(UTC) + timedelta(minutes=5),
        },
        private_key,
        algorithm="RS256",
    )

    response = client.get(
        "/api/coaches/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 503
    assert response.json()["detail"] == "Coach database is not configured"

    wrong_origin_token = jwt.encode(
        {
            "iss": settings.clerk_issuer,
            "sub": "user_test_coach",
            "azp": "http://untrusted.example",
            "exp": datetime.now(UTC) + timedelta(minutes=5),
        },
        private_key,
        algorithm="RS256",
    )
    rejected = client.get(
        "/api/coaches/me",
        headers={"Authorization": f"Bearer {wrong_origin_token}"},
    )
    assert rejected.status_code == 401


def test_coach_onboarding_schema_accepts_frontend_fields_and_rejects_owner_ids() -> None:
    payload = CoachOnboardingInput.model_validate(
        {
            "fullName": "  Coach Example  ",
            "dateOfBirth": "1990-01-15",
            "teamName": "ELEVN FC",
            "cityLocation": "Abuja",
            "homeGroundPitch": "City stadium",
            "ageGroup": "OPEN_SENIOR",
        }
    )

    assert payload.full_name == "Coach Example"
    assert payload.age_group.value == "OPEN_SENIOR"
    with pytest.raises(ValidationError):
        CoachOnboardingInput.model_validate(
            {
                "fullName": "   ",
                "dateOfBirth": "1990-01-15",
                "teamName": "ELEVN FC",
                "cityLocation": "Abuja",
                "homeGroundPitch": "City stadium",
                "ageGroup": "U13",
            }
        )
    with pytest.raises(ValidationError):
        CoachOnboardingInput.model_validate(
            {
                "fullName": "Coach Example",
                "dateOfBirth": "1990-01-15",
                "teamName": "ELEVN FC",
                "cityLocation": "Abuja",
                "homeGroundPitch": "City stadium",
                "ageGroup": "U13",
                "clerkUserId": "user_attacker_supplied",
            }
        )


def test_squad_schema_rejects_unsupported_age_group() -> None:
    with pytest.raises(ValidationError):
        SquadCreateInput.model_validate(
            {
                "teamName": "ELEVN FC",
                "cityLocation": "Abuja",
                "homeGroundPitch": "City stadium",
                "ageGroup": "OPEN",
            }
        )


def test_storage_checks_image_signatures() -> None:
    assert ObjectStorage._image_type(b"\xff\xd8\xffimage")[0] == "image/jpeg"
    assert ObjectStorage._image_type(b"\x89PNG\r\n\x1a\nimage")[
        0] == "image/png"
    assert ObjectStorage._image_type(b"RIFF1234WEBPimage")[0] == "image/webp"
    with pytest.raises(ValueError):
        ObjectStorage._image_type(b"not an image")


def test_settings_read_exact_storage_environment_names(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AWS_ENDPOINT_URL_S3", "https://storage.example.test")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "test-access-key")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "test-secret-key")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.setenv("COACH_STORAGE_BUCKET", "coach-logos")
    monkeypatch.setenv(
        "COACH_TOURNAMENT_STORAGE_BUCKET", "tournament-banners")
    settings = Settings(
        _env_file=None,
        database_url="******127.0.0.1/test",
        clerk_issuer_url="https://clerk.example.test",
        frontend_origin="http://127.0.0.1:5173",
    )

    assert str(settings.aws_endpoint_url_s3) == "https://storage.example.test/"
    assert settings.aws_access_key_id.get_secret_value() == "test-access-key"
    assert settings.aws_secret_access_key.get_secret_value() == "test-secret-key"
    assert settings.aws_region == "us-east-1"
    assert settings.coach_storage_bucket == "coach-logos"
    assert settings.coach_tournament_storage_bucket == "tournament-banners"
    assert settings.storage_is_configured


def test_storage_uploads_to_private_bucket_and_signs_the_stored_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeS3Client:
        def __init__(self) -> None:
            self.uploads: list[dict] = []
            self.signing_requests: list[dict] = []

        def put_object(self, **kwargs: object) -> None:
            self.uploads.append(kwargs)

        def generate_presigned_url(
            self,
            operation_name: str,
            *,
            Params: dict,
            ExpiresIn: int,
        ) -> str:
            self.signing_requests.append(
                {
                    "operation_name": operation_name,
                    "params": Params,
                    "expires_in": ExpiresIn,
                }
            )
            return "https://storage.example.test/signed-logo"

    fake_client = FakeS3Client()
    monkeypatch.setattr(
        "coach.storage.boto3.client",
        Mock(return_value=fake_client),
    )
    settings = Settings(
        _env_file=None,
        database_url="******127.0.0.1/test",
        clerk_issuer_url="https://clerk.example.test",
        frontend_origin="http://127.0.0.1:5173",
        aws_endpoint_url_s3="https://storage.example.test",
        aws_access_key_id="test-access-key",
        aws_secret_access_key="test-secret-key",
        aws_region="us-east-1",
        coach_storage_bucket="coach-logos",
    )
    storage = ObjectStorage(settings)
    logo = UploadFile(
        file=BytesIO(b"\x89PNG\r\n\x1a\nlogo"),
        filename="logo.png",
        headers=Headers({"content-type": "image/png"}),
    )

    key = asyncio.run(storage.upload_logo(logo, "user_test_coach"))
    signed_url = asyncio.run(storage.signed_url(key))

    assert key.startswith("coach-logos/user_test_coach/")
    assert fake_client.uploads[0]["Key"] == key
    assert fake_client.uploads[0]["Bucket"] == "coach-logos"
    assert fake_client.uploads[0]["ContentType"] == "image/png"
    assert "ACL" not in fake_client.uploads[0]
    assert signed_url == "https://storage.example.test/signed-logo"
    assert fake_client.signing_requests == [
        {
            "operation_name": "get_object",
            "params": {"Bucket": "coach-logos", "Key": key},
            "expires_in": 900,
        }
    ]


def test_storage_rejects_oversized_logo_before_upload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeS3Client:
        def put_object(self, **kwargs: object) -> None:
            pytest.fail(
                f"Oversized logos must not be uploaded: {tuple(kwargs)}")

    monkeypatch.setattr(
        "coach.storage.boto3.client",
        Mock(return_value=FakeS3Client()),
    )
    settings = Settings(
        _env_file=None,
        database_url="******127.0.0.1/test",
        clerk_issuer_url="https://clerk.example.test",
        frontend_origin="http://127.0.0.1:5173",
        aws_endpoint_url_s3="https://storage.example.test",
        aws_access_key_id="test-access-key",
        aws_secret_access_key="test-secret-key",
        aws_region="us-east-1",
        coach_storage_bucket="coach-logos",
    )
    storage = ObjectStorage(settings)
    logo = UploadFile(
        file=BytesIO(b"\x89PNG\r\n\x1a\n" + b"x" * (2 * 1024 * 1024)),
        filename="large.png",
        headers=Headers({"content-type": "image/png"}),
    )

    with pytest.raises(ValueError, match="2 MB or smaller"):
        asyncio.run(storage.upload_logo(logo, "user_test_coach"))


def test_storage_accepts_logo_at_2mb_limit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_client = Mock()
    monkeypatch.setattr(
        "coach.storage.boto3.client",
        Mock(return_value=fake_client),
    )
    settings = Settings(
        _env_file=None,
        database_url="******127.0.0.1/test",
        clerk_issuer_url="https://clerk.example.test",
        frontend_origin="http://127.0.0.1:5173",
        aws_endpoint_url_s3="https://storage.example.test",
        aws_access_key_id="test-access-key",
        aws_secret_access_key="test-secret-key",
        aws_region="us-east-1",
        coach_storage_bucket="coach-logos",
    )
    storage = ObjectStorage(settings)
    logo = UploadFile(
        file=BytesIO(b"\x89PNG\r\n\x1a\n" + b"x" * (MAX_LOGO_BYTES - 8)),
        filename="limit.png",
        headers=Headers({"content-type": "image/png"}),
    )

    asyncio.run(storage.upload_logo(logo, "user_test_coach"))

    assert fake_client.put_object.call_args.kwargs["ContentLength"] == MAX_LOGO_BYTES


def test_onboarding_logo_is_optional() -> None:
    assert asyncio.run(_upload_logo(None, "user_test_coach", None)) is None


def test_cors_allows_only_the_configured_frontend_origin(client: TestClient) -> None:
    response = client.options(
        "/api/coaches/me",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"

    rejected = client.options(
        "/api/coaches/me",
        headers={
            "Origin": "http://untrusted.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert rejected.status_code == 400
    assert "access-control-allow-origin" not in rejected.headers
