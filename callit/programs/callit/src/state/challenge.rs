use anchor_lang::prelude::*;

#[account]
pub struct Challenge {
    pub call_id: Pubkey,
    pub challenger: Pubkey,
    pub stake: u64,
    pub confidence: u8,
    pub created_at: i64,
}

impl Challenge {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 1 + 8;
}
