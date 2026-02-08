use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::*;
use crate::errors::ErrorCode;

#[derive(Accounts)]
#[instruction(claim: String, category: CallCategory, token_address: Option<Pubkey>, target_price: Option<i64>, stake: u64, confidence: u8, deadline: i64, call_nonce: i64)]
pub struct MakeCall<'info> {
    #[account(
        init,
        payer = caller,
        space = Call::SIZE,
        seeds = [b"call", caller.key().as_ref(), &call_nonce.to_le_bytes()],
        bump
    )]
    pub call: Account<'info, Call>,

    #[account(
        mut,
        seeds = [b"escrow", call.key().as_ref()],
        bump
    )]
    pub escrow: SystemAccount<'info>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,

    /// CHECK: Pyth price feed (validated in handler)
    pub pyth_price_feed: Option<AccountInfo<'info>>,

    #[account(mut)]
    pub caller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
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
    let call = &mut ctx.accounts.call;
    let config = &ctx.accounts.config;
    let clock = Clock::get()?;

    // ============================================
    // VALIDATIONS
    // ============================================

    require!(!config.is_paused, ErrorCode::ProtocolPaused);

    // Validate claim length
    require!(
        claim.len() >= 1 && claim.len() <= Call::MAX_CLAIM_LENGTH,
        ErrorCode::InvalidClaimLength
    );

    // Validate nonce (must be within ±30s of current time)
    require!(
        (call_nonce - clock.unix_timestamp).abs() <= 30,
        ErrorCode::InvalidCallNonce
    );

    // Validate stake minimum (0.05 SOL = 50_000_000 lamports)
    require!(stake >= 50_000_000, ErrorCode::StakeTooLow);

    // Validate confidence levels
    let valid_confidences = [60, 65, 70, 75, 80, 85, 90, 95];
    require!(
        valid_confidences.contains(&confidence),
        ErrorCode::InvalidConfidence
    );

    // Validate 24-hour minimum deadline
    require!(
        deadline >= clock.unix_timestamp + 86400,
        ErrorCode::DeadlineTooSoon
    );

    // Category-specific validations
    let creation_price = match category {
        CallCategory::TokenPrice => {
            require!(
                token_address.is_some() && target_price.is_some(),
                ErrorCode::MissingPriceData
            );

            // TODO: Fetch current price from Pyth
            // For now, set to None (will be implemented with Pyth integration)
            None
        }
        CallCategory::RugPrediction => {
            require!(token_address.is_some(), ErrorCode::MissingTokenAddress);
            None
        }
    };

    // ============================================
    // TRANSFER STAKE TO ESCROW
    // ============================================

    let transfer = system_program::Transfer {
        from: ctx.accounts.caller.to_account_info(),
        to: ctx.accounts.escrow.to_account_info(),
    };

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer
        ),
        stake
    )?;

    // ============================================
    // INITIALIZE CALL
    // ============================================

    call.caller = ctx.accounts.caller.key();
    call.claim = claim;
    call.category = category;
    call.token_address = token_address;
    call.target_price = target_price;
    call.creation_price = creation_price;
    call.stake = stake;
    call.confidence = confidence;
    call.deadline = deadline;
    call.created_at = clock.unix_timestamp;
    call.status = CallStatus::Active;
    call.challengers_count = 0;
    call.participants = [Pubkey::default(); 20];
    call.participants[0] = ctx.accounts.caller.key(); // Caller is first participant
    call.escrow_bump = ctx.bumps.escrow;

    emit!(CallCreated {
        call_id: call.key(),
        caller: call.caller,
        stake: stake,
        confidence: confidence,
        deadline: deadline,
    });

    msg!("Call created: {}", call.key());

    Ok(())
}

#[event]
pub struct CallCreated {
    pub call_id: Pubkey,
    pub caller: Pubkey,
    pub stake: u64,
    pub confidence: u8,
    pub deadline: i64,
}
