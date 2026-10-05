"""Initial schema: all GlassBallot entities, enums, constraints, indexes.

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-03 00:00:00.000000
"""
from __future__ import annotations

from uuid import NAMESPACE_URL, uuid5

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def _rid(name: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"glassballot-role-{name}"))


def upgrade() -> None:
    election_state = sa.Enum(
        "DRAFT", "OPEN", "CLOSING", "CLOSED", "TALLYING", "COMPLETED", "FROZEN",
        name="election_state",
    )
    election_state.create(op.get_bind(), checkfirst=True)
    token_status = sa.Enum("ISSUED", "USED", "VOID", "SPOILED", name="token_status")
    token_status.create(op.get_bind(), checkfirst=True)
    witness_status = sa.Enum("WAITING", "SYNCED", "ALARM", "OFFLINE", name="witness_status")
    witness_status.create(op.get_bind(), checkfirst=True)
    witness_obs_status = sa.Enum(
        "WAITING", "SYNCED", "ALARM", "OFFLINE",
        name="witness_observation_status",
    )
    witness_obs_status.create(op.get_bind(), checkfirst=True)
    integrity_status = sa.Enum(
        "VERIFIED", "COMPROMISED", "PENDING", name="integrity_status",
    )
    integrity_status.create(op.get_bind(), checkfirst=True)
    tally_session_status = sa.Enum(
        "PENDING", "APPROVED", "REJECTED", name="tally_session_status",
    )
    tally_session_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.create_table(
        "roles",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_roles")),
        sa.UniqueConstraint("name", name=op.f("uq_roles_name")),
    )

    op.create_table(
        "user_roles",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("role_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_user_roles_user_id_users"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], name=op.f("fk_user_roles_role_id_roles"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_roles")),
        sa.UniqueConstraint("user_id", "role_id", name=op.f("uq_user_roles_user_id_role_id")),
    )

    op.create_table(
        "elections",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("public_id", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("college_name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("state", election_state, server_default="DRAFT", nullable=False),
        sa.Column("opens_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closes_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tally_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("election_public_key", sa.LargeBinary(), nullable=False),
        sa.Column("election_public_key_b64", sa.Text(), nullable=False),
        sa.Column("sth_public_key_b64", sa.Text(), nullable=False),
        sa.Column("metadata_json", pg.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_elections")),
        sa.UniqueConstraint("public_id", name=op.f("uq_elections_public_id")),
    )
    op.create_index("ix_elections_state", "elections", ["state"])

    op.create_table(
        "evidence_bundles",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("election_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("storage_key", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=64), nullable=False),
        sa.Column("summary", sa.String(length=255), nullable=False),
        sa.Column("details_json", pg.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["election_id"], ["elections.id"], name=op.f("fk_evidence_bundles_election_id_elections"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_evidence_bundles")),
    )
    op.create_index("ix_evidence_bundles_election_id", "evidence_bundles", ["election_id"])

    op.create_table(
        "election_candidates",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("election_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("candidate_code", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("statement", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["election_id"], ["elections.id"], name=op.f("fk_election_candidates_election_id"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_election_candidates")),
        sa.UniqueConstraint("election_id", "candidate_code", name=op.f("uq_election_candidates_election_id_candidate_code")),
    )
    op.create_index("ix_election_candidates_election_id", "election_candidates", ["election_id"])

    op.create_table(
        "voters",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("election_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("voter_external_id", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("is_eligible", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("has_received_token", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("has_completed_vote", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("metadata_json", pg.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["election_id"], ["elections.id"], name=op.f("fk_voters_election_id_elections"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_voters")),
        sa.UniqueConstraint("election_id", "voter_external_id", name=op.f("uq_voters_election_id_voter_external_id")),
    )
    op.create_index("ix_voters_election_id", "voters", ["election_id"])
    op.create_index("ix_voters_voter_external_id", "voters", ["voter_external_id"])

    op.create_table(
        "otp_challenges",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("voter_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("otp_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["voter_id"], ["voters.id"], name=op.f("fk_otp_challenges_voter_id_voters"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_otp_challenges")),
    )
    op.create_index("ix_otp_challenges_voter_id", "otp_challenges", ["voter_id"])
    op.create_index("ix_otp_challenges_expires_at", "otp_challenges", ["expires_at"])

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
        "ballot_tokens",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("election_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("voter_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("status", token_status, server_default="ISSUED", nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("invalidated_reason", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["election_id"], ["elections.id"], name=op.f("fk_ballot_tokens_election_id"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["voter_id"], ["voters.id"], name=op.f("fk_ballot_tokens_voter_id"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ballot_tokens")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_ballot_tokens_token_hash")),
    )
    op.create_index("ix_ballot_tokens_election_id", "ballot_tokens", ["election_id"])
    op.create_index("ix_ballot_tokens_status", "ballot_tokens", ["status"])
    op.create_index("ix_ballot_tokens_el_st_created", "ballot_tokens", ["election_id", "status", "created_at"])

    op.create_table(
        "sealed_ballots",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("election_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("token_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("ledger_index", sa.BigInteger(), nullable=False),
        sa.Column("previous_hash", sa.String(length=64), nullable=False),
        sa.Column("entry_hash", sa.String(length=64), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("ballot_payload", pg.JSONB(), nullable=False),
        sa.Column("ballot_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("is_test_ballot", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["election_id"], ["elections.id"], name=op.f("fk_sealed_ballots_election_id"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["token_id"], ["ballot_tokens.id"], name=op.f("fk_sealed_ballots_token_id"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sealed_ballots")),
        sa.UniqueConstraint("election_id", "ledger_index", name=op.f("uq_sealed_ballots_election_id_ledger_index")),
        sa.UniqueConstraint("entry_hash", name=op.f("uq_sealed_ballots_entry_hash")),
    )
    op.create_index("ix_sealed_ballots_election_id", "sealed_ballots", ["election_id"])
    op.create_index("ix_sealed_ballots_token_hash", "sealed_ballots", ["token_hash"])
    op.create_index("ix_sealed_ballots_ballot_fingerprint", "sealed_ballots", ["ballot_fingerprint"])
    op.create_index("ix_sealed_ballots_el_created", "sealed_ballots", ["election_id", "created_at"])

    op.create_table(
        "merkle_tree_heads",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("election_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("root_hash", sa.String(length=64), nullable=False),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("signature_b64", sa.Text(), nullable=False),
        sa.Column("canonical_payload", pg.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["election_id"], ["elections.id"], name=op.f("fk_merkle_tree_heads_election_id"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_merkle_tree_heads")),
        sa.UniqueConstraint("election_id", "size", name=op.f("uq_merkle_tree_heads_election_id_size")),
    )
    op.create_index("ix_merkle_tree_heads_election_id", "merkle_tree_heads", ["election_id"])
    op.create_index("ix_merkle_tree_heads_size", "merkle_tree_heads", ["size"])

    op.create_table(
        "witnesses",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("election_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("witness_code", sa.String(length=64), nullable=False),
        sa.Column("owner_name", sa.String(length=255), nullable=False),
        sa.Column("status", witness_status, server_default="WAITING", nullable=False),
        sa.Column("last_accepted_size", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("last_accepted_root", sa.String(length=64), nullable=True),
        sa.Column("last_signature_b64", sa.Text(), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("alarm_sticky", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["election_id"], ["elections.id"], name=op.f("fk_witnesses_election_id"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_witnesses")),
        sa.UniqueConstraint("election_id", "witness_code", name=op.f("uq_witnesses_election_id_witness_code")),
    )
    op.create_index("ix_witnesses_election_id", "witnesses", ["election_id"])
    op.create_index("ix_witnesses_status", "witnesses", ["status"])

    op.create_table(
        "witness_observations",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("witness_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("election_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("observed_size", sa.BigInteger(), nullable=False),
        sa.Column("observed_root", sa.String(length=64), nullable=False),
        sa.Column("observed_signature_b64", sa.Text(), nullable=False),
        sa.Column("status", witness_obs_status, nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("evidence_bundle_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["witness_id"], ["witnesses.id"], name=op.f("fk_witness_observations_witness_id"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["election_id"], ["elections.id"], name=op.f("fk_witness_observations_election_id"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["evidence_bundle_id"], ["evidence_bundles.id"], name=op.f("fk_witness_obs_evidence_bundle"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_witness_observations")),
    )
    op.create_index("ix_witness_observations_witness_id", "witness_observations", ["witness_id"])
    op.create_index("ix_witness_observations_election_id", "witness_observations", ["election_id"])

    op.create_table(
        "spoiled_test_ballots",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("election_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("ballot_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("claimed_choice", sa.String(length=64), nullable=False),
        sa.Column("revealed_choice", sa.String(length=64), nullable=False),
        sa.Column("verification_ok", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["election_id"], ["elections.id"], name=op.f("fk_spoiled_test_ballots_election_id"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_spoiled_test_ballots")),
    )
    op.create_index("ix_spoiled_test_ballots_election_id", "spoiled_test_ballots", ["election_id"])
    op.create_index("ix_spoiled_test_ballots_fingerprint", "spoiled_test_ballots", ["ballot_fingerprint"])

    op.create_table(
        "trustees",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("election_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("role_code", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("threshold_group", sa.String(length=64), server_default="2-of-3", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["election_id"], ["elections.id"], name=op.f("fk_trustees_election_id"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_trustees_user_id"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_trustees")),
        sa.UniqueConstraint("election_id", "role_code", name=op.f("uq_trustees_election_id_role_code")),
    )
    op.create_index("ix_trustees_election_id", "trustees", ["election_id"])

    op.create_table(
        "trustee_key_shares",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("trustee_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("election_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("encrypted_share_ref", sa.String(length=255), nullable=False),
        sa.Column("key_version", sa.String(length=64), nullable=False),
        sa.Column("metadata_json", pg.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["trustee_id"], ["trustees.id"], name=op.f("fk_trustee_key_shares_trustee_id"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["election_id"], ["elections.id"], name=op.f("fk_trustee_key_shares_election_id"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_trustee_key_shares")),
    )
    op.create_index("ix_trustee_key_shares_trustee_id", "trustee_key_shares", ["trustee_id"])
    op.create_index("ix_trustee_key_shares_election_id", "trustee_key_shares", ["election_id"])

    op.create_table(
        "tally_sessions",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("election_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("requested_by_user_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("status", tally_session_status, server_default="PENDING", nullable=False),
        sa.Column("approvals_required", sa.Integer(), server_default="2", nullable=False),
        sa.Column("approvals_received", sa.Integer(), server_default="0", nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["election_id"], ["elections.id"], name=op.f("fk_tally_sessions_election_id"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requested_by_user_id"], ["users.id"], name=op.f("fk_tally_sessions_user_id"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tally_sessions")),
    )
    op.create_index("ix_tally_sessions_election_id", "tally_sessions", ["election_id"])
    op.create_index("ix_tally_sessions_status", "tally_sessions", ["status"])

    op.create_table(
        "tally_results",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("tally_session_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("election_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("candidate_code", sa.String(length=64), nullable=False),
        sa.Column("vote_total", sa.Integer(), nullable=False),
        sa.Column("published_metadata", pg.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tally_session_id"], ["tally_sessions.id"], name=op.f("fk_tally_results_session_id"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["election_id"], ["elections.id"], name=op.f("fk_tally_results_election_id"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tally_results")),
    )
    op.create_index("ix_tally_results_tally_session_id", "tally_results", ["tally_session_id"])
    op.create_index("ix_tally_results_election_id", "tally_results", ["election_id"])

    op.create_table(
        "audit_events",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("actor_type", sa.String(length=64), nullable=False),
        sa.Column("actor_id", sa.String(length=128), nullable=True),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("resource_type", sa.String(length=128), nullable=False),
        sa.Column("resource_id", sa.String(length=128), nullable=True),
        sa.Column("metadata_json", pg.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("previous_hash", sa.String(length=64), nullable=False),
        sa.Column("event_hash", sa.String(length=64), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_events")),
        sa.UniqueConstraint("event_hash", name=op.f("uq_audit_events_event_hash")),
    )
    op.create_index("ix_audit_events_created_action", "audit_events", ["created_at", "action"])
    op.create_index("ix_audit_events_created_at", "audit_events", ["created_at"])

    op.create_table(
        "security_alerts",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("election_id", pg.UUID(as_uuid=True), nullable=True),
        sa.Column("severity", sa.String(length=32), nullable=False),
        sa.Column("kind", sa.String(length=128), nullable=False),
        sa.Column("summary", sa.String(length=255), nullable=False),
        sa.Column("details_json", pg.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["election_id"], ["elections.id"], name=op.f("fk_security_alerts_election_id"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_security_alerts")),
    )
    op.create_index("ix_security_alerts_election_id", "security_alerts", ["election_id"])
    op.create_index("ix_security_alerts_kind", "security_alerts", ["kind"])

    op.create_table(
        "integrity_checks",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("election_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("status", integrity_status, server_default="PENDING", nullable=False),
        sa.Column("results_json", pg.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("first_failed_check", sa.String(length=128), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["election_id"], ["elections.id"], name=op.f("fk_integrity_checks_election_id"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_integrity_checks")),
    )
    op.create_index("ix_integrity_checks_election_id", "integrity_checks", ["election_id"])
    op.create_index("ix_integrity_checks_status", "integrity_checks", ["status"])

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

    roles_table = sa.table(
        "roles",
        sa.column("id", pg.UUID(as_uuid=True)),
        sa.column("name", sa.String),
        sa.column("description", sa.String),
    )
    seed_roles = [
        ("SUPER_ADMIN", "Full system-level access"),
        ("ELECTION_ADMIN", "Manage elections, voters, and configuration"),
        ("ELECTION_OFFICER", "Run elections (open/close/tally)"),
        ("FACULTY_TRUSTEE", "Faculty trustee for tally approval"),
        ("STUDENT_TRUSTEE", "Student representative trustee"),
        ("POLLING_AGENT", "Candidate polling agent (witness)"),
        ("VOTER", "Eligible voter"),
    ]
    op.bulk_insert(
        roles_table,
        [{"id": _rid(n), "name": n, "description": d} for (n, d) in seed_roles],
    )


def downgrade() -> None:
    tables = [
        "demo_scenarios", "integrity_checks", "security_alerts", "audit_events",
        "tally_results", "tally_sessions", "trustee_key_shares", "trustees",
        "spoiled_test_ballots", "witness_observations", "witnesses",
        "merkle_tree_heads", "sealed_ballots", "ballot_tokens",
        "voter_auth_attempts", "otp_challenges", "voters", "election_candidates",
        "evidence_bundles", "elections", "user_roles", "roles", "users",
    ]
    for t in tables:
        op.drop_table(t)
    for enum_name in [
        "election_state", "token_status", "witness_status",
        "witness_observation_status", "integrity_status", "tally_session_status",
    ]:
        sa.Enum(name=enum_name).drop(op.get_bind(), checkfirst=True)
