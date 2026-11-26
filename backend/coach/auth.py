from dataclasses import dataclass
from functools import lru_cache
from urllib.error import URLError

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient, PyJWKClientConnectionError, PyJWKClientError

from .config import get_settings


@dataclass(frozen=True)
class AuthenticatedUser:
    clerk_user_id: str


bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache(maxsize=4)
def _jwks_client(issuer: str) -> PyJWKClient:
    return PyJWKClient(
        f"{issuer}/.well-known/jwks.json",
        cache_jwk_set=True,
        lifespan=300,
        timeout=5,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid Clerk session token is required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    settings = get_settings()
    issuer = settings.clerk_issuer
    try:
        signing_key = _jwks_client(issuer).get_signing_key_from_jwt(
            credentials.credentials)
        claims = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["RS256"],
            issuer=issuer,
            options={"require": ["exp", "sub"]},
        )
    except PyJWKClientConnectionError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Clerk token verification is temporarily unavailable",
        ) from error
    except (PyJWKClientError, jwt.PyJWTError, URLError, TimeoutError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The Clerk session token is invalid or expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error

    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject or len(subject) > 128:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The Clerk session token has an invalid subject",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if claims.get("azp") != settings.frontend_origin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The Clerk session token was not issued for this frontend",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return AuthenticatedUser(clerk_user_id=subject)
