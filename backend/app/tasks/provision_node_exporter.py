from datetime import datetime, timezone

from app.celery_app import celery_app
from app.core.constants import InstallStatus
from app.db.session import SessionLocal
from app.models import NodeExporterConfig
from app.services import prometheus_sd, ssh_provision


@celery_app.task(name="app.tasks.provision_node_exporter.provision_node_exporter")
def provision_node_exporter(server_id: int) -> None:
    db = SessionLocal()
    try:
        config = db.query(NodeExporterConfig).filter(NodeExporterConfig.server_id == server_id).first()
        if config is None:
            return

        config.install_status = InstallStatus.INSTALLING
        db.commit()

        try:
            result = ssh_provision.provision_node_exporter(
                host=config.server.host,
                port=config.ssh_port,
                username=config.ssh_user,
                encrypted_private_key=config.ssh_key.encrypted_private_key,
                expected_host_key_fingerprint=config.host_key_fingerprint,
            )
        except ssh_provision.ProvisioningError as exc:
            config.install_status = InstallStatus.FAILED
            config.last_error = str(exc)
            config.last_checked_at = datetime.now(timezone.utc)
            db.commit()
            return

        # "installed" here means the SSH steps succeeded — a separate Beat task
        # (check_node_exporter_active) only flips `active` once Prometheus is
        # actually scraping it, which surfaces firewall-blocked-9100 as its own
        # distinct state instead of a stuck spinner.
        config.install_status = InstallStatus.INSTALLED
        config.host_key_fingerprint = result.host_key_fingerprint
        config.last_error = None
        config.last_checked_at = datetime.now(timezone.utc)
        db.commit()
        prometheus_sd.sync_all(db)
    finally:
        db.close()
