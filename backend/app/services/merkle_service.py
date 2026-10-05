from __future__ import annotations

from gb import merkle as legacy_merkle

from app.services.crypto_service import CryptoService


class MerkleService:
    """Wrapper that preserves the existing RFC 6962/9162 implementation."""

    leaf_hash = staticmethod(legacy_merkle.leaf_hash)
    node_hash = staticmethod(legacy_merkle.node_hash)

    @staticmethod
    def verify_inclusion(
        leaf: bytes | None = None,
        index: int | None = None,
        size: int | None = None,
        path: list | None = None,
        root: bytes | None = None,
        leaf_hash: bytes | None = None,
        leaf_index: int | None = None,
        tree_size: int | None = None,
        **kwargs,
    ) -> bool:
        eff_leaf = leaf if leaf is not None else leaf_hash
        eff_index = index if index is not None else (leaf_index or 0)
        eff_size = size if size is not None else (tree_size or 0)
        eff_path = path or []
        eff_root = root if root is not None else kwargs.get("root_hash", b"")
        if not eff_leaf or not eff_root:
            return False
        return legacy_merkle.verify_inclusion(eff_leaf, eff_index, eff_size, eff_path, eff_root)

    verify_consistency = staticmethod(legacy_merkle.verify_consistency)

    @staticmethod
    def _leaf_hashes_from_entry_hashes(entry_hashes: list[str]) -> list[bytes]:
        return [legacy_merkle.leaf_hash(bytes.fromhex(entry_hash)) for entry_hash in entry_hashes]

    @classmethod
    def _leaf_hashes_from_ballot_data(cls, ballot_data_list: list[tuple[int, str, str]]) -> list[bytes]:
        entry_hashes = [entry_hash for _idx, _fingerprint, entry_hash in ballot_data_list]
        return cls._leaf_hashes_from_entry_hashes(entry_hashes)

    @classmethod
    def merkle_tree_hash(cls, ballot_data_list: list[tuple[int, str, str]]) -> bytes:
        leaves = cls._leaf_hashes_from_ballot_data(ballot_data_list)
        return legacy_merkle.mth(leaves)

    @classmethod
    def root_hex(cls, ballot_data_list: list[tuple[int, str, str]]) -> str:
        return cls.merkle_tree_hash(ballot_data_list).hex()

    @classmethod
    def mth(cls, leaf_hashes: list[bytes]) -> bytes:
        return legacy_merkle.mth(leaf_hashes)

    @classmethod
    def root_from_entry_hashes(cls, entry_hashes: list[str]) -> str:
        return legacy_merkle.mth(cls._leaf_hashes_from_entry_hashes(entry_hashes)).hex()

    @classmethod
    def inclusion_path(cls, leaf_index: int, ballot_data_list: list[tuple[int, str, str]]) -> list[str]:
        leaves = cls._leaf_hashes_from_ballot_data(ballot_data_list)
        if not leaves or leaf_index < 0 or leaf_index >= len(leaves):
            return []
        path = legacy_merkle.inclusion_path(leaf_index, leaves)
        return [h.hex() for h in path]

    @classmethod
    def inclusion_path_from_entry_hashes(cls, leaf_index: int, entry_hashes: list[str]) -> list[str]:
        leaves = cls._leaf_hashes_from_entry_hashes(entry_hashes)
        if not leaves or leaf_index < 0 or leaf_index >= len(leaves):
            return []
        return [h.hex() for h in legacy_merkle.inclusion_path(leaf_index, leaves)]

    @classmethod
    def inclusion_path_from_leaves(cls, leaf_index: int, leaf_hashes: list[bytes]) -> list[str]:
        if not leaf_hashes or leaf_index < 0 or leaf_index >= len(leaf_hashes):
            return []
        path = legacy_merkle.inclusion_path(leaf_index, leaf_hashes)
        return [h.hex() for h in path]

    @classmethod
    def consistency_path(
        cls,
        old_size: int,
        new_size: int,
        ballot_data_list: list[tuple[int, str, str]],
    ) -> list[str]:
        leaves = cls._leaf_hashes_from_ballot_data(ballot_data_list[:new_size])
        if old_size <= 0 or old_size > new_size or new_size > len(ballot_data_list):
            return []
        if old_size == new_size:
            return []
        path = legacy_merkle.consistency_path(old_size, leaves)
        return [h.hex() for h in path]

    @classmethod
    def consistency_path_from_entry_hashes(
        cls,
        old_size: int,
        entry_hashes: list[str],
    ) -> list[str]:
        leaves = cls._leaf_hashes_from_entry_hashes(entry_hashes)
        n = len(leaves)
        if old_size <= 0 or old_size > n:
            return []
        if old_size == n:
            return []
        return [h.hex() for h in legacy_merkle.consistency_path(old_size, leaves)]

    @classmethod
    def consistency_path_from_leaves(
        cls,
        old_size: int,
        leaf_hashes: list[bytes],
    ) -> list[str]:
        n = len(leaf_hashes)
        if old_size <= 0 or old_size > n:
            return []
        if old_size == n:
            return []
        path = legacy_merkle.consistency_path(old_size, leaf_hashes)
        return [h.hex() for h in path]
