
import os
from pathlib import Path

import jwt
from dotenv import load_dotenv

from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

backend_dir = Path(__file__).resolve().parents[2]
load_dotenv(backend_dir / ".env")
load_dotenv(backend_dir.parent / "frontend" / ".env.local")

REGION = os.getenv("COGNITO_REGION", "").strip()
USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "").strip()
CLIENT_ID = os.getenv("COGNITO_CLIENT_ID", "").strip()
ISSUER = os.getenv("COGNITO_ISSUER", "").strip()
if not ISSUER and REGION and USER_POOL_ID:
    ISSUER = f"https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}"
if not ISSUER or not CLIENT_ID:
    raise RuntimeError(
        "Cognito configuration is missing. Set COGNITO_CLIENT_ID and either "
        "COGNITO_ISSUER or both COGNITO_REGION and COGNITO_USER_POOL_ID in backend/.env."
    )

JWKS_URL = f"{ISSUER}/.well-known/jwks.json"

jwks_client = PyJWKClient(JWKS_URL)

security = HTTPBearer()


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    access_token = credentials.credentials

    try:
        signing_key = jwks_client.get_signing_key_from_jwt(access_token)

        payload = jwt.decode(
            access_token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=ISSUER,
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_iss": True,
                "verify_aud": False,
            },
        )

        if payload.get("token_use") != "access":
            raise InvalidTokenError("Not an access token")

        if payload.get("client_id") != CLIENT_ID:
            raise InvalidTokenError("Invalid client")

        return {**payload, "_access_token": access_token}

    except (InvalidTokenError, jwt.PyJWKClientError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )
