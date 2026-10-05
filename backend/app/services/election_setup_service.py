from __future__ import annotations

import json
import os
import random
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security as core_sec
from app.core.config import get_settings
from app.models.entities import (
    Election,
    ElectionCandidate,
    Role,
    Trustee,
    TrusteeKeyShare,
    User,
    UserRole,
    Voter,
    Witness,
)
from app.models.enums import ElectionState, TokenStatus, WitnessStatus
from app.repositories import (
    AuditRepo,
    ElectionCandidateRepo,
    ElectionRepo,
    MerkleSthRepo,
    RoleRepo,
    TokenRepo,
    TrusteeRepo,
    UserRepo,
    UserRoleRepo,
    VoterRepo,
    WitnessRepo,
)
from app.services.crypto_service import CryptoService
from app.services.merkle_service import MerkleService


FIRST_NAMES = [
    "Aarav", "Diya", "Vihaan", "Isha", "Arjun", "Meera", "Rohan", "Sara",
    "Kunal", "Neha", "Aditya", "Ananya", "Riya", "Kabir", "Aryan", "Priya",
    "Siddharth", "Tara", "Varun", "Zara",
]
LAST_NAMES = [
    "Patil", "Nair", "Khan", "Desai", "Rao", "Joshi", "D'Souza", "Gupta",
    "Sharma", "Verma", "Menon", "Shah", "Iyer", "Kapoor", "Mehta", "Singh",
]

TRUSTEE_ROLE_CODES = ["ELECTION_OFFICER", "FACULTY_TRUSTEE", "STUDENT_TRUSTEE"]
TRUSTEE_DISPLAY_NAMES = ["Election Officer", "Faculty Member Trustee", "Student Representative Trustee"]
WITNESS_CODES = ["RIYA_AGENT", "KABIR_AGENT", "ANANYA_AGENT"]
WITNESS_OWNERS = [
    "Riya Menon Polling Agent",
    "Kabir Shah Polling Agent",
    "Ananya Iyer Polling Agent",
]
CANDIDATE_CODES = ["RIYA", "KABIR", "ANANYA", "NOTA"]
CANDIDATE_DISPLAY_NAMES = ["Riya Menon", "Kabir Shah", "Ananya Iyer", "None of the above"]


class DemoSeedService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def seed_n(self, n: int) -> int:
        from app.repositories import BallotRepo, TokenRepo

        erepo = ElectionRepo(self.session)
        vrepo = VoterRepo(self.session)
        trepo = TokenRepo(self.session)
        brepo = BallotRepo(self.session)
        srepo = MerkleSthRepo(self.session)
        arepo = AuditRepo(self.session)

        elections = await erepo.list_all()
        if not elections:
            return 0
        election = elections[0]
        eid = election.public_id
        pub_bytes = core_sec.b64d(election.election_public_key_b64)

        eligible = [
            v for v in await vrepo.list_for_election(election.id)
            if v.is_eligible and not v.has_completed_vote
        ]
        random.shuffle(eligible)
        choices = CANDIDATE_CODES[:3]
        added = 0
        for voter in eligible:
            if added >= n:
                break
            choice = random.choice(choices)
            ballot_payload, _eph_priv = CryptoService.encrypt_ballot(pub_bytes, eid, choice)

            token_plaintext = core_sec.random_token(32).replace("-", "").replace("_", "")
            if len(token_plaintext) < 64:
                token_plaintext = token_plaintext.ljust(64, "0")
            token_plaintext = token_plaintext[:64]
            token_hash = CryptoService.sha256_hex(token_plaintext.encode())

            token = await trepo.append(election.id, voter.id, token_hash)
            voter.has_received_token = True

            count = await brepo.count_for_election(election.id)
            ledger_index = count

            ballots = await brepo.list_by_election(election.id)
            last_ballot = ballots[-1] if ballots else None
            previous_hash = (
                last_ballot.entry_hash
                if last_ballot
                else CryptoService.ledger_genesis(election.public_id)
            )
            ballot_fingerprint = CryptoService.ballot_fingerprint(ballot_payload)
            entry_hash = CryptoService.entry_hash(
                ledger_index,
                previous_hash,
                ballot_payload,
                token_hash,
            )

            ballot = await brepo.append(
                election_id=election.id,
                ledger_index=ledger_index,
                previous_hash=previous_hash,
                entry_hash=entry_hash,
                token_hash=token_hash,
                ballot_payload=ballot_payload,
                ballot_fingerprint=ballot_fingerprint,
                is_test_ballot=False,
                token_id=token.id,
            )
            token.status = TokenStatus.USED
            token.used_at = datetime.now(timezone.utc)
            voter.has_completed_vote = True

            all_ballots = await brepo.list_by_election(election.id)
            entry_hashes = [b.entry_hash for b in sorted(all_ballots, key=lambda x: x.ledger_index)]
            root = MerkleService.root_from_entry_hashes(entry_hashes)
            size = len(all_ballots)
            sig_b64, _msg, payload = CryptoService.sign_sth(election.public_id, size, root)
            await srepo.append(election.id, size, root, sig_b64, payload)
            await arepo.append_event(
                actor_type="demo_seeder",
                action="VOTE_CAST",
                resource_type="ballot",
                resource_id=str(ballot.id),
                metadata_json={"seeded": True, "ledger_index": ledger_index},
            )
            added += 1
        await self.session.commit()
        return added


