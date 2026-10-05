from enum import StrEnum


class ElectionState(StrEnum):
    DRAFT = "DRAFT"
    SETUP = "SETUP"
    OPEN = "OPEN"
    CLOSING = "CLOSING"
    CLOSED = "CLOSED"
    TALLYING = "TALLYING"
    COMPLETED = "COMPLETED"
    FROZEN = "FROZEN"
    DECRYPTING = "DECRYPTING"
    PUBLISHED = "PUBLISHED"


class TokenStatus(StrEnum):
    ISSUED = "ISSUED"
    USED = "USED"
    VOID = "VOID"
    SPOILED = "SPOILED"


class WitnessStatus(StrEnum):
    WAITING = "WAITING"
    SYNCED = "SYNCED"
    ALARM = "ALARM"
    OFFLINE = "OFFLINE"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


class IntegrityStatus(StrEnum):
    VERIFIED = "VERIFIED"
    COMPROMISED = "COMPROMISED"
    PENDING = "PENDING"


class ApprovalStatus(StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"


class AlertSeverity(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


TallySessionStatus = ApprovalStatus
WitnessObservationStatus = WitnessStatus

