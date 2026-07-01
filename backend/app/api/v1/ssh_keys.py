from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_password_already_changed
from app.core.encryption import encrypt_secret
from app.models import SSHKey
from app.schemas.ssh_key import SSHKeyCreate, SSHKeyCreated, SSHKeyOut
from app.services import ssh_provision

router = APIRouter(prefix="/ssh-keys", tags=["ssh-keys"], dependencies=[Depends(require_password_already_changed)])


@router.get("", response_model=list[SSHKeyOut])
def list_ssh_keys(db: Session = Depends(get_db)) -> list[SSHKey]:
    return db.query(SSHKey).order_by(SSHKey.name).all()


@router.post("", response_model=SSHKeyCreated, status_code=status.HTTP_201_CREATED)
def create_ssh_key(payload: SSHKeyCreate, db: Session = Depends(get_db)) -> SSHKeyCreated:
    if db.query(SSHKey).filter(SSHKey.name == payload.name).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An SSH key with this name already exists")

    if payload.private_key:
        try:
            public_key, fingerprint = ssh_provision.derive_public_key(payload.private_key, payload.name)
        except ssh_provision.ProvisioningError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        private_pem = payload.private_key
    else:
        private_pem, public_key, fingerprint = ssh_provision.generate_keypair(payload.name)

    key = SSHKey(
        name=payload.name,
        encrypted_private_key=encrypt_secret(private_pem),
        public_key=public_key,
        fingerprint=fingerprint,
    )
    db.add(key)
    db.commit()
    db.refresh(key)

    generated = not payload.private_key
    return SSHKeyCreated(
        id=key.id,
        name=key.name,
        public_key=key.public_key,
        fingerprint=key.fingerprint,
        created_at=key.created_at,
        was_generated=generated,
        private_key=private_pem if generated else None,
    )


@router.delete("/{ssh_key_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ssh_key(ssh_key_id: int, db: Session = Depends(get_db)) -> None:
    key = db.get(SSHKey, ssh_key_id)
    if key is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SSH key not found")
    if key.node_exporter_configs:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This key is in use by one or more servers' resource monitoring config",
        )
    db.delete(key)
    db.commit()
