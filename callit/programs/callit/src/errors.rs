use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Protocol is currently paused")]
    ProtocolPaused,

    #[msg("Invalid call nonce (must be current timestamp ±30s)")]
    InvalidCallNonce,

    #[msg("Claim must be 1-280 characters")]
    InvalidClaimLength,

    #[msg("Stake amount too low")]
    StakeTooLow,

    #[msg("Confidence must be 60, 65, 70, 75, 80, 85, 90, or 95")]
    InvalidConfidence,

    #[msg("Deadline must be at least 24 hours from now")]
    DeadlineTooSoon,

    #[msg("Missing token address or target price")]
    MissingPriceData,

    #[msg("Missing token address")]
    MissingTokenAddress,

    #[msg("Invalid Pyth price account")]
    InvalidPythAccount,

    #[msg("Pyth price unavailable")]
    PythPriceUnavailable,

    #[msg("Pyth price is stale (>60s old)")]
    PythPriceStale,

    #[msg("Target price too close to current price (min 10% distance)")]
    TargetTooClose,

    #[msg("Cannot challenge your own call")]
    CannotChallengeOwnCall,

    #[msg("Wallet already participated in this call")]
    AlreadyParticipated,

    #[msg("Maximum challengers reached (50)")]
    MaxChallengersReached,

    #[msg("Maximum participants reached (20)")]
    MaxParticipantsReached,

    #[msg("Call is not active")]
    CallNotActive,

    #[msg("Call already resolved")]
    AlreadyResolved,

    #[msg("Deadline has not been reached yet")]
    DeadlineNotReached,

    #[msg("Deadline has already passed")]
    DeadlinePassed,

    #[msg("Insufficient oracle signatures (need 2 of 3)")]
    InsufficientOracleSignatures,

    #[msg("Unauthorized oracle signer")]
    UnauthorizedOracle,

    #[msg("Invalid oracle signature")]
    InvalidOracleSignature,

    #[msg("Invalid instructions sysvar")]
    InvalidInstructionSysvar,

    #[msg("Invalid oracle public key format")]
    InvalidOraclePubkey,

    #[msg("Challenge does not belong to this call")]
    ChallengeMismatch,

    #[msg("Invalid challenge account")]
    InvalidChallengeAccount,

    #[msg("Invalid remaining accounts count")]
    InvalidRemainingAccounts,

    #[msg("Challenger wallet does not match challenge record")]
    InvalidChallengerWallet,

    #[msg("Caller wallet does not match call record")]
    InvalidCallerWallet,

    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,

    #[msg("Auto-refund not yet available (must wait 24h past deadline)")]
    RefundNotYetAvailable,
}