class ElectionSetupService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @staticmethod
    def _trustee_share_path() -> str:
        base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        data_dir = os.environ.get("GB_DATA_DIR", os.path.join(base, "data"))
        out = os.path.join(data_dir, "trustee_shares")
        os.makedirs(out, exist_ok=True)
        return out

    async def _ensure_role(self, name: str) -> Role:
        repo = RoleRepo(self.session)
        existing = await repo.first_where(name=name)
        if existing:
            return existing
        return await repo.create(name=name, description="")

    async def _ensure_super_admin(self) -> User:
        settings = get_settings()
        admin_pw = os.environ.get("GB_ADMIN_PASSWORD", "admin123")
        repo = UserRepo(self.session)
        super_role = await self._ensure_role("SUPER_ADMIN")
        ur_repo = UserRoleRepo(self.session)

        # Ensure 'admin' user
        admin_user = await repo.first_where(username="admin")
        if not admin_user:
            password_hash = core_sec.hash_password(admin_pw)
            admin_user = await repo.create(
                email="admin@glassballot.local",
                username="admin",
                password_hash=password_hash,
                is_active=True,
            )
            await ur_repo.create(user_id=admin_user.id, role_id=super_role.id)
        else:
            admin_user.password_hash = core_sec.hash_password(admin_pw)
            await self.session.flush()

        # Ensure 'superadmin' user
        super_user = await repo.first_where(username="superadmin")
        if not super_user:
            password_hash = core_sec.hash_password(admin_pw)
            super_user = await repo.create(
                email="superadmin@glassballot.local",
                username="superadmin",
                password_hash=password_hash,
                is_active=True,
            )
            await ur_repo.create(user_id=super_user.id, role_id=super_role.id)
        else:
            super_user.password_hash = core_sec.hash_password(admin_pw)
            await self.session.flush()

        return admin_user

    async def bootstrap_default_demo(self) -> Election | None:
        erepo = ElectionRepo(self.session)
        if await erepo.any_exists():
            return None

        admin = await self._ensure_super_admin()

        pem_bytes, sth_pub_b64 = CryptoService.load_or_create_sth_key()
        secret_scalar, pub_bytes = CryptoService.generate_election_keypair()
        pub_b64 = core_sec.b64e(pub_bytes)

        shares = CryptoService.shamir_split(secret_scalar, threshold=2, trustee_count=3)
        del secret_scalar

        share_dir = self._trustee_share_path()
        share_refs: list[str] = []
        for (x, y), role_code, role_name in zip(shares, TRUSTEE_ROLE_CODES, TRUSTEE_DISPLAY_NAMES):
            ref = os.path.join(share_dir, f"trustee_{x}.json")
            with open(ref, "w") as f:
                json.dump({"trustee": x, "role_code": role_code, "role_name": role_name, "x": x, "y": hex(y)}, f)
            share_refs.append(ref)

        election = await erepo.create(
            public_id="SC-PRES-2026",
            title="Student Council President 2026",
            college_name="Ramnath Govind Institute of Technology",
            state=ElectionState.OPEN,
            election_public_key=pub_bytes,
            election_public_key_b64=pub_b64,
            sth_public_key_b64=sth_pub_b64,
            metadata_json={},
        )

        cand_repo = ElectionCandidateRepo(self.session)
        for i, (code, name) in enumerate(zip(CANDIDATE_CODES, CANDIDATE_DISPLAY_NAMES)):
            await cand_repo.create(
                election_id=election.id,
                candidate_code=code,
                display_name=name,
                sort_order=i,
            )

        vrepo = VoterRepo(self.session)
        rng = random.Random(7)
        for i in range(1, 41):
            ext_id = f"RGIT26{i:03d}"
            fn = rng.choice(FIRST_NAMES)
            ln = rng.choice(LAST_NAMES)
            await vrepo.create(
                election_id=election.id,
                voter_external_id=ext_id,
                display_name=f"{fn} {ln}",
                is_eligible=True,
                has_received_token=False,
                has_completed_vote=False,
                metadata_json={},
            )

        trepo = TrusteeRepo(self.session)
        ks_repo = RoleRepo and TrusteeKeyShareRepo and True
        from app.repositories import KeyShareRepo

        for idx, (role_code, display_name, share_ref) in enumerate(
            zip(TRUSTEE_ROLE_CODES, TRUSTEE_DISPLAY_NAMES, share_refs)
        ):
            t = await trepo.create(
                election_id=election.id,
                role_code=role_code,
                display_name=display_name,
                threshold_group="2-of-3",
            )
            await KeyShareRepo(self.session).create(
                trustee_id=t.id,
                election_id=election.id,
                encrypted_share_ref=share_ref,
                key_version="v1",
                metadata_json={},
            )

        wrepo = WitnessRepo(self.session)
        for code, owner in zip(WITNESS_CODES, WITNESS_OWNERS):
            await wrepo.upsert_status(
                election_id=election.id,
                witness_code=code,
                owner_name=owner,
                status=WitnessStatus.WAITING,
                last_accepted_size=0,
                last_accepted_root=None,
            )

        srepo = MerkleSthRepo(self.session)
        root = MerkleService.mth([]).hex()
        sig_b64, _msg, payload = CryptoService.sign_sth(election.public_id, 0, root)
        await srepo.append(election.id, 0, root, sig_b64, payload)

        arepo = AuditRepo(self.session)
        await arepo.append_event(
            actor_type="system",
            action="ELECTION_CREATED",
            resource_type="election",
            resource_id=str(election.id),
            metadata_json={
                "trustees": "2-of-3",
                "voters": 40,
                "candidates": len(CANDIDATE_CODES),
                "admin_id": str(admin.id),
            },
        )

        await self.session.commit()
        return election


