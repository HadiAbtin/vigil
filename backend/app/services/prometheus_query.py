"""Thin httpx wrapper around Prometheus's instant-query HTTP API, plus the
specific PromQL Vigil's alert engine needs. All queries key off the `vigil_id`
label written by prometheus_sd.py, not `instance`, so they're stable across
edits to a host/port/URL.
"""

import httpx

from app.core.config import settings
from app.core.constants import CPU_RATE_WINDOW


class PrometheusQueryError(Exception):
    pass


def instant_query(promql: str) -> list[dict]:
    resp = httpx.get(
        f"{settings.PROMETHEUS_URL}/api/v1/query",
        params={"query": promql},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("status") != "success":
        raise PrometheusQueryError(data.get("error", "unknown Prometheus error"))
    return data["data"]["result"]


def range_query(promql: str, start: int, end: int, step: int) -> list[dict]:
    resp = httpx.get(
        f"{settings.PROMETHEUS_URL}/api/v1/query_range",
        params={"query": promql, "start": start, "end": end, "step": step},
        timeout=20,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("status") != "success":
        raise PrometheusQueryError(data.get("error", "unknown Prometheus error"))
    return data["data"]["result"]


def _series(result: list[dict], name_label: str | None = None, default_name: str = "value") -> list[dict]:
    series = []
    for r in result:
        name = r["metric"].get(name_label, default_name) if name_label else default_name
        points = [[float(ts), float(val)] for ts, val in r.get("values", [])]
        series.append({"name": name, "points": points})
    return series


def get_scalar(promql: str) -> float | None:
    result = instant_query(promql)
    if not result:
        return None
    return float(result[0]["value"][1])


def get_probe_success(vigil_type: str, vigil_id: int) -> float | None:
    return get_scalar(f'probe_success{{vigil_type="{vigil_type}", vigil_id="{vigil_id}"}}')


def get_http_status_code(vigil_id: int) -> float | None:
    return get_scalar(f'probe_http_status_code{{vigil_type="http_monitor", vigil_id="{vigil_id}"}}')


def get_node_up(server_id: int) -> float | None:
    return get_scalar(f'up{{vigil_type="node_exporter", vigil_id="{server_id}"}}')


def get_cpu_usage_percent(server_id: int) -> float | None:
    query = (
        f'100 - (avg(rate(node_cpu_seconds_total{{mode="idle", vigil_id="{server_id}"}}'
        f"[{CPU_RATE_WINDOW}])) * 100)"
    )
    return get_scalar(query)


def get_ram_usage_percent(server_id: int) -> float | None:
    query = (
        f'100 * (1 - (node_memory_MemAvailable_bytes{{vigil_id="{server_id}"}} / '
        f'node_memory_MemTotal_bytes{{vigil_id="{server_id}"}}))'
    )
    return get_scalar(query)


def get_max_disk_usage_percent(server_id: int) -> tuple[float, str] | None:
    query = (
        f'100 * (1 - (node_filesystem_avail_bytes{{vigil_id="{server_id}", '
        f'fstype!~"tmpfs|overlay|squashfs"}} / node_filesystem_size_bytes{{vigil_id="{server_id}", '
        f'fstype!~"tmpfs|overlay|squashfs"}}))'
    )
    result = instant_query(query)
    if not result:
        return None
    best = max(result, key=lambda r: float(r["value"][1]))
    return float(best["value"][1]), best["metric"].get("mountpoint", "?")


# --- Range queries, for historical graphs -----------------------------------
# Each returns (unit, series) where series is a list of {"name", "points"}
# ready to hand straight to the frontend chart.


def get_ping_latency_range(server_id: int, start: int, end: int, step: int) -> tuple[str, list[dict]]:
    query = f'probe_duration_seconds{{vigil_type="server_ping", vigil_id="{server_id}"}} * 1000'
    return "ms", _series(range_query(query, start, end, step), default_name="latency")


def get_tcp_latency_range(port_check_id: int, start: int, end: int, step: int) -> tuple[str, list[dict]]:
    query = f'probe_duration_seconds{{vigil_type="tcp_port", vigil_id="{port_check_id}"}} * 1000'
    return "ms", _series(range_query(query, start, end, step), default_name="latency")


def get_http_latency_range(http_monitor_id: int, start: int, end: int, step: int) -> tuple[str, list[dict]]:
    query = f'probe_duration_seconds{{vigil_type="http_monitor", vigil_id="{http_monitor_id}"}} * 1000'
    return "ms", _series(range_query(query, start, end, step), default_name="latency")


def get_http_status_range(http_monitor_id: int, start: int, end: int, step: int) -> tuple[str, list[dict]]:
    query = f'probe_http_status_code{{vigil_type="http_monitor", vigil_id="{http_monitor_id}"}}'
    return "code", _series(range_query(query, start, end, step), default_name="status")


def get_cpu_range(server_id: int, start: int, end: int, step: int) -> tuple[str, list[dict]]:
    query = (
        f'100 - (avg(rate(node_cpu_seconds_total{{mode="idle", vigil_id="{server_id}"}}'
        f"[{CPU_RATE_WINDOW}])) * 100)"
    )
    return "%", _series(range_query(query, start, end, step), default_name="cpu")


def get_ram_range(server_id: int, start: int, end: int, step: int) -> tuple[str, list[dict]]:
    query = (
        f'100 * (1 - (node_memory_MemAvailable_bytes{{vigil_id="{server_id}"}} / '
        f'node_memory_MemTotal_bytes{{vigil_id="{server_id}"}}))'
    )
    return "%", _series(range_query(query, start, end, step), default_name="ram")


def get_disk_range(server_id: int, start: int, end: int, step: int) -> tuple[str, list[dict]]:
    query = (
        f'100 * (1 - (node_filesystem_avail_bytes{{vigil_id="{server_id}", '
        f'fstype!~"tmpfs|overlay|squashfs"}} / node_filesystem_size_bytes{{vigil_id="{server_id}", '
        f'fstype!~"tmpfs|overlay|squashfs"}}))'
    )
    return "%", _series(range_query(query, start, end, step), name_label="mountpoint", default_name="disk")
