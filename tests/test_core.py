import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from gb import merkle as M, crypto as C  # noqa: E402


class TestMerkle(unittest.TestCase):
    def test_inclusion_and_consistency_all_sizes(self):
        hs_all = [M.leaf_hash(bytes([i]) * 4) for i in range(40)]
        for n in range(1, 41):
            hs = hs_all[:n]
            root = M.mth(hs)
            for i in range(n):
                p = M.inclusion_path(i, hs)
                self.assertTrue(M.verify_inclusion(hs[i], i, n, p, root), (n, i))
                if n > 1:
                    self.assertFalse(M.verify_inclusion(M.leaf_hash(b"x"), i, n, p, root))
            for m in range(1, n + 1):
                p = M.consistency_path(m, hs)
                self.assertTrue(M.verify_consistency(m, n, M.mth(hs[:m]), root, p), (m, n))
                if m < n:
                    self.assertFalse(M.verify_consistency(m, n, M.leaf_hash(b"evil"), root, p))

    def test_rewrite_detected(self):
        hs = [M.leaf_hash(bytes([i])) for i in range(10)]
        old_root = M.mth(hs[:6])
        hs2 = list(hs)
        hs2[2] = M.leaf_hash(b"changed")
        p = M.consistency_path(6, hs2)
        self.assertFalse(M.verify_consistency(6, 10, old_root, M.mth(hs2), p))


class TestCrypto(unittest.TestCase):
    def test_shamir(self):
        secret, pub = C.gen_election_key()
        shares = C.shamir_split(secret, 2, 3)
        for a in range(3):
            for b in range(3):
                if a != b:
                    self.assertEqual(C.shamir_combine([shares[a], shares[b]]), secret)
        self.assertNotEqual(C.shamir_combine([shares[0]]), secret)
        self.assertEqual(C.pub_from_secret(secret), pub)

    def test_ballot_roundtrip_and_spoil(self):
        secret, pub = C.gen_election_key()
        b, d = C.encrypt_ballot(pub, "E1", "riya")
        self.assertTrue(C.validate_ballot(b))
        self.assertEqual(C.decrypt_ballot(secret, b, "E1")["c"], "riya")
        self.assertEqual(C.decrypt_with_ephemeral(pub, d, b, "E1")["c"], "riya")
        with self.assertRaises(Exception):
            C.decrypt_ballot(secret, b, "OTHER-ELECTION")
        lens = {len(C.b64d(C.encrypt_ballot(pub, "E1", c)[0]["ct"])) for c in ("riya", "nota", "ananya")}
        self.assertEqual(lens, {C.CT_LEN})

    def test_validate_rejects_junk(self):
        for bad in (None, {}, {"v": 1}, {"v": 1, "eph": "AA==", "iv": "AA==", "ct": "AA=="}, "x"):
            self.assertFalse(C.validate_ballot(bad))


if __name__ == "__main__":
    unittest.main()
