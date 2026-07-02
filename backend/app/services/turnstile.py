"""Cloudflare Turnstile server-side token verification for the login form."""

import httpx

from app.core.config import settings

_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


class TurnstileVerificationError(Exception):
    pass


def verify_token(token: str | None, remote_ip: str | None = None) -> None:
    """Raises TurnstileVerificationError if the token is missing or Cloudflare
    rejects it. No-op if TURNSTILE_SECRET_KEY isn't configured, so local dev
    doesn't need real Turnstile keys."""
    if not settings.TURNSTILE_SECRET_KEY:
        return
    if not token:
        raise TurnstileVerificationError("Missing captcha token")

    data = {"secret": settings.TURNSTILE_SECRET_KEY, "response": token}
    if remote_ip:
        data["remoteip"] = remote_ip

    resp = httpx.post(_VERIFY_URL, data=data, timeout=10)
    if resp.status_code != 200 or not resp.json().get("success"):
        raise TurnstileVerificationError("Captcha verification failed")
