import logging
from typing import Annotated
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from psycopg.errors import UniqueViolation, UndefinedTable
from psycopg_pool import ConnectionPool, PoolTimeout
from pydantic import ValidationError

from .auth import AuthenticatedUser, get_current_user
from .database import transaction
from .schemas import (
    CoachMeResult,
    CoachOnboardingInput,
    CoachProfile,
    OnboardingResult,
    Squad,
    SquadCreateInput,
    Tournament,
    TournamentCreateInput,
    TournamentUpdateInput,
)
from .storage import MAX_BANNER_BYTES, ObjectStorage, StorageUnavailable


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/coaches", tags=["coaches"])


def get_pool(request: Request) -> ConnectionPool:
    pool = getattr(request.app.state, "db_pool", None)
    if pool is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Coach database is not configured",
        )
    return pool


def get_storage(request: Request) -> ObjectStorage | None:
    return getattr(request.app.state, "object_storage", None)


def get_tournament_storage_bucket(request: Request) -> str | None:
    settings = getattr(request.app.state, "settings", None)
    return getattr(settings, "coach_tournament_storage_bucket", None)


async def _signed_squad(row: dict, storage: ObjectStorage | None) -> Squad:
    logo_url = None
    if row["team_logo_key"] and storage is not None:
        logo_url = await storage.signed_url(row["team_logo_key"])
    return Squad.model_validate({**row, "team_logo_url": logo_url})


async def _signed_tournament(
    row: dict,
    storage: ObjectStorage | None,
    bucket: str | None,
) -> Tournament:
    banner_url = None
    if row["banner_key"]:
        if storage is None or bucket is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Tournament banner storage is not configured",
            )
        try:
            banner_url = await storage.signed_url_for(bucket, row["banner_key"])
        except StorageUnavailable as error:
            logger.error("Could not create a tournament banner URL", exc_info=error)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Tournament banner links are temporarily unavailable",
            ) from error
    return Tournament.model_validate({**row, "banner_url": banner_url})


def _database_unavailable(error: Exception) -> HTTPException:
    logger.error("Coach database operation failed", exc_info=error)
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Coach data is temporarily unavailable. Confirm the coach schema has been installed.",
    )


def _tournament_database_unavailable(error: Exception) -> HTTPException:
    logger.error("Tournament database operation failed", exc_info=error)
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Tournament data is temporarily unavailable.",
    )


def _get_authenticated_coach_id(connection, clerk_user_id: str):
    coach_row = connection.execute(
        "SELECT id FROM coaches WHERE clerk_user_id = %s",
        (clerk_user_id,),
    ).fetchone()
    if not coach_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coach profile not found",
        )
    return coach_row["id"]


@router.post(
    "/tournaments",
    response_model=Tournament,
    status_code=status.HTTP_201_CREATED,
)
async def create_tournament(
    payload: TournamentCreateInput,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    pool: Annotated[ConnectionPool, Depends(get_pool)],
    storage: Annotated[ObjectStorage | None, Depends(get_storage)],
    bucket: Annotated[str | None, Depends(get_tournament_storage_bucket)],
) -> Tournament:
    try:
        with transaction(pool) as connection:
            coach_id = _get_authenticated_coach_id(
                connection, current_user.clerk_user_id)
            row = connection.execute(
                """
                INSERT INTO tournaments (
                    organiser_coach_id, name, description, banner_key, location,
                    start_date, end_date, registration_deadline, age_category,
                    max_teams, format, organiser_contact, status
                )
                VALUES (%s, %s, %s, NULL, %s, %s, %s, %s, %s, %s, %s, %s, 'draft')
                RETURNING *
                """,
                (
                    coach_id,
                    payload.name,
                    payload.description,
                    payload.location,
                    payload.start_date,
                    payload.end_date,
                    payload.registration_deadline,
                    payload.age_category.value,
                    payload.max_teams,
                    payload.format.value,
                    payload.organiser_contact,
                ),
            ).fetchone()
        return await _signed_tournament(row, storage, bucket)
    except HTTPException:
        raise
    except (UndefinedTable, PoolTimeout, psycopg.OperationalError, psycopg.DatabaseError) as error:
        raise _tournament_database_unavailable(error) from error


