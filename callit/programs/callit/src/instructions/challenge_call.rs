use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::*;
use crate::errors::ErrorCode;

#[derive(Accounts)]
#[instruction(stake: u64, confidence: u8)]
pub struct ChallengeCall<'info> {
    #[account(
        mut,
        constraint = call.status == CallStatus::Active @ ErrorCode::CallNotActive,
        constraint = call.deadline > Clock::get()?.unix_timestamp @ ErrorCode::DeadlinePassed
    )]
    pub call: Account<'info, Call>,

    #[account(
        init,
        payer = challenger,
        space = Challenge::SIZE,
        seeds = [
            b"challenge",
            call.key().as_ref(),
            challenger.key().as_ref()
        ],
        bump
    )]
    pub challenge: Account<'info, Challenge>,

    #[account(
        mut,
        seeds = [b"escrow", call.key().as_ref()],
        bump = call.escrow_bump
    )]
    pub escrow: SystemAccount<'info>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub challenger: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<ChallengeCall>,
    stake: u64,
    confidence: u8,
) -> Result<()> {
    let call = &mut ctx.accounts.call;
    let challenge = &mut ctx.accounts.challenge;
    let config = &ctx.accounts.config;
    let clock = Clock::get()?;

    // ============================================
    // VALIDATIONS
    // ============================================

    require!(!config.is_paused, ErrorCode::ProtocolPaused);

    // Cannot challenge your own call
    require!(
        ctx.accounts.challenger.key() != call.caller,
        ErrorCode::CannotChallengeOwnCall
    );

    // Check if already participated
    for participant in call.participants.iter() {
        if *participant == ctx.accounts.challenger.key() {
            return Err(ErrorCode::AlreadyParticipated.into());
        }
        if *participant == Pubkey::default() {
            break; // Reached empty slots
        }
    }

    // Check max challengers (50)
    require!(
        call.challengers_count < 50,
        ErrorCode::MaxChallengersReached
    );

    // Validate confidence levels
    let valid_confidences = [60, 65, 70, 75, 80, 85, 90, 95];
    require!(
        valid_confidences.contains(&confidence),
        ErrorCode::InvalidConfidence
    );

    // Validate stake minimum (0.01 SOL = 10_000_000 lamports)
    require!(stake >= 10_000_000, ErrorCode::StakeTooLow);

    // ============================================
    // TRANSFER STAKE TO ESCROW
    // ============================================

    let transfer = system_program::Transfer {
        from: ctx.accounts.challenger.to_account_info(),
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
    // INITIALIZE CHALLENGE
    // ============================================

    challenge.call_id = call.key();
    challenge.challenger = ctx.accounts.challenger.key();
    challenge.stake = stake;
    challenge.confidence = confidence;
    challenge.created_at = clock.unix_timestamp;

    // ============================================
    // UPDATE CALL
    // ============================================

    // Add challenger to participants array
    let participant_index = call.challengers_count as usize + 1; // +1 because caller is at index 0
    require!(
        participant_index < Call::MAX_PARTICIPANTS,
        ErrorCode::MaxParticipantsReached
    );

    call.participants[participant_index] = ctx.accounts.challenger.key();
    call.challengers_count += 1;

    emit!(CallChallenged {
        call_id: call.key(),
        challenger: ctx.accounts.challenger.key(),
        stake: stake,
        confidence: confidence,
    });

    msg!("Challenge created for call: {}", call.key());

    Ok(())
}

#[event]
pub struct CallChallenged {
    pub call_id: Pubkey,
    pub challenger: Pubkey,
    pub stake: u64,
    pub confidence: u8,
}
