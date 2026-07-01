import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet

from app.core.config import settings


def _derive_fernet_key(secret: str) -> bytes:
    """Fernet requires a 32-byte urlsafe-base64 key. Rather than force operators
    to hand-generate one correctly, derive it deterministically from whatever
    secret they set — a plain passphrase works just as well as a real Fernet key."""
    digest = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)


@lru_cache
def _fernet() -> Fernet:
    return Fernet(_derive_fernet_key(settings.FERNET_SECRET))


def encrypt_secret(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    return _fernet().decrypt(ciphertext.encode()).decode()
