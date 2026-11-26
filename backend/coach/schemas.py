from datetime import date, datetime
from enum import StrEnum
from typing import Annotated
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator


class AgeGroup(StrEnum):
    U13 = "U13"
    U15 = "U15"
    U17 = "U17"
    OPEN_SENIOR = "OPEN_SENIOR"
    OTHER = "OTHER"


ShortName = Annotated[str, Field(min_length=2, max_length=100)]
Location = Annotated[str, Field(min_length=1, max_length=120)]


class CoachOnboardingInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    full_name: Annotated[str, Field(min_length=2, max_length=80)] = Field(
        validation_alias=AliasChoices("fullName", "full_name"),
        serialization_alias="fullName",
    )
    date_of_birth: date = Field(
        validation_alias=AliasChoices("dateOfBirth", "date_of_birth"),
        serialization_alias="dateOfBirth",
    )
    team_name: ShortName = Field(
        validation_alias=AliasChoices("teamName", "team_name"),
        serialization_alias="teamName",
    )
    city_location: Location = Field(
        validation_alias=AliasChoices("cityLocation", "city_location"),
        serialization_alias="cityLocation",
    )
    home_ground_pitch: Location = Field(
        validation_alias=AliasChoices("homeGroundPitch", "home_ground_pitch"),
        serialization_alias="homeGroundPitch",
    )
    age_group: AgeGroup = Field(
        validation_alias=AliasChoices("ageGroup", "age_group"),
        serialization_alias="ageGroup",
    )

    @field_validator(
        "full_name", "team_name", "city_location", "home_ground_pitch", mode="before"
    )
    @classmethod
    def trim_text_fields(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def date_of_birth_must_not_be_in_future(self) -> "CoachOnboardingInput":
        if self.date_of_birth > date.today():
            raise ValueError("dateOfBirth cannot be in the future")
        return self


class SquadCreateInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    team_name: ShortName = Field(
        validation_alias=AliasChoices("teamName", "team_name"),
        serialization_alias="teamName",
    )
    city_location: Location = Field(
        validation_alias=AliasChoices("cityLocation", "city_location"),
        serialization_alias="cityLocation",
    )
    home_ground_pitch: Location = Field(
        validation_alias=AliasChoices("homeGroundPitch", "home_ground_pitch"),
        serialization_alias="homeGroundPitch",
    )
    age_group: AgeGroup = Field(
        validation_alias=AliasChoices("ageGroup", "age_group"),
        serialization_alias="ageGroup",
    )

    @field_validator("team_name", "city_location", "home_ground_pitch", mode="before")
    @classmethod
    def trim_text_fields(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class CoachProfile(BaseModel):
    id: UUID
    full_name: str = Field(serialization_alias="fullName")
    date_of_birth: date = Field(serialization_alias="dateOfBirth")
    created_at: datetime = Field(serialization_alias="createdAt")


class Squad(BaseModel):
    id: UUID
    team_name: str = Field(serialization_alias="teamName")
    city_location: str = Field(serialization_alias="cityLocation")
    home_ground_pitch: str = Field(serialization_alias="homeGroundPitch")
    team_logo_key: str | None = Field(
        default=None, serialization_alias="teamLogoKey")
    team_logo_url: str | None = Field(
        default=None, serialization_alias="teamLogoUrl")
    age_group: AgeGroup = Field(serialization_alias="ageGroup")
    created_at: datetime = Field(serialization_alias="createdAt")


class OnboardingResult(BaseModel):
    coach: CoachProfile
    squad: Squad


class CoachMeResult(BaseModel):
    coach: CoachProfile
    squads: list[Squad]


class TournamentAgeCategory(StrEnum):
    U9 = "U9"
    U10 = "U10"
    U11 = "U11"
    U12 = "U12"
    U13 = "U13"
    U14 = "U14"
    U15 = "U15"
    U16 = "U16"
    U17 = "U17"
    U18 = "U18"
    U19 = "U19"
    OPEN_SENIOR = "Open / Senior"
    MIXED_OTHER = "Mixed / Other"


class TournamentFormat(StrEnum):
    LEAGUE = "League"
    KNOCKOUT = "Knockout"
    GROUPS_KNOCKOUT = "Groups + Knockout"


class TournamentStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ARCHIVED = "archived"


TournamentName = Annotated[str, Field(min_length=2, max_length=100)]
TournamentLocation = Annotated[str, Field(min_length=1, max_length=120)]
TournamentDescription = Annotated[str | None, Field(max_length=2000)]
TournamentContact = Annotated[str | None, Field(max_length=160)]
TournamentTeamLimit = Annotated[int, Field(strict=True, ge=2, le=256)]


class TournamentCreateInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    name: TournamentName
    description: TournamentDescription = None
    location: TournamentLocation
    start_date: date = Field(
        validation_alias=AliasChoices("startDate", "start_date"),
        serialization_alias="startDate",
    )
    end_date: date = Field(
        validation_alias=AliasChoices("endDate", "end_date"),
        serialization_alias="endDate",
    )
    registration_deadline: date = Field(
        validation_alias=AliasChoices("registrationDeadline", "registration_deadline"),
        serialization_alias="registrationDeadline",
    )
    age_category: TournamentAgeCategory = Field(
        validation_alias=AliasChoices("ageCategory", "age_category"),
        serialization_alias="ageCategory",
    )
    max_teams: TournamentTeamLimit = Field(
        validation_alias=AliasChoices("maxTeams", "max_teams"),
        serialization_alias="maxTeams",
    )
    format: TournamentFormat
    organiser_contact: TournamentContact = Field(
        default=None,
        validation_alias=AliasChoices("organizerContact", "organiser_contact"),
        serialization_alias="organizerContact",
    )

    @field_validator("name", "location", mode="before")
    @classmethod
    def trim_required_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("description", "organiser_contact", mode="before")
    @classmethod
    def trim_optional_text(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value

    @model_validator(mode="after")
    def validate_tournament_dates(self) -> "TournamentCreateInput":
        if self.end_date < self.start_date:
            raise ValueError("endDate must be on or after startDate")
        if self.registration_deadline > self.start_date:
            raise ValueError("registrationDeadline must be on or before startDate")
        return self


class TournamentUpdateInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    name: TournamentName | None = None
    description: TournamentDescription = None
    location: TournamentLocation | None = None
    start_date: date | None = Field(
        default=None,
        validation_alias=AliasChoices("startDate", "start_date"),
        serialization_alias="startDate",
    )
    end_date: date | None = Field(
        default=None,
        validation_alias=AliasChoices("endDate", "end_date"),
        serialization_alias="endDate",
    )
    registration_deadline: date | None = Field(
        default=None,
        validation_alias=AliasChoices("registrationDeadline", "registration_deadline"),
        serialization_alias="registrationDeadline",
    )
    age_category: TournamentAgeCategory | None = Field(
        default=None,
        validation_alias=AliasChoices("ageCategory", "age_category"),
        serialization_alias="ageCategory",
    )
    max_teams: TournamentTeamLimit | None = Field(
        default=None,
        validation_alias=AliasChoices("maxTeams", "max_teams"),
        serialization_alias="maxTeams",
    )
    format: TournamentFormat | None = None
    organiser_contact: TournamentContact = Field(
        default=None,
        validation_alias=AliasChoices("organizerContact", "organiser_contact"),
        serialization_alias="organizerContact",
    )

    @field_validator("name", "location", mode="before")
    @classmethod
    def trim_required_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("description", "organiser_contact", mode="before")
    @classmethod
    def trim_optional_text(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value

    @model_validator(mode="after")
    def validate_patch_fields(self) -> "TournamentUpdateInput":
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        nullable_fields = {"description", "organiser_contact"}
        for field_name in self.model_fields_set - nullable_fields:
            if getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self


class Tournament(BaseModel):
    id: UUID
    name: str
    description: str | None
    banner_key: str | None = Field(serialization_alias="bannerKey")
    banner_url: str | None = Field(default=None, serialization_alias="bannerUrl")
    location: str
    start_date: date = Field(serialization_alias="startDate")
    end_date: date = Field(serialization_alias="endDate")
    registration_deadline: date = Field(serialization_alias="registrationDeadline")
    age_category: TournamentAgeCategory = Field(serialization_alias="ageCategory")
    max_teams: int = Field(serialization_alias="maxTeams")
    format: TournamentFormat
    organiser_contact: str | None = Field(serialization_alias="organizerContact")
    status: TournamentStatus
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")
    published_at: datetime | None = Field(serialization_alias="publishedAt")
