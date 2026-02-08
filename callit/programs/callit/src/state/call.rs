use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum CallCategory {
    TokenPrice,
    RugPrediction,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum CallStatus {
    Active,
    ResolvedCallerWins,
    ResolvedCallerLoses,
    AutoRefunded,
}

#[account]
pub struct Call {
    pub caller: Pubkey,
    pub claim: String,
    pub category: CallCategory,
    pub token_address: Option<Pubkey>,
    pub target_price: Option<i64>,
    pub creation_price: Option<i64>,
    pub stake: u64,
    pub confidence: u8,
    pub deadline: i64,
    pub created_at: i64,
    pub status: CallStatus,
    pub challengers_count: u8,
    pub participants: [Pubkey; 20],  // Reduced from 51 to 20 to save stack space
    pub escrow_bump: u8,
}

impl Call {
    pub const MAX_CLAIM_LENGTH: usize = 280;
    pub const MAX_PARTICIPANTS: usize = 20;  // Reduced to manage stack size
    pub const SIZE: usize = 8 + 32 + (4 + 280) + 1 + (1 + 32) + (1 + 8) + (1 + 8) + 8 + 1 + 8 + 8 + 1 + 1 + (32 * 20) + 1;
}
