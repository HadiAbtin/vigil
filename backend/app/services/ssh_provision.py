"""SSH-based node_exporter provisioning + SSH keypair management.

v1 assumes the target's SSH user already has the Vigil-managed public key in its
`authorized_keys` (documented in the UI), and that the SSH user is either root or
has passwordless sudo — interactive sudo-password handling over the SSH channel
is deliberately out of scope for v1.
"""

import base64
import hashlib
import io
from dataclasses import dataclass
from pathlib import Path

import paramiko
from paramiko import AutoAddPolicy, SSHClient

from app.core.config import settings
from app.core.encryption import decrypt_secret

_SCRIPT_PATH = Path(__file__).parent / "scripts" / "install_node_exporter.sh"


class ProvisioningError(Exception):
    pass


@dataclass
class ProvisionResult:
    host_key_fingerprint: str
    log: str


def _fingerprint(key: paramiko.PKey) -> str:
    digest = hashlib.sha256(key.asbytes()).digest()
    return "SHA256:" + base64.b64encode(digest).decode().rstrip("=")


def _load_private_key(pem: str) -> paramiko.PKey:
    for key_cls in (paramiko.Ed25519Key, paramiko.RSAKey, paramiko.ECDSAKey):
        try:
            return key_cls.from_private_key(io.StringIO(pem))
        except (paramiko.SSHException, ValueError):
            continue
    raise ProvisioningError("Unsupported or invalid private key format")


def generate_keypair(label: str) -> tuple[str, str, str]:
    """Generates a fresh RSA-4096 keypair (broadly compatible with every SSH
    server). Returns (private_key_pem, public_key_openssh, fingerprint)."""
    key = paramiko.RSAKey.generate(bits=4096)
    buf = io.StringIO()
    key.write_private_key(buf)
    public_openssh = f"{key.get_name()} {key.get_base64()} vigil-{label}"
    return buf.getvalue(), public_openssh, _fingerprint(key)


def derive_public_key(private_key_pem: str, label: str) -> tuple[str, str]:
    """For admin-pasted private keys. Returns (public_key_openssh, fingerprint)."""
    key = _load_private_key(private_key_pem)
    public_openssh = f"{key.get_name()} {key.get_base64()} vigil-{label}"
    return public_openssh, _fingerprint(key)


def provision_node_exporter(
    *,
    host: str,
    port: int,
    username: str,
    encrypted_private_key: str,
    expected_host_key_fingerprint: str | None,
) -> ProvisionResult:
    pem = decrypt_secret(encrypted_private_key)
    try:
        pkey = _load_private_key(pem)
    finally:
        # Best-effort: drop our only reference to the plaintext key as soon as
        # it's parsed into a paramiko key object, so it's not sitting around
        # for the rest of this (possibly long-running) SSH session. CPython
        # strings are immutable and may already be copied/interned, so this
        # isn't a guaranteed memory wipe — just no reason to hold it longer
        # than necessary.
        del pem

    client = SSHClient()
    client.load_system_host_keys()
    # Trust-on-first-use: we accept whatever host key is offered, then compare
    # its fingerprint against the one we recorded on a prior successful
    # connection (if any) before doing anything further.
    client.set_missing_host_key_policy(AutoAddPolicy())

    try:
        client.connect(
            hostname=host,
            port=port,
            username=username,
            pkey=pkey,
            timeout=15,
            banner_timeout=15,
            auth_timeout=15,
            look_for_keys=False,
            allow_agent=False,
        )
    except Exception as exc:
        raise ProvisioningError(f"SSH connection to {host}:{port} failed: {exc}") from exc

    try:
        transport = client.get_transport()
        if transport is None:
            raise ProvisioningError("SSH transport not established")
        fingerprint = _fingerprint(transport.get_remote_server_key())

        if expected_host_key_fingerprint and fingerprint != expected_host_key_fingerprint:
            raise ProvisioningError(
                f"Host key fingerprint changed for {host} (expected "
                f"{expected_host_key_fingerprint}, got {fingerprint}) — possible "
                "MITM, or the server was reimaged. Re-verify manually before retrying."
            )

        script = _SCRIPT_PATH.read_text()
        # Only invoke sudo when we're actually not root — some minimal server
        # images that are only ever accessed as root don't even have a sudo
        # binary installed, which fails as "command not found" (exit 127) if
        # we ran it unconditionally.
        runner = "bash -s --" if username == "root" else "sudo -n bash -s --"
        command = f"{runner} {settings.NODE_EXPORTER_VERSION} {settings.NODE_EXPORTER_PORT}"
        stdin, stdout, stderr = client.exec_command(command, timeout=180)
        stdin.write(script)
        stdin.channel.shutdown_write()
        out = stdout.read().decode(errors="replace")
        err = stderr.read().decode(errors="replace")
        exit_code = stdout.channel.recv_exit_status()

        log = out + (("\n" + err) if err else "")
        if exit_code != 0 or "VIGIL_INSTALL_OK" not in out:
            hint = ""
            if exit_code == 127:
                hint = (
                    " sudo lacks passwordless privileges, or isn't installed on the target."
                    if runner.startswith("sudo")
                    else " bash may be missing or not on PATH for this user on the target."
                )
            raise ProvisioningError(f"Install script failed (exit {exit_code}).{hint} Output:\n{log}")

        return ProvisionResult(host_key_fingerprint=fingerprint, log=log)
    finally:
        client.close()
