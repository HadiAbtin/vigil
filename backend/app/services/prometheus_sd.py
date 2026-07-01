"""Writes Prometheus file_sd target files from current DB state.

Every mutation that could affect scrape targets (create/update/delete/enable-toggle
of a Server, PortCheck, HttpMonitor, or a NodeExporterConfig reaching "installed")
calls `sync_all`, which fully rebuilds every target file from scratch. Rewriting
from scratch — rather than incrementally patching individual files — means a
target can never be left stuck in a stale interval bucket after an edit, or
orphaned in a file after a delete: there is no "old bucket" to forget to clean up,
because every file's entire contents are recomputed from the DB every time.
"""

import json
import os
import tempfile
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.constants import HttpMethod, InstallStatus, IntervalBucket
from app.models import HttpMonitor, NodeExporterConfig, Server

# Maps an HttpMonitor's admin-selected method to the blackbox_exporter module
# that performs the probe with that method (see blackbox_exporter/blackbox.yml).
_HTTP_METHOD_MODULE = {
    HttpMethod.GET: "http_get_2xx",
    HttpMethod.POST: "http_post_2xx",
    HttpMethod.HEAD: "http_head_2xx",
    HttpMethod.PUT: "http_put_2xx",
}


def _file_sd_dir() -> Path:
    return Path(settings.PROMETHEUS_FILE_SD_DIR)


def _bucket_path(probe_type: str, bucket: str) -> Path:
    return _file_sd_dir() / f"targets_{probe_type}_{bucket}.json"


def _node_exporter_path() -> Path:
    return _file_sd_dir() / "targets_node_exporter.json"


def _write_json_atomic(path: Path, data: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=path.parent, prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp_path, path)
    except BaseException:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise


def sync_all(db: Session) -> None:
    buckets: dict[tuple[str, str], list[dict]] = {
        (probe, bucket): [] for probe in ("ping", "tcp", "http") for bucket in IntervalBucket
    }

    servers = db.query(Server).all()
    for server in servers:
        if server.ping_enabled:
            buckets[("ping", server.ping_interval_bucket)].append(
                {
                    "targets": [server.host],
                    "labels": {
                        "vigil_type": "server_ping",
                        "vigil_id": str(server.id),
                        "vigil_name": server.name,
                    },
                }
            )
        for port_check in server.port_checks:
            if port_check.enabled:
                buckets[("tcp", port_check.interval_bucket)].append(
                    {
                        "targets": [f"{server.host}:{port_check.port}"],
                        "labels": {
                            "vigil_type": "tcp_port",
                            "vigil_id": str(port_check.id),
                            "vigil_name": f"{server.name}:{port_check.port}",
                        },
                    }
                )

    http_monitors = db.query(HttpMonitor).all()
    for monitor in http_monitors:
        if monitor.enabled:
            buckets[("http", monitor.interval_bucket)].append(
                {
                    "targets": [monitor.url],
                    "labels": {
                        "vigil_type": "http_monitor",
                        "vigil_id": str(monitor.id),
                        "vigil_name": monitor.name,
                        "module": _HTTP_METHOD_MODULE.get(monitor.method, "http_get_2xx"),
                    },
                }
            )

    for (probe, bucket), targets in buckets.items():
        _write_json_atomic(_bucket_path(probe, bucket), targets)

    node_exporter_targets: list[dict] = []
    configs = (
        db.query(NodeExporterConfig).filter(NodeExporterConfig.install_status == InstallStatus.INSTALLED).all()
    )
    for cfg in configs:
        node_exporter_targets.append(
            {
                "targets": [f"{cfg.server.host}:{settings.NODE_EXPORTER_PORT}"],
                "labels": {
                    "vigil_type": "node_exporter",
                    "vigil_id": str(cfg.server_id),
                    "vigil_name": cfg.server.name,
                },
            }
        )
    _write_json_atomic(_node_exporter_path(), node_exporter_targets)
