"""enum and orphan fixes

Revision ID: 0002_enum_orphan_fixes
Revises: 0001_initial
Create Date: 2026-10-04 00:00:00.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0002_enum_orphan_fixes"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def _add_enum_value(enum_name: str, value: str) -> None:
    conn = op.get_bind()
    conn.exec_driver_sql(
        f"ALTER TYPE {enum_name} ADD VALUE IF NOT EXISTS '{value}'"
    )


def upgrade() -> None:
    _add_enum_value("election_state", "SETUP")
    _add_enum_value("election_state", "DECRYPTING")
    _add_enum_value("election_state", "PUBLISHED")

    _add_enum_value("witness_status", "ACCEPTED")
    _add_enum_value("witness_status", "REJECTED")
    _add_enum_value("witness_observation_status", "ACCEPTED")
    _add_enum_value("witness_observation_status", "REJECTED")

    _add_enum_value("tally_session_status", "COMPLETED")
    _add_enum_value("tally_session_status", "FAILED")

    op.drop_index("ix_voter_auth_attempts_election_id", table_name="voter_auth_attempts")
    op.drop_index("ix_voter_auth_attempts_voter_external_id", table_name="voter_auth_attempts")
    op.drop_table("voter_auth_attempts")

    op.drop_index("ix_demo_scenarios_election_id", table_name="demo_scenarios")
    op.drop_index("ix_demo_scenarios_scenario_code", table_name="demo_scenarios")
    op.drop_table("demo_scenarios")


def downgrade() -> None:
    op.create_table(
        "voter_auth_attempts",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("election_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("voter_external_id", sa.String(length=64), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["election_id"], ["elections.id"], name=op.f("fk_voter_auth_attempts_election_id"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_voter_auth_attempts")),
    )
    op.create_index("ix_voter_auth_attempts_election_id", "voter_auth_attempts", ["election_id"])
    op.create_index("ix_voter_auth_attempts_voter_external_id", "voter_auth_attempts", ["voter_external_id"])

    op.create_table(
        "demo_scenarios",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("election_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("scenario_code", sa.String(length=64), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("details_json", pg.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["election_id"], ["elections.id"], name=op.f("fk_demo_scenarios_election_id"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_demo_scenarios")),
    )
    op.create_index("ix_demo_scenarios_election_id", "demo_scenarios", ["election_id"])
    op.create_index("ix_demo_scenarios_scenario_code", "demo_scenarios", ["scenario_code"])