@router.get("/tournaments", response_model=list[Tournament])
async def list_tournaments(
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    pool: Annotated[ConnectionPool, Depends(get_pool)],
    storage: Annotated[ObjectStorage | None, Depends(get_storage)],
    bucket: Annotated[str | None, Depends(get_tournament_storage_bucket)],
) -> list[Tournament]:
    try:
        with transaction(pool) as connection:
            coach_id = _get_authenticated_coach_id(
                connection, current_user.clerk_user_id)
            rows = connection.execute(
                """
                SELECT *
                FROM tournaments
                WHERE organiser_coach_id = %s
                ORDER BY created_at DESC, id
                """,
                (coach_id,),
            ).fetchall()
        return [await _signed_tournament(row, storage, bucket) for row in rows]
    except HTTPException:
        raise
    except (UndefinedTable, PoolTimeout, psycopg.OperationalError, psycopg.DatabaseError) as error:
        raise _tournament_database_unavailable(error) from error


@router.get("/tournaments/{tournament_id}", response_model=Tournament)
async def get_tournament(
    tournament_id: UUID,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    pool: Annotated[ConnectionPool, Depends(get_pool)],
    storage: Annotated[ObjectStorage | None, Depends(get_storage)],
    bucket: Annotated[str | None, Depends(get_tournament_storage_bucket)],
) -> Tournament:
    try:
        with transaction(pool) as connection:
            coach_id = _get_authenticated_coach_id(
                connection, current_user.clerk_user_id)
            row = connection.execute(
                """
                SELECT *
                FROM tournaments
                WHERE id = %s AND organiser_coach_id = %s
                """,
                (tournament_id, coach_id),
            ).fetchone()
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Tournament not found",
                )
        return await _signed_tournament(row, storage, bucket)
    except HTTPException:
        raise
    except (UndefinedTable, PoolTimeout, psycopg.OperationalError, psycopg.DatabaseError) as error:
        raise _tournament_database_unavailable(error) from error


@router.patch("/tournaments/{tournament_id}", response_model=Tournament)
async def update_tournament(
    tournament_id: UUID,
    payload: TournamentUpdateInput,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    pool: Annotated[ConnectionPool, Depends(get_pool)],
    storage: Annotated[ObjectStorage | None, Depends(get_storage)],
    bucket: Annotated[str | None, Depends(get_tournament_storage_bucket)],
) -> Tournament:
    column_names = {
        "name": "name",
        "description": "description",
        "location": "location",
        "start_date": "start_date",
        "end_date": "end_date",
        "registration_deadline": "registration_deadline",
        "age_category": "age_category",
        "max_teams": "max_teams",
        "format": "format",
        "organiser_contact": "organiser_contact",
    }

    try:
        with transaction(pool) as connection:
            coach_id = _get_authenticated_coach_id(
                connection, current_user.clerk_user_id)
            existing = connection.execute(
                """
                SELECT id, status, start_date, end_date, registration_deadline
                FROM tournaments
                WHERE id = %s AND organiser_coach_id = %s
                FOR UPDATE
                """,
                (tournament_id, coach_id),
            ).fetchone()
            if not existing:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Tournament not found",
                )
            if existing["status"] != "draft":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Only draft tournaments can be edited",
                )

            changes = payload.model_dump(exclude_unset=True)
            resulting_dates = {
                "start_date": existing["start_date"],
                "end_date": existing["end_date"],
                "registration_deadline": existing["registration_deadline"],
            }
            resulting_dates.update({
                key: value for key, value in changes.items()
                if key in resulting_dates
            })
            if resulting_dates["end_date"] < resulting_dates["start_date"]:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="endDate must be on or after startDate",
                )
            if resulting_dates["registration_deadline"] > resulting_dates["start_date"]:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="registrationDeadline must be on or before startDate",
                )

            values = []
            assignments = []
            for field_name, value in changes.items():
                column_name = column_names[field_name]
                if hasattr(value, "value"):
                    value = value.value
                assignments.append(f"{column_name} = %s")
                values.append(value)
            values.extend((tournament_id, coach_id))
            row = connection.execute(
                f"""
                UPDATE tournaments
                SET {", ".join(assignments)}
                WHERE id = %s
                  AND organiser_coach_id = %s
                  AND status = 'draft'
                RETURNING *
                """,
                tuple(values),
            ).fetchone()
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Only draft tournaments can be edited",
                )
        return await _signed_tournament(row, storage, bucket)
    except HTTPException:
        raise
    except (UndefinedTable, PoolTimeout, psycopg.OperationalError, psycopg.DatabaseError) as error:
        raise _tournament_database_unavailable(error) from error


