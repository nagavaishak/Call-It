use anchor_lang::prelude::*;

#[account]
pub struct GlobalConfig {
    pub authority: Pubkey,
    pub oracle_signers: [Pubkey; 3],
    pub protocol_fee_bps: u16,
    pub is_paused: bool,
    pub bump: u8,
}

impl GlobalConfig {
    pub const SIZE: usize = 8 + 32 + (32 * 3) + 2 + 1 + 1;
}
