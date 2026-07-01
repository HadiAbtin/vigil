from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, require_password_already_changed
from app.core.constants import InstallStatus
from app.models import NodeExporterConfig, PortCheck, Server, SSHKey
from app.schemas.node_exporter_config import NodeExporterConfigCreate, NodeExporterConfigOut
from app.schemas.port_check import PortCheckCreate, PortCheckOut, PortCheckUpdate
from app.schemas.server import ServerCreate, ServerDetailOut, ServerOut, ServerUpdate
from app.services import prometheus_sd

router = APIRouter(prefix="/servers", tags=["servers"], dependencies=[Depends(require_password_already_changed)])


def _get_server_or_404(db: Session, server_id: int) -> Server:
    server = db.get(Server, server_id)
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    return server


@router.get("", response_model=list[ServerOut])
def list_servers(db: Session = Depends(get_db)) -> list[Server]:
    return db.query(Server).order_by(Server.name).all()


@router.post("", response_model=ServerDetailOut, status_code=status.HTTP_201_CREATED)
def create_server(payload: ServerCreate, db: Session = Depends(get_db)) -> Server:
    if db.query(Server).filter(Server.name == payload.name).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A server with this name already exists")
    server = Server(**payload.model_dump())
    db.add(server)
    db.commit()
    db.refresh(server)
    prometheus_sd.sync_all(db)
    return server


@router.get("/{server_id}", response_model=ServerDetailOut)
def get_server(server_id: int, db: Session = Depends(get_db)) -> Server:
    server = (
        db.query(Server)
        .options(
            joinedload(Server.port_checks),
            joinedload(Server.http_monitors),
            joinedload(Server.node_exporter_config),
        )
        .filter(Server.id == server_id)
        .first()
    )
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
    return server


@router.patch("/{server_id}", response_model=ServerDetailOut)
def update_server(server_id: int, payload: ServerUpdate, db: Session = Depends(get_db)) -> Server:
    server = _get_server_or_404(db, server_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(server, field, value)
    db.commit()
    db.refresh(server)
    prometheus_sd.sync_all(db)
    return server


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_server(server_id: int, db: Session = Depends(get_db)) -> None:
    server = _get_server_or_404(db, server_id)
    db.delete(server)
    db.commit()
    prometheus_sd.sync_all(db)


# --- Port checks ------------------------------------------------------------


@router.post("/{server_id}/port-checks", response_model=PortCheckOut, status_code=status.HTTP_201_CREATED)
def create_port_check(server_id: int, payload: PortCheckCreate, db: Session = Depends(get_db)) -> PortCheck:
    _get_server_or_404(db, server_id)
    port_check = PortCheck(server_id=server_id, **payload.model_dump())
    db.add(port_check)
    db.commit()
    db.refresh(port_check)
    prometheus_sd.sync_all(db)
    return port_check


@router.patch("/{server_id}/port-checks/{port_check_id}", response_model=PortCheckOut)
def update_port_check(
    server_id: int, port_check_id: int, payload: PortCheckUpdate, db: Session = Depends(get_db)
) -> PortCheck:
    port_check = db.get(PortCheck, port_check_id)
    if port_check is None or port_check.server_id != server_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Port check not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(port_check, field, value)
    db.commit()
    db.refresh(port_check)
    prometheus_sd.sync_all(db)
    return port_check


@router.delete("/{server_id}/port-checks/{port_check_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_port_check(server_id: int, port_check_id: int, db: Session = Depends(get_db)) -> None:
    port_check = db.get(PortCheck, port_check_id)
    if port_check is None or port_check.server_id != server_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Port check not found")
    db.delete(port_check)
    db.commit()
    prometheus_sd.sync_all(db)


# --- Resource monitoring (node_exporter provisioning) ------------------------


@router.post("/{server_id}/node-exporter", response_model=NodeExporterConfigOut, status_code=status.HTTP_201_CREATED)
def create_node_exporter_config(
    server_id: int, payload: NodeExporterConfigCreate, db: Session = Depends(get_db)
) -> NodeExporterConfig:
    server = _get_server_or_404(db, server_id)
    if server.node_exporter_config is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Resource monitoring is already configured")
    if db.get(SSHKey, payload.ssh_key_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SSH key not found")

    config = NodeExporterConfig(
        server_id=server_id,
        ssh_key_id=payload.ssh_key_id,
        ssh_user=payload.ssh_user,
        ssh_port=payload.ssh_port,
        install_status=InstallStatus.PENDING,
    )
    db.add(config)
    db.commit()
    db.refresh(config)

    from app.tasks.provision_node_exporter import provision_node_exporter

    provision_node_exporter.delay(server_id)

    return config


@router.post("/{server_id}/node-exporter/retry", response_model=NodeExporterConfigOut)
def retry_node_exporter_provisioning(server_id: int, db: Session = Depends(get_db)) -> NodeExporterConfig:
    server = _get_server_or_404(db, server_id)
    if server.node_exporter_config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource monitoring is not configured")

    from app.tasks.provision_node_exporter import provision_node_exporter

    provision_node_exporter.delay(server_id)
    return server.node_exporter_config


@router.delete("/{server_id}/node-exporter", status_code=status.HTTP_204_NO_CONTENT)
def delete_node_exporter_config(server_id: int, db: Session = Depends(get_db)) -> None:
    server = _get_server_or_404(db, server_id)
    if server.node_exporter_config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource monitoring is not configured")
    db.delete(server.node_exporter_config)
    db.commit()
    prometheus_sd.sync_all(db)
