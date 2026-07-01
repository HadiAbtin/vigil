# Security

Vigil holds two categories of material that would be genuinely damaging in
someone else's hands: **SSH private keys** (used to provision `node_exporter`
on your servers) and **Telegram bot tokens**. This document describes,
concretely, what's actually done to protect them — not just that "it's
encrypted."

If you find a vulnerability, please open a private
[GitHub Security Advisory](https://docs.github.com/en/code-security/security-advisories)
on this repository rather than a public issue.

## Secrets at rest

- SSH private keys and Telegram bot tokens are encrypted with
  [Fernet](https://cryptography.io/en/latest/fernet/) (AES-128-CBC +
  HMAC-SHA256, authenticated — a tampered ciphertext fails to decrypt rather
  than silently returning garbage).
- The Fernet key itself is not `FERNET_SECRET` directly — it's derived from
  it via **PBKDF2-HMAC-SHA256 at 600,000 iterations**
  (`backend/app/core/encryption.py`), the current OWASP-recommended floor.
  This means even an operator who sets a short or guessable `FERNET_SECRET`
  gets real, deliberate brute-force cost, not a single fast hash.
- Plaintext secrets are never written to disk. They exist in process memory
  only for as long as they're actively needed (e.g. while paramiko opens an
  SSH connection), and the reference is dropped immediately afterward. This
  is best-effort, not a guarantee — CPython strings are immutable and the
  interpreter may have copied the data before we can drop it, so treat this
  as defense-in-depth, not a cryptographic wipe.

## What the API will and won't give back

- `GET /ssh-keys` and every other list/read endpoint never include key
  material — only the (non-secret) public key and its fingerprint.
- When Vigil **generates** a keypair for you, the private key is returned
  **exactly once**, in the creation response, so you can keep an offline
  copy if you want one. It is never retrievable through the API again.
- When you **import** an existing private key instead, Vigil never echoes
  it back at all — not even once. You already have your own copy.
- Telegram bot tokens are never returned after creation, full stop — the UI
  only ever shows whether a bot is configured, not the token itself.

## SSH provisioning specifically

- **Host key pinning (TOFU):** the first successful connection to a server
  records its SSH host key fingerprint. Every later connection compares
  against it and refuses to proceed if it changed — instead of silently
  trusting whatever key is offered, which is what makes most "just SSH in
  and run a script" tooling MITM-able.
- **Verified downloads:** the `node_exporter` install script checksums the
  downloaded release tarball against the checksums published in that
  release's own `sha256sums.txt` on GitHub before installing anything. A
  mismatch aborts the install rather than running an unverified binary.
- **Least privilege on the target:** `node_exporter` runs as its own
  unprivileged system user, via a systemd unit with `NoNewPrivileges=yes`,
  `ProtectSystem=strict`, and `ProtectHome=yes` — not as root, and not in a
  container with broad host access.
- **No stored root access assumption beyond what's needed:** Vigil documents
  (and expects) passwordless `sudo` scoped to what the install script
  actually runs, not blanket root SSH access as the default recommendation.

## Authentication

- Admin passwords are hashed with bcrypt — never stored or logged in
  plaintext.
- The seeded first-boot admin account is **forced** to change its password
  server-side (every other endpoint rejects requests from an account with
  `must_change_password=True`) — this can't be bypassed by skipping a
  frontend redirect.
- API access uses short-lived JWTs (`ACCESS_TOKEN_EXPIRE_MINUTES`, default
  30 minutes).

## Transport

- The bundled Traefik setup terminates TLS with automatically-renewed
  Let's Encrypt certificates and redirects all HTTP traffic to HTTPS.
  Don't run this in front of a real deployment without it.

## Operator responsibilities

Vigil can't protect you from these — they're on you:

- **Generate real secrets.** `.env.example` includes the exact commands to
  generate `SECRET_KEY` and `FERNET_SECRET`. Don't ship the placeholder
  values.
- **Changing `FERNET_SECRET` after the fact invalidates every secret
  already encrypted with it** (SSH keys, bot tokens) — there's no
  transparent re-encryption/migration path in v1. Treat it as a value you
  set once, back up securely, and don't rotate casually.
- **Restrict `node_exporter`'s port (9100) at the firewall** to only the
  host running Prometheus. Vigil's install script binds it on all
  interfaces (it has to, to be reachable at all) and will attempt a
  best-effort `ufw` rule if `ufw` is present and active, but it cannot
  configure every possible firewall for you.
- **Use a scoped SSH user.** Root SSH access works, but a dedicated user
  with passwordless `sudo` limited to what the provisioning script needs is
  meaningfully safer.

## Known limitations (v1)

Being direct about what's *not* here yet:

- No secrets-manager/HSM/KMS integration — encryption keys live in your
  `.env`.
- No audit log of who did what (single admin account model; multi-user/RBAC
  isn't implemented yet).
- No automated `FERNET_SECRET` rotation/re-encryption tooling.
- No rate limiting on the API yet.
