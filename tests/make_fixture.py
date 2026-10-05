import json, os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import create_app
from gb import merkle as M
tmp = tempfile.mkdtemp()
app = create_app(tmp, demo=True); s = app.store
s.seed_votes(11)
entries = s.ledger(); inc = s.inclusion(4)
hs = s.leaves()
json.dump({"pub": s.meta("election_pub"), "eid": s.eid, "entries": entries, "root": M.mth(hs).hex(),
           "mid_root": M.mth(hs[:len(hs)//2]).hex(), "proof": inc, "dir": tmp}, open(sys.argv[1], "w"))
