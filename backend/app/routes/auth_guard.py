import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.config import settings


router = APIRouter()


class ProviderCheckRequest(BaseModel):
    email: str
    attempted_provider: str


class ProviderCheckResponse(BaseModel):
    conflict: bool
    existing_provider: str | None = None


def _extract_provider(user: dict) -> str | None:
    """
    Supabase returns provider data in both app_metadata and identities.
    Prefer the first identity provider if present, otherwise fall back to app_metadata.
    """
    identities = user.get("identities") or []
    if identities:
        identity_provider = identities[0].get("provider")
        if identity_provider:
            return identity_provider
    return user.get("app_metadata", {}).get("provider")


@router.post("/auth/provider-check", response_model=ProviderCheckResponse)
async def provider_check(payload: ProviderCheckRequest):
    """
    Verify if an email already exists in Supabase with a different provider.
    Uses the service role key to query the Admin API.
    """
    service_key = settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY
    if not settings.SUPABASE_URL or not service_key:
        raise HTTPException(status_code=500, detail="Supabase service key not configured")

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{settings.SUPABASE_URL}/auth/v1/admin/users",
                params={"email": payload.email},
                headers=headers,
            )

        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail="Failed to query Supabase auth admin API")

        body = response.json()
        users = []
        if isinstance(body, dict):
            # Supabase admin API returns {"users": [...], ...}
            users = body.get("users") or []
        elif isinstance(body, list):
            users = body

        existing_provider = None
        for user in users:
            if user.get("email") == payload.email:
                existing_provider = _extract_provider(user)
                break

        conflict = bool(existing_provider and existing_provider != payload.attempted_provider)

        return ProviderCheckResponse(
            conflict=conflict,
            existing_provider=existing_provider,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Provider check failed: {exc}")

