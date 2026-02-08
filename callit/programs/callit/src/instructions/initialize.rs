use anchor_lang::prelude::*;
use crate::state::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = GlobalConfig::SIZE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<Initialize>,
    oracle_signers: [Pubkey; 3],
) -> Result<()> {
    let config = &mut ctx.accounts.config;

    config.authority = ctx.accounts.authority.key();
    config.oracle_signers = oracle_signers;
    config.protocol_fee_bps = 500; // 5%
    config.is_paused = false;
    config.bump = ctx.bumps.config;

    msg!("Protocol initialized with 3 oracle signers");

    Ok(())
}