class RoleRepo:  # local lightweight complement if missing in __init__
    model = Role

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def first_where(self, **kwargs):
        from sqlalchemy import select
        stmt = select(self.model)
        for k, v in kwargs.items():
            stmt = stmt.where(getattr(self.model, k) == v)
        r = await self.session.execute(stmt.limit(1))
        return r.scalars().first()

    async def create(self, **kwargs):
        obj = self.model(**kwargs)
        self.session.add(obj)
        await self.session.flush()
        return obj


class UserRepo:
    model = User

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def first_where(self, **kwargs):
        from sqlalchemy import select
        stmt = select(self.model)
        for k, v in kwargs.items():
            stmt = stmt.where(getattr(self.model, k) == v)
        r = await self.session.execute(stmt.limit(1))
        return r.scalars().first()

    async def create(self, **kwargs):
        obj = self.model(**kwargs)
        self.session.add(obj)
        await self.session.flush()
        return obj

    async def get(self, id_val):
        return await self.session.get(self.model, id_val)


class UserRoleRepo:
    model = UserRole

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, **kwargs):
        obj = self.model(**kwargs)
        self.session.add(obj)
        await self.session.flush()
        return obj


class TrusteeKeyShareRepo:
    model = TrusteeKeyShare

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, **kwargs):
        obj = self.model(**kwargs)
        self.session.add(obj)
        await self.session.flush()
        return obj
