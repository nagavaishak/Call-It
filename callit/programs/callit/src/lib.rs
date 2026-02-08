use anchor_lang::prelude::*;

declare_id!("3Uo8DRnQTPhf9DtfchoBBbFHn8jXKov347RpTqBp4G3A");

pub mod state;
pub mod instructions;
pub mod errors;

use instructions::*;
use state::*;

#[program]
pub mod callit {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        oracle_signers: [Pubkey; 3],
    ) -> Result<()> {
        instructions::initialize::handler(ctx, oracle_signers)
    }

    pub fn make_call(
        ctx: Context<MakeCall>,
        claim: String,
        category: CallCategory,
        token_address: Option<Pubkey>,
        target_price: Option<i64>,
        stake: u64,
        confidence: u8,
        deadline: i64,
        call_nonce: i64,
    ) -> Result<()> {
        instructions::make_call::handler(
            ctx,
            claim,
            category,
            token_address,
            target_price,
            stake,
            confidence,
            deadline,
            call_nonce,
        )
    }

    pub fn challenge_call(
        ctx: Context<ChallengeCall>,
        stake: u64,
        confidence: u8,
    ) -> Result<()> {
        instructions::challenge_call::handler(ctx, stake, confidence)
    }

    pub fn resolve_call<'info>(
        ctx: Context<'_, '_, 'info, 'info, ResolveCall<'info>>,
        outcome: resolve_call::Outcome,
    ) -> Result<()> {
        instructions::resolve_call::handler(ctx, outcome)
    }

    pub fn auto_refund<'info>(ctx: Context<'_, '_, 'info, 'info, AutoRefundCall<'info>>) -> Result<()> {
        instructions::auto_refund::handler(ctx)
    }
}