@router.post(
    "/tournaments/{tournament_id}/publish",
    response_model=Tournament,
)
async def publish_tournament(
    tournament_id: UUID,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    pool: Annotated[ConnectionPool, Depends(get_pool)],
    storage: Annotated[ObjectStorage | None, Depends(get_storage)],
    bucket: Annotated[str | None, Depends(get_tournament_storage_bucket)],
) -> Tournament:
    try:
        with transaction(pool) as connection:
            coach_id = _get_authenticated_coach_id(
                connection, current_user.clerk_user_id)
            row = connection.execute(
                """
                UPDATE tournaments
                SET status = 'published'
                WHERE id = %s
                  AND organiser_coach_id = %s
                  AND status = 'draft'
                RETURNING *
                """,
                (tournament_id, coach_id),
            ).fetchone()
            if not row:
                existing = connection.execute(
                    """
                    SELECT id
                    FROM tournaments
                    WHERE id = %s AND organiser_coach_id = %s
                    """,
                    (tournament_id, coach_id),
                ).fetchone()
                if not existing:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Tournament not found",
                    )
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Only draft tournaments can be published",
                )
        return await _signed_tournament(row, storage, bucket)
    except HTTPException:
        raise
    except (UndefinedTable, PoolTimeout, psycopg.OperationalError, psycopg.DatabaseError) as error:
        raise _tournament_database_unavailable(error) from error


@router.post(
    "/tournaments/{tournament_id}/banner",
    response_model=Tournament,
)
async def upload_tournament_banner(
    tournament_id: UUID,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    pool: Annotated[ConnectionPool, Depends(get_pool)],
    storage: Annotated[ObjectStorage | None, Depends(get_storage)],
    bucket: Annotated[str | None, Depends(get_tournament_storage_bucket)],
    banner: Annotated[UploadFile, File()],
) -> Tournament:
    if storage is None or bucket is None:
        await banner.close()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Tournament banner storage is not configured",
        )

    try:
        with transaction(pool) as connection:
            coach_id = _get_authenticated_coach_id(
                connection, current_user.clerk_user_id)
            existing = connection.execute(
                """
                SELECT id, status, banner_key
                FROM tournaments
                WHERE id = %s AND organiser_coach_id = %s
                """,
                (tournament_id, coach_id),
            ).fetchone()
            if not existing:
                await banner.close()
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Tournament not found",
                )
            if existing["status"] != "draft":
                await banner.close()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Only draft tournaments can be edited",
                )
    except HTTPException:
        raise
    except (UndefinedTable, PoolTimeout, psycopg.OperationalError, psycopg.DatabaseError) as error:
        await banner.close()
        raise _tournament_database_unavailable(error) from error

    try:
        new_key = await storage.upload_image(
            bucket=bucket,
            file=banner,
            key_prefix=f"tournaments/{tournament_id}/banners",
            max_bytes=MAX_BANNER_BYTES,
            size_error="The tournament banner must be 5 MB or smaller",
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    except StorageUnavailable as error:
        logger.error("Tournament banner upload failed", exc_info=error)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The tournament banner could not be uploaded",
        ) from error

    try:
        with transaction(pool) as connection:
            coach_id = _get_authenticated_coach_id(
                connection, current_user.clerk_user_id)
            locked = connection.execute(
                """
                SELECT id, status, banner_key
                FROM tournaments
                WHERE id = %s AND organiser_coach_id = %s
                FOR UPDATE
                """,
                (tournament_id, coach_id),
            ).fetchone()
            if not locked:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Tournament not found",
                )
            if locked["status"] != "draft":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Only draft tournaments can be edited",
                )
            old_key = locked["banner_key"]
            row = connection.execute(
                """
                UPDATE tournaments
                SET banner_key = %s
                WHERE id = %s
                  AND organiser_coach_id = %s
                  AND status = 'draft'
                RETURNING *
                """,
                (new_key, tournament_id, coach_id),
            ).fetchone()
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Only draft tournaments can be edited",
                )
    except HTTPException:
        await _cleanup_tournament_banner(new_key, bucket, storage)
        raise
    except (UndefinedTable, PoolTimeout, psycopg.OperationalError, psycopg.DatabaseError) as error:
        await _cleanup_tournament_banner(new_key, bucket, storage)
        raise _tournament_database_unavailable(error) from error

    if old_key and old_key != new_key:
        await _cleanup_tournament_banner(old_key, bucket, storage)
    return await _signed_tournament(row, storage, bucket)


