# ELEVEN Coach API

All coach endpoints require a Clerk bearer token and a user membership with the `COACH` or `ASSISTANT_COACH` role.

## Training

- `POST /api/coach/trainings`
  - Body: `{ "squadId": "UUID or SE-1042", "title": "Tactical Training", "location": "Training Ground", "startsAt": "2026-11-21T09:00:00Z", "endsAt": "2026-11-21T11:00:00Z" }`
- `GET /api/coach/trainings/{sessionId}/attendance`
- `PATCH /api/coach/trainings/{sessionId}/attendance/{playerUuid}`
  - Body: `{ "coachStatus": "VERIFIED_PRESENT" }`
  - Valid values: `VERIFIED_PRESENT`, `VERIFIED_LATE`, `VERIFIED_ABSENT`

## Ratings and Top Eleven

- `POST /api/coach/squads/{squadId}/ratings`
  - Body: `{ "playerUuid": "ELE30015", "matches": 1, "goals": 1, "assists": 0, "rating": 8.4, "coachNotes": "Strong match." }`
- `PATCH /api/coach/squads/{squadId}/top-eleven`
  - Body: `{ "playerUuid": "ELE30015", "topEleven": true }`

## Squad offers

- `POST /api/coach/offers`
  - Body: `{ "playerUuid": "ELE30015", "fromSquadId": "SE-1042", "toSquadId": "SE-1058", "offerType": "LOAN", "loanEndDate": "2027-06-30" }`
  - Valid offer types: `INVITE`, `LOAN`, `PERMANENT_TRANSFER`, `UNIVERSITY_INVITE`
- `PATCH /api/coach/offers/{offerId}/parent-approval`
  - Body: `{ "parentCoachStatus": "APPROVED" }`
  - Valid values: `APPROVED`, `DECLINED`
