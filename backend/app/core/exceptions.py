from __future__ import annotations


class GlassBallotError(Exception):
    def __init__(self, message: str, status_code: int = 400, code: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code or self.__class__.__name__


class AuthError(GlassBallotError):
    def __init__(self, message: str = "Authentication required.", status_code: int = 401, code: str | None = None) -> None:
        super().__init__(message, status_code, code=code)


class InvalidOtpError(AuthError):
    def __init__(self, message: str = "Invalid or expired one-time code.") -> None:
        super().__init__(message, 401)


class OtpLockedError(AuthError):
    def __init__(self, message: str = "Too many wrong attempts. Request a new code.") -> None:
        super().__init__(message, 401)


class InvalidTokenError(GlassBallotError):
    def __init__(self, message: str = "Invalid or already used ballot token.") -> None:
        super().__init__(message, 403)


class MalformedBallotError(GlassBallotError):
    def __init__(self, message: str = "Ballot failed structural validation.") -> None:
        super().__init__(message, 422)


class StateTransitionError(GlassBallotError):
    def __init__(self, message: str = "Invalid election state transition.") -> None:
        super().__init__(message, 409)


class IntegrityFailureError(GlassBallotError):
    def __init__(self, message: str = "Integrity check failed.") -> None:
        super().__init__(message, 500)


class DemoDisabledError(GlassBallotError):
    def __init__(self, message: str = "Demo tools are disabled.") -> None:
        super().__init__(message, 403)


class ForbiddenError(GlassBallotError):
    def __init__(self, message: str = "Insufficient permissions.") -> None:
        super().__init__(message, 403)


class NotFoundError(GlassBallotError):
    def __init__(self, message: str = "Not found.") -> None:
        super().__init__(message, 404)


class RateLimitError(GlassBallotError):
    def __init__(self, message: str = "Too many requests. Wait and try again.") -> None:
        super().__init__(message, 429)


class CsrfError(GlassBallotError):
    def __init__(self, message: str = "Missing required CSRF header.") -> None:
        super().__init__(message, 403)


class ElectionClosedError(GlassBallotError):
    def __init__(self, message: str = "Voting is closed.") -> None:
        super().__init__(message, 409)


class ElectionFrozenError(GlassBallotError):
    def __init__(self, message: str = "Election frozen due to integrity incident.") -> None:
        super().__init__(message, 409)


class TallyError(GlassBallotError):
    def __init__(self, message: str = "Tally failed.", status_code: int = 400) -> None:
        super().__init__(message, status_code)


class TrusteeSharesInvalidError(TallyError):
    def __init__(self, message: str = "Trustee shares do not unlock this election.") -> None:
        super().__init__(message, 403)


class TrusteeThresholdError(TallyError):
    def __init__(self, message: str = "Not enough distinct trustee approvals.") -> None:
        super().__init__(message, 422)