async def _upload_logo(
    logo: UploadFile | None,
    user_id: str,
    storage: ObjectStorage | None,
) -> str | None:
    if logo is None:
        return None
    if storage is None:
        await logo.close()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Coach logo storage is not configured",
        )
    try:
        return await storage.upload_logo(logo, user_id)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    except StorageUnavailable as error:
        logger.error("Coach logo upload failed", exc_info=error)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The team logo could not be uploaded",
        ) from error


async def _cleanup_logo(key: str | None, storage: ObjectStorage | None) -> None:
    if not key or storage is None:
        return
    try:
        await storage.delete_logo(key)
    except StorageUnavailable as error:
        logger.error("Could not clean up an unlinked coach logo",
                     exc_info=error)


async def _cleanup_tournament_banner(
    key: str | None,
    bucket: str,
    storage: ObjectStorage,
) -> None:
    if not key:
        return
    try:
        await storage.delete_object(bucket, key)
    except StorageUnavailable as error:
        logger.error("Could not clean up a tournament banner object",
                     exc_info=error)


@router.post(
    "/onboarding",
    response_model=OnboardingResult,
    status_code=status.HTTP_201_CREATED,
)
async def onboard_coach(
    full_name: Annotated[str, Form(alias="fullName")],
    date_of_birth: Annotated[str, Form(alias="dateOfBirth")],
    team_name: Annotated[str, Form(alias="teamName")],
    city_location: Annotated[str, Form(alias="cityLocation")],
    home_ground_pitch: Annotated[str, Form(alias="homeGroundPitch")],
    age_group: Annotated[str, Form(alias="ageGroup")],
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    pool: Annotated[ConnectionPool, Depends(get_pool)],
    storage: Annotated[ObjectStorage | None, Depends(get_storage)],
    team_logo: Annotated[UploadFile | None, File(alias="teamLogo")] = None,
) -> OnboardingResult:
    try:
        payload = CoachOnboardingInput.model_validate(
            {
                "fullName": full_name,
                "dateOfBirth": date_of_birth,
                "teamName": team_name,
                "cityLocation": city_location,
                "homeGroundPitch": home_ground_pitch,
                "ageGroup": age_group,
            }
        )
    except ValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error.errors(
                include_url=False,
                include_context=False,
                include_input=False,
            ),
        ) from error

    logo_key = await _upload_logo(team_logo, current_user.clerk_user_id, storage)
    try:
        with transaction(pool) as connection:
            existing = connection.execute(
                "SELECT id FROM coaches WHERE clerk_user_id = %s",
                (current_user.clerk_user_id,),
            ).fetchone()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This Clerk account already has a coach profile",
                )

            coach_row = connection.execute(
                """
                INSERT INTO coaches (clerk_user_id, full_name, date_of_birth)
                VALUES (%s, %s, %s)
                RETURNING id, full_name, date_of_birth, created_at
                """,
                (current_user.clerk_user_id,
                 payload.full_name, payload.date_of_birth),
            ).fetchone()
            squad_row = connection.execute(
                """
                INSERT INTO squads (
                    coach_id, team_name, city_location, home_ground_pitch,
                    team_logo_key, age_group
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, team_name, city_location, home_ground_pitch,
                          team_logo_key, age_group, created_at
                """,
                (
                    coach_row["id"],
                    payload.team_name,
                    payload.city_location,
                    payload.home_ground_pitch,
                    logo_key,
                    payload.age_group.value,
                ),
            ).fetchone()
    except HTTPException:
        await _cleanup_logo(logo_key, storage)
        raise
    except UniqueViolation as error:
        await _cleanup_logo(logo_key, storage)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This Clerk account already has a coach profile",
        ) from error
    except (UndefinedTable, PoolTimeout, psycopg.OperationalError, psycopg.DatabaseError) as error:
        await _cleanup_logo(logo_key, storage)
        raise _database_unavailable(error) from error

    try:
        squad = await _signed_squad(squad_row, storage)
    except StorageUnavailable as error:
        logger.error("Could not create a team logo URL", exc_info=error)
        squad = Squad.model_validate({**squad_row, "team_logo_url": None})
    return OnboardingResult(coach=CoachProfile.model_validate(coach_row), squad=squad)


