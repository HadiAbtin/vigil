"""add llm cost alert rule types

Revision ID: a1c9e7d24f6b
Revises: fbd5fe7be3f3
Create Date: 2026-07-09 21:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c9e7d24f6b'
down_revision: Union[str, None] = 'fbd5fe7be3f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD_CHECK_SQL = (
    "(rule_type = 'server_ping' AND server_id IS NOT NULL AND port_check_id IS NULL AND http_monitor_id IS NULL) OR "
    "(rule_type IN ('resource_cpu', 'resource_ram', 'resource_disk') AND server_id IS NOT NULL "
    "AND port_check_id IS NULL AND http_monitor_id IS NULL) OR "
    "(rule_type = 'tcp_port' AND port_check_id IS NOT NULL AND server_id IS NULL AND http_monitor_id IS NULL) OR "
    "(rule_type = 'http_monitor' AND http_monitor_id IS NOT NULL AND server_id IS NULL AND port_check_id IS NULL)"
)

_NEW_CHECK_SQL = (
    "(rule_type = 'server_ping' AND server_id IS NOT NULL AND port_check_id IS NULL AND http_monitor_id IS NULL) OR "
    "(rule_type IN ('resource_cpu', 'resource_ram', 'resource_disk', 'llm_tokens', 'llm_cost') AND server_id IS NOT NULL "
    "AND port_check_id IS NULL AND http_monitor_id IS NULL) OR "
    "(rule_type = 'tcp_port' AND port_check_id IS NOT NULL AND server_id IS NULL AND http_monitor_id IS NULL) OR "
    "(rule_type = 'http_monitor' AND http_monitor_id IS NOT NULL AND server_id IS NULL AND port_check_id IS NULL)"
)


def upgrade() -> None:
    op.alter_column('alert_rules', 'threshold_value', type_=sa.Numeric(14, 2), existing_type=sa.Numeric(5, 2))
    op.drop_constraint(op.f('ck_alert_rules_valid_target_for_rule_type'), 'alert_rules', type_='check')
    op.create_check_constraint(op.f('ck_alert_rules_valid_target_for_rule_type'), 'alert_rules', _NEW_CHECK_SQL)


def downgrade() -> None:
    op.drop_constraint(op.f('ck_alert_rules_valid_target_for_rule_type'), 'alert_rules', type_='check')
    op.create_check_constraint(op.f('ck_alert_rules_valid_target_for_rule_type'), 'alert_rules', _OLD_CHECK_SQL)
    op.alter_column('alert_rules', 'threshold_value', type_=sa.Numeric(5, 2), existing_type=sa.Numeric(14, 2))
