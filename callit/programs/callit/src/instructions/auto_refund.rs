use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::*;
use crate::errors::ErrorCode;

/// Permissionless auto-refund after 24h oracle timeout
/// remaining_accounts layout:
/// [0..N-1]     = Challenge PDA accounts
/// [N..2N-1]    = Challenger wallet accounts
/// [2N]         = Caller wallet account
#[derive(Accounts)]
pub struct AutoRefundCall<'info> {
    #[account(
        mut,
        constraint = call.status == CallStatus::Active @ ErrorCode::CallNotActive
    )]
    pub call: Account<'info, Call>,

    #[account(
        mut,
        seeds = [b"escrow", call.key().as_ref()],
        bump = call.escrow_bump
    )]
    pub escrow: SystemAccount<'info>,

    /// CHECK: Anyone can trigger (no authorization required)
    pub triggerer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler<'info>(ctx: Context<'_, '_, 'info, 'info, AutoRefundCall<'info>>) -> Result<()> {
    let call = &mut ctx.accounts.call;
    let clock = Clock::get()?;
    let n = call.challengers_count as usize;

    // Validate 24h timeout
    require!(
        clock.unix_timestamp > call.deadline + 86400,
        ErrorCode::RefundNotYetAvailable
    );

    // FIX 13: Properly refund all challengers using remaining_accounts
    require!(
        ctx.remaining_accounts.len() == (n * 2) + 1,
        ErrorCode::InvalidRemainingAccounts
    );

    let escrow_bump = call.escrow_bump;
    let call_key = call.key();
    let seeds = &[b"escrow", call_key.as_ref(), &[escrow_bump]];
    let signer = &[&seeds[..]];

    // ============================================
    // REFUND EACH CHALLENGER THEIR ACTUAL STAKE
    // ============================================

    for i in 0..n {
        // Load challenge PDA to get stake amount
        let challenge_account = &ctx.remaining_accounts[i];
        let challenge: Account<Challenge> = Account::try_from(challenge_account)
            .map_err(|_| ErrorCode::InvalidChallengeAccount)?;

        require!(
            challenge.call_id == call_key,
            ErrorCode::ChallengeMismatch
        );

        let challenger_wallet = &ctx.remaining_accounts[n + i];

        // Verify wallet identity
        require!(
            challenger_wallet.key() == challenge.challenger,
            ErrorCode::InvalidChallengerWallet
        );

        // Refund full stake
        let transfer = system_program::Transfer {
            from: ctx.accounts.escrow.to_account_info(),
            to: challenger_wallet.to_account_info(),
        };

        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                transfer,
                signer
            ),
            challenge.stake
        )?;

        msg!("Refunded {} lamports to challenger {}", challenge.stake, challenge.challenger);
    }

    // ============================================
    // REFUND CALLER
    // ============================================

    let caller_wallet = &ctx.remaining_accounts[n * 2];

    // Verify caller identity
    require!(
        caller_wallet.key() == call.caller,
        ErrorCode::InvalidCallerWallet
    );

    let transfer = system_program::Transfer {
        from: ctx.accounts.escrow.to_account_info(),
        to: caller_wallet.to_account_info(),
    };

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            transfer,
            signer
        ),
        call.stake
    )?;

    msg!("Refunded {} lamports to caller {}", call.stake, call.caller);

    // ============================================
    // UPDATE STATUS
    // ============================================

    call.status = CallStatus::AutoRefunded;

    emit!(CallAutoRefunded {
        call_id: call_key,
        refunded_at: clock.unix_timestamp,
    });

    Ok(())
}

#[event]
pub struct CallAutoRefunded {
    pub call_id: Pubkey,
    pub refunded_at: i64,
}