@router.get("/me", response_model=CoachMeResult)
async def get_my_coach_profile(
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    pool: Annotated[ConnectionPool, Depends(get_pool)],
    storage: Annotated[ObjectStorage | None, Depends(get_storage)],
) -> CoachMeResult:
    try:
        with transaction(pool) as connection:
            coach_row = connection.execute(
                """
                SELECT id, full_name, date_of_birth, created_at
                FROM coaches WHERE clerk_user_id = %s
                """,
                (current_user.clerk_user_id,),
            ).fetchone()
            if not coach_row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Coach profile not found")
            squad_rows = connection.execute(
                """
                SELECT id, team_name, city_location, home_ground_pitch,
                       team_logo_key, age_group, created_at
                FROM squads WHERE coach_id = %s ORDER BY created_at, id
                """,
                (coach_row["id"],),
            ).fetchall()
        squads = [await _signed_squad(row, storage) for row in squad_rows]
        return CoachMeResult(coach=CoachProfile.model_validate(coach_row), squads=squads)
    except HTTPException:
        raise
    except StorageUnavailable as error:
        logger.error("Could not create a team logo URL", exc_info=error)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Team logo links are temporarily unavailable",
        ) from error
    except (UndefinedTable, PoolTimeout, psycopg.OperationalError, psycopg.DatabaseError) as error:
        raise _database_unavailable(error) from error


@router.post("/squads", response_model=Squad, status_code=status.HTTP_201_CREATED)
def create_squad(
    payload: SquadCreateInput,
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    pool: Annotated[ConnectionPool, Depends(get_pool)],
) -> Squad:
    try:
        with transaction(pool) as connection:
            coach_row = connection.execute(
                "SELECT id FROM coaches WHERE clerk_user_id = %s",
                (current_user.clerk_user_id,),
            ).fetchone()
            if not coach_row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Complete coach onboarding first")
            row = connection.execute(
                """
                INSERT INTO squads (coach_id, team_name, city_location, home_ground_pitch, age_group)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, team_name, city_location, home_ground_pitch,
                          team_logo_key, age_group, created_at
                """,
                (
                    coach_row["id"],
                    payload.team_name,
                    payload.city_location,
                    payload.home_ground_pitch,
                    payload.age_group.value,
                ),
            ).fetchone()
        return Squad.model_validate({**row, "team_logo_url": None})
    except HTTPException:
        raise
    except (UndefinedTable, PoolTimeout, psycopg.OperationalError, psycopg.DatabaseError) as error:
        raise _database_unavailable(error) from error


@router.get("/squads", response_model=list[Squad])
async def get_my_squads(
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    pool: Annotated[ConnectionPool, Depends(get_pool)],
    storage: Annotated[ObjectStorage | None, Depends(get_storage)],
) -> list[Squad]:
    try:
        with transaction(pool) as connection:
            coach_row = connection.execute(
                "SELECT id FROM coaches WHERE clerk_user_id = %s",
                (current_user.clerk_user_id,),
            ).fetchone()
            if not coach_row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Coach profile not found")
            rows = connection.execute(
                """
                SELECT id, team_name, city_location, home_ground_pitch,
                       team_logo_key, age_group, created_at
                FROM squads WHERE coach_id = %s ORDER BY created_at, id
                """,
                (coach_row["id"],),
            ).fetchall()
        return [await _signed_squad(row, storage) for row in rows]
    except HTTPException:
        raise
    except StorageUnavailable as error:
        logger.error("Could not create a team logo URL", exc_info=error)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Team logo links are temporarily unavailable",
        ) from error
    except (UndefinedTable, PoolTimeout, psycopg.OperationalError, psycopg.DatabaseError) as error:
        raise _database_unavailable(error) from error
