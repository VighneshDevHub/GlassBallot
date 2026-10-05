"""RFC 6962 / RFC 9162 style Merkle tree: inclusion and consistency proofs.

Leaves passed in are *already leaf-hashed* (see leaf_hash). Every function is
pure, so the same code is used by the server, by witnesses and by the tests.
"""
import hashlib


def H(b: bytes) -> bytes:
    return hashlib.sha256(b).digest()


def leaf_hash(data: bytes) -> bytes:
    return H(b"\x00" + data)


def node_hash(left: bytes, right: bytes) -> bytes:
    return H(b"\x01" + left + right)


def _split(n: int) -> int:
    """Largest power of two strictly less than n (n >= 2)."""
    k = 1
    while k * 2 < n:
        k *= 2
    return k


def mth(hs: list) -> bytes:
    n = len(hs)
    if n == 0:
        return H(b"")
    if n == 1:
        return hs[0]
    k = _split(n)
    return node_hash(mth(hs[:k]), mth(hs[k:]))


def inclusion_path(m: int, hs: list) -> list:
    n = len(hs)
    if n <= 1:
        return []
    k = _split(n)
    if m < k:
        return inclusion_path(m, hs[:k]) + [mth(hs[k:])]
    return inclusion_path(m - k, hs[k:]) + [mth(hs[:k])]


def verify_inclusion(leaf: bytes, index: int, size: int, path: list, root: bytes) -> bool:
    if index < 0 or index >= size:
        return False
    fn, sn, r = index, size - 1, leaf
    for p in path:
        if sn == 0:
            return False
        if fn & 1 or fn == sn:
            r = node_hash(p, r)
            if not fn & 1:
                while not fn & 1 and fn != 0:
                    fn >>= 1
                    sn >>= 1
        else:
            r = node_hash(r, p)
        fn >>= 1
        sn >>= 1
    return sn == 0 and r == root


def _subproof(m: int, hs: list, complete: bool) -> list:
    n = len(hs)
    if m == n:
        return [] if complete else [mth(hs)]
    k = _split(n)
    if m <= k:
        return _subproof(m, hs[:k], complete) + [mth(hs[k:])]
    return _subproof(m - k, hs[k:], False) + [mth(hs[:k])]


def consistency_path(m: int, hs: list) -> list:
    n = len(hs)
    if m <= 0 or m > n:
        raise ValueError("bad sizes")
    if m == n:
        return []
    return _subproof(m, hs, True)


def verify_consistency(m: int, n: int, m_root: bytes, n_root: bytes, proof: list) -> bool:
    if m <= 0 or m > n:
        return False
    if m == n:
        return proof == [] and m_root == n_root
    proof = list(proof)
    if m & (m - 1) == 0:
        proof = [m_root] + proof
    if not proof:
        return False
    fn, sn = m - 1, n - 1
    while fn & 1:
        fn >>= 1
        sn >>= 1
    fr = sr = proof[0]
    for c in proof[1:]:
        if sn == 0:
            return False
        if fn & 1 or fn == sn:
            fr = node_hash(c, fr)
            sr = node_hash(c, sr)
            if not fn & 1:
                while not fn & 1 and fn != 0:
                    fn >>= 1
                    sn >>= 1
        else:
            sr = node_hash(sr, c)
        fn >>= 1
        sn >>= 1
    return fr == m_root and sr == n_root and sn == 0
