#!/usr/bin/env bash
# Idempotent bare-metal node_exporter installer, run remotely over SSH by
# app/services/ssh_provision.py as: sudo -n bash -s -- <version> <port>
#
# Safe to re-run: every step checks current state before acting. Prints
# VIGIL_INSTALL_OK on success as an unambiguous completion marker.
set -euo pipefail

VERSION="${1:?node_exporter version required}"
PORT="${2:?listen port required}"
BIN_PATH="/usr/local/bin/node_exporter"
UNIT_PATH="/etc/systemd/system/node_exporter.service"

echo "[vigil] target version=${VERSION} port=${PORT}"

# --- Fast path: already installed at the right version and running -------
if systemctl is-active --quiet node_exporter 2>/dev/null && [ -x "${BIN_PATH}" ]; then
  CURRENT_VERSION="$("${BIN_PATH}" --version 2>&1 | head -n1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)"
  if [ "${CURRENT_VERSION}" = "${VERSION}" ]; then
    echo "[vigil] node_exporter ${VERSION} already active, nothing to do"
    echo "VIGIL_INSTALL_OK"
    exit 0
  fi
fi

# --- Dedicated system user -------------------------------------------------
if ! id node_exporter >/dev/null 2>&1; then
  echo "[vigil] creating node_exporter system user"
  useradd --system --no-create-home --shell /usr/sbin/nologin node_exporter
else
  echo "[vigil] node_exporter user already exists"
fi

# --- Arch detection ----------------------------------------------------
ARCH="$(uname -m)"
case "${ARCH}" in
  x86_64) NE_ARCH="amd64" ;;
  aarch64|arm64) NE_ARCH="arm64" ;;
  *) echo "[vigil] unsupported architecture: ${ARCH}" >&2; exit 1 ;;
esac

TARBALL="node_exporter-${VERSION}.linux-${NE_ARCH}.tar.gz"
URL="https://github.com/prometheus/node_exporter/releases/download/v${VERSION}/${TARBALL}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "${WORKDIR}"' EXIT

echo "[vigil] downloading ${URL}"
curl -fsSL -o "${WORKDIR}/${TARBALL}" "${URL}"
tar -xzf "${WORKDIR}/${TARBALL}" -C "${WORKDIR}"

EXTRACTED_BIN="${WORKDIR}/node_exporter-${VERSION}.linux-${NE_ARCH}/node_exporter"
if [ ! -x "${EXTRACTED_BIN}" ]; then
  echo "[vigil] extracted binary not found at ${EXTRACTED_BIN}" >&2
  exit 1
fi

# Atomic install: build in a temp path on the same filesystem, then rename.
install -m 0755 "${EXTRACTED_BIN}" "${BIN_PATH}.new"
mv -f "${BIN_PATH}.new" "${BIN_PATH}"
echo "[vigil] installed binary to ${BIN_PATH}"

# --- systemd unit (write only if changed, to avoid unnecessary restarts) ---
NEW_UNIT="$(cat <<EOF
[Unit]
Description=Prometheus Node Exporter
After=network.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=${BIN_PATH} --collector.systemd --web.listen-address=0.0.0.0:${PORT}
Restart=on-failure
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes

[Install]
WantedBy=multi-user.target
EOF
)"

if [ ! -f "${UNIT_PATH}" ] || [ "$(cat "${UNIT_PATH}")" != "${NEW_UNIT}" ]; then
  echo "[vigil] writing systemd unit"
  echo "${NEW_UNIT}" > "${UNIT_PATH}"
  systemctl daemon-reload
fi

systemctl enable --now node_exporter
sleep 1
systemctl is-active --quiet node_exporter || { echo "[vigil] node_exporter failed to start" >&2; systemctl status node_exporter --no-pager || true; exit 1; }

# --- Best-effort firewall: restrict 9100 to nothing by default here; the ---
# --- Vigil UI tells the admin to open it to the Prometheus host's IP only.
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  echo "[vigil] ufw detected and active — remember to run: ufw allow from <prometheus-ip> to any port ${PORT} proto tcp"
fi

echo "[vigil] node_exporter ${VERSION} active on 0.0.0.0:${PORT}"
echo "VIGIL_INSTALL_OK"
