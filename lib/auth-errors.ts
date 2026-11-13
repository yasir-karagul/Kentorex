export class ServiceConfigurationError extends Error {
  constructor(message = "Authentication security services are not configured.") {
    super(message);
    this.name = "ServiceConfigurationError";
  }
}

export class AuthServiceUnavailableError extends Error {
  constructor() {
    super("An authentication service is temporarily unavailable. Please try again.");
    this.name = "AuthServiceUnavailableError";
  }
}

export class TurnstileRejectedError extends Error {
  constructor() {
    super("Please complete the security check and try again.");
    this.name = "TurnstileRejectedError";
  }
}

export class AuthRateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Too many attempts. Please wait before trying again.");
    this.name = "AuthRateLimitError";
  }
}

export class DuplicateAccountError extends Error {
  constructor() {
    super("An account with that email already exists.");
    this.name = "DuplicateAccountError";
  }
}

export class VerificationEmailDeliveryError extends Error {
  constructor() {
    super("The verification email could not be sent. Please try again shortly.");
    this.name = "VerificationEmailDeliveryError";
  }
}
