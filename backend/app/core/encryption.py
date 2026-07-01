import base64
from functools import lru_cache

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.core.config import settings

# Fixed, application-specific salt for turning FERNET_SECRET into an actual
# encryption key. This has to stay constant across restarts — SSH private
# keys and Telegram bot tokens already encrypted with it would otherwise
# become permanently undecryptable. That's fine here: unlike password
# hashing (many independent secrets, salted individually to stop rainbow
# tables across users), this derives exactly one key for the whole
# deployment from exactly one secret. The salt's job is just to make PBKDF2
# well-formed; the actual defense against a weak FERNET_SECRET is the
# iteration count below.
_KDF_SALT = b"vigil-fernet-kdf-v1"
_KDF_ITERATIONS = 600_000  # OWASP floor for PBKDF2-HMAC-SHA256 (2023+ guidance)


def _derive_fernet_key(secret: str) -> bytes:
    """Fernet requires a 32-byte urlsafe-base64 key. Rather than force operators
    to hand-generate one correctly, derive it from whatever they set in
    FERNET_SECRET — run through PBKDF2 at a high iteration count so a short or
    guessable secret still costs real, deliberate work to brute-force, instead
    of a single fast hash."""
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=_KDF_SALT, iterations=_KDF_ITERATIONS)
    return base64.urlsafe_b64encode(kdf.derive(secret.encode()))


@lru_cache
def _fernet() -> Fernet:
    return Fernet(_derive_fernet_key(settings.FERNET_SECRET))


def encrypt_secret(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    return _fernet().decrypt(ciphertext.encode()).decode()
