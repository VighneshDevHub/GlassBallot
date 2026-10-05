import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from gb import crypto as C
fx = json.load(open(sys.argv[1])); js = json.load(open(sys.argv[2]))
assert C.validate_ballot(js["ballot"]), "server rejects browser ballot"
pub = C.b64d(fx["pub"])
got = C.decrypt_with_ephemeral(pub, C.b64u_d(js["eph_d"]), js["ballot"], fx["eid"])["c"]
assert got == "ananya", got
print("Python opened the browser-sealed ballot:", got)
