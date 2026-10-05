from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND = os.path.join(ROOT, "backend")
for path in (ROOT, BACKEND):
    if path not in sys.path:
        sys.path.insert(0, path)

from gb import crypto as legacy_crypto  # noqa: E402
from gb import merkle as legacy_merkle  # noqa: E402
from gb.store import Store  # noqa: E402

from app.services.crypto_service import CryptoService  # noqa: E402
from app.services.merkle_service import MerkleService  # noqa: E402


def test_entry_hash_and_genesis_match_legacy_store() -> None:
    _, election_pub = legacy_crypto.gen_election_key()
    ballot, _ = legacy_crypto.encrypt_ballot(election_pub, "E1", "riya")
    token_hash = "ab" * 32
    previous_hash = CryptoService.ledger_genesis("E1")

    assert previous_hash == legacy_crypto.sha256_hex(b"glassballot-genesis|E1")
    assert CryptoService.ballot_fingerprint(ballot) == legacy_crypto.sha256_hex(
        legacy_crypto.canonical(ballot).encode()
    )
    assert CryptoService.entry_hash(0, previous_hash, ballot, token_hash) == Store.entry_hash(
        0,
        previous_hash,
        legacy_crypto.canonical(ballot),
        token_hash,
    )


def test_merkle_paths_match_legacy_entry_hash_semantics() -> None:
    _, election_pub = legacy_crypto.gen_election_key()
    previous_hash = CryptoService.ledger_genesis("E1")
    entry_hashes: list[str] = []

    for index, choice in enumerate(["riya", "kabir", "ananya", "nota"]):
        ballot, _ = legacy_crypto.encrypt_ballot(election_pub, "E1", choice)
        token_hash = f"{index + 1:064x}"
        entry_hash = CryptoService.entry_hash(index, previous_hash, ballot, token_hash)
        entry_hashes.append(entry_hash)
        previous_hash = entry_hash

    legacy_leaves = [legacy_merkle.leaf_hash(bytes.fromhex(entry_hash)) for entry_hash in entry_hashes]
    legacy_root = legacy_merkle.mth(legacy_leaves).hex()

    assert MerkleService.root_from_entry_hashes(entry_hashes) == legacy_root

    for index, leaf in enumerate(legacy_leaves):
        path = [bytes.fromhex(step) for step in MerkleService.inclusion_path_from_entry_hashes(index, entry_hashes)]
        assert legacy_merkle.verify_inclusion(
            leaf,
            index,
            len(entry_hashes),
            path,
            bytes.fromhex(legacy_root),
        )
