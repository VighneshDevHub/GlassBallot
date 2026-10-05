"""spoiled ciphertext column

Revision ID: 0003_spoiled_ciphertext
Revises: 0002_enum_orphan_fixes
Create Date: 2026-10-04 00:01:00.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0003_spoiled_ciphertext"
down_revision = "0002_enum_orphan_fixes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        # Use JSONB for PostgreSQL for indexed JSON support
        from sqlalchemy.dialects import postgresql as pg
        op.add_column(
            "spoiled_test_ballots",
            sa.Column(
                "ciphertext_payload",
                pg.JSONB(),
                server_default=sa.text("'{}'::jsonb"),
                nullable=False,
            ),
        )
    else:
        # SQLite and other dialects: use plain JSON / TEXT
        op.add_column(
            "spoiled_test_ballots",
            sa.Column(
                "ciphertext_payload",
                sa.JSON(),
                server_default=sa.text("'{}'"),
                nullable=False,
            ),
        )


def downgrade() -> None:
    op.drop_column("spoiled_test_ballots", "ciphertext_payload")
