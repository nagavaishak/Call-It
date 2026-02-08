use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::solana_program::sysvar::instructions as sysvar_ix;
use crate::state::*;
use crate::errors::ErrorCode;

// Ed25519 program ID constant
const ED25519_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    0xed, 0x25, 0x51, 0x9, 0x0, 0x0, 0x0, 0x0,
    0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
    0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
    0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0,
]);

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum Outcome {
    CallerWins,
    CallerLoses,
}

/// remaining_accounts layout:
/// [0..N-1]     = Challenge PDA accounts
/// [N..2N-1]    = Challenger wallet accounts (for payouts)
/// [2N]         = Caller wallet account (for payout)
#[derive(Accounts)]
pub struct ResolveCall<'info> {
    #[account(
        mut,
        constraint = call.status == CallStatus::Active @ ErrorCode::AlreadyResolved
    )]
    pub call: Account<'info, Call>,

    #[account(
        mut,
        seeds = [b"escrow", call.key().as_ref()],
        bump = call.escrow_bump
    )]
    pub escrow: SystemAccount<'info>,

    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,

    /// FIX 5: Instructions sysvar for Ed25519 verification
    /// CHECK: Instructions sysvar
    #[account(address = sysvar_ix::ID)]
    pub instructions_sysvar: AccountInfo<'info>,

    /// CHECK: Oracle signer (verified via Ed25519 sysvar check)
    pub oracle: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, ResolveCall<'info>>,
    outcome: Outcome,
) -> Result<()> {
    let call = &mut ctx.accounts.call;
    let config = &ctx.accounts.config;
    let clock = Clock::get()?;
    let call_key = call.key();

    // ============================================
    // VALIDATIONS
    // ============================================

    require!(
        clock.unix_timestamp >= call.deadline,
        ErrorCode::DeadlineNotReached
    );

    // FIX 5: Verify 2 of 3 oracle signatures via Instructions sysvar
    verify_oracle_signatures(
        &ctx.accounts.instructions_sysvar,
        &config.oracle_signers,
        2,  // Require 2 of 3
        call_key,
        &outcome,
        clock.unix_timestamp
    )?;

    // ============================================
    // LOAD CHALLENGES
    // ============================================

    let n = call.challengers_count as usize;

    // Handle zero challengers case
    if n == 0 {
        return resolve_with_no_challengers(ctx, &outcome);
    }

    require!(
        ctx.remaining_accounts.len() == (n * 2) + 1,
        ErrorCode::InvalidRemainingAccounts
    );

    let mut challenges: Vec<Challenge> = Vec::with_capacity(n);

    for i in 0..n {
        let challenge_account = &ctx.remaining_accounts[i];
        let challenge: Account<Challenge> = Account::try_from(challenge_account)
            .map_err(|_| ErrorCode::InvalidChallengeAccount)?;

        require!(
            challenge.call_id == call_key,
            ErrorCode::ChallengeMismatch
        );

        challenges.push(challenge.into_inner());
    }

    // NEW CRITICAL FIX: Verify wallet identities match
    for (index, challenge) in challenges.iter().enumerate() {
        let challenger_wallet = &ctx.remaining_accounts[n + index];
        require!(
            challenger_wallet.key() == challenge.challenger,
            ErrorCode::InvalidChallengerWallet
        );
    }

    let caller_wallet = &ctx.remaining_accounts[n * 2];
    require!(
        caller_wallet.key() == call.caller,
        ErrorCode::InvalidCallerWallet
    );

    // ============================================
    // DISTRIBUTE FUNDS
    // ============================================

    let escrow_bump = call.escrow_bump;
    let seeds = &[b"escrow", call_key.as_ref(), &[escrow_bump]];
    let signer = &[&seeds[..]];

    if outcome == Outcome::CallerWins {
        // ========================================
        // CALLER WINS
        // ========================================

        let mut total_challenger_stakes: u64 = 0;
        for c in &challenges {
            total_challenger_stakes = total_challenger_stakes
                .checked_add(c.stake)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
        }

        let caller_payout = call.stake
            .checked_add(total_challenger_stakes)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

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
            caller_payout
        )?;

        msg!("Caller wins: {} lamports distributed", caller_payout);

    } else {
        // ========================================
        // CALLER LOSES
        // ========================================

        let total_pot = call.stake;

        let mut total_challenger_stakes: u64 = 0;
        for c in &challenges {
            total_challenger_stakes = total_challenger_stakes
                .checked_add(c.stake)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
        }

        let mut total_distributed: u64 = 0;

        // Distribute to all challengers except last
        for index in 0..(n - 1) {
            let challenger = &challenges[index];

            // Proportional share calculation (u128 intermediate to prevent overflow)
            let numerator = (challenger.stake as u128)
                .checked_mul(total_pot as u128)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
            let denominator = total_challenger_stakes as u128;
            let raw_share = (numerator / denominator) as u64;

            // Cap at 1.5x
            let max_win = challenger.stake
                .checked_mul(15)
                .ok_or(ErrorCode::ArithmeticOverflow)?
                .checked_div(10)
                .ok_or(ErrorCode::ArithmeticOverflow)?;

            let actual_share = std::cmp::min(raw_share, max_win);
            let challenger_payout = challenger.stake
                .checked_add(actual_share)
                .ok_or(ErrorCode::ArithmeticOverflow)?;

            let challenger_wallet = &ctx.remaining_accounts[n + index];

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
                challenger_payout
            )?;

            total_distributed = total_distributed
                .checked_add(actual_share)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
        }

        // FIX 6: Last challenger gets remainder (handles rounding dust)
        let last_index = n - 1;
        let last_challenger = &challenges[last_index];
        let last_challenger_wallet = &ctx.remaining_accounts[n + last_index];

        let remaining_pot = total_pot.saturating_sub(total_distributed);

        // Last challenger gets: their stake + whatever's left (no cap)
        let last_payout = last_challenger.stake
            .checked_add(remaining_pot)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        let transfer = system_program::Transfer {
            from: ctx.accounts.escrow.to_account_info(),
            to: last_challenger_wallet.to_account_info(),
        };

        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                transfer,
                signer
            ),
            last_payout
        )?;

        msg!("Challengers distributed {} lamports (last got dust)", total_pot);
    }

    // ============================================
    // UPDATE STATUS
    // ============================================

    call.status = match outcome {
        Outcome::CallerWins => CallStatus::ResolvedCallerWins,
        Outcome::CallerLoses => CallStatus::ResolvedCallerLoses,
    };

    emit!(CallResolved {
        call_id: call_key,
        outcome: outcome.clone(),
        resolved_at: clock.unix_timestamp,
    });

    Ok(())
}

/// FIX 5: Verify oracle signatures via Instructions sysvar (Solana's on-chain pattern)
fn verify_oracle_signatures(
    instructions_sysvar: &AccountInfo,
    authorized_oracles: &[Pubkey; 3],
    required_count: usize,
    call_id: Pubkey,
    outcome: &Outcome,
    timestamp: i64,
) -> Result<()> {

    let mut verified_oracles: Vec<Pubkey> = Vec::new();

    // Load current instruction index
    let current_index = sysvar_ix::load_current_index_checked(instructions_sysvar)?;

    // Scan all instructions in transaction for Ed25519 SigVerify instructions
    for i in 0..current_index {
        let ix = sysvar_ix::load_instruction_at_checked(i as usize, instructions_sysvar)
            .map_err(|_| ErrorCode::InvalidInstructionSysvar)?;

        // Skip if not Ed25519 program
        if ix.program_id != ED25519_PROGRAM_ID {
            continue;
        }

        // Parse Ed25519 instruction data
        if ix.data.len() < 2 {
            continue;
        }

        let num_signatures = ix.data[0] as usize;

        for sig_idx in 0..num_signatures {
            let offset_base = 2 + (sig_idx * 14);
            if offset_base + 14 > ix.data.len() {
                continue;
            }

            // Extract public key offset (bytes 6-7)
            let pubkey_offset = u16::from_le_bytes([
                ix.data[offset_base + 6],
                ix.data[offset_base + 7],
            ]) as usize;

            if pubkey_offset + 32 > ix.data.len() {
                continue;
            }

            // Extract public key
            let pubkey_bytes = &ix.data[pubkey_offset..pubkey_offset + 32];
            let oracle_pubkey = Pubkey::new_from_array(
                pubkey_bytes.try_into().map_err(|_| ErrorCode::InvalidOraclePubkey)?
            );

            // Check if this is an authorized oracle
            if authorized_oracles.contains(&oracle_pubkey) {
                // Extract message offset (bytes 10-11)
                let message_offset = u16::from_le_bytes([
                    ix.data[offset_base + 10],
                    ix.data[offset_base + 11],
                ]) as usize;

                // Extract message length (bytes 12-13)
                let message_len = u16::from_le_bytes([
                    ix.data[offset_base + 12],
                    ix.data[offset_base + 13],
                ]) as usize;

                if message_offset + message_len > ix.data.len() {
                    continue;
                }

                // Verify message contains correct call_id + outcome + timestamp
                let message = &ix.data[message_offset..message_offset + message_len];
                let expected_message = create_resolution_message(call_id, outcome, timestamp);

                if message == expected_message.as_slice() {
                    verified_oracles.push(oracle_pubkey);
                }
            }
        }
    }

    // Require at least 2 verified oracle signatures
    require!(
        verified_oracles.len() >= required_count,
        ErrorCode::InsufficientOracleSignatures
    );

    msg!("Verified {} oracle signatures", verified_oracles.len());

    Ok(())
}

fn create_resolution_message(
    call_id: Pubkey,
    outcome: &Outcome,
    timestamp: i64,
) -> Vec<u8> {
    let mut message = Vec::new();
    message.extend_from_slice(call_id.as_ref());
    message.push(match outcome {
        Outcome::CallerWins => 1,
        Outcome::CallerLoses => 0,
    });
    message.extend_from_slice(&timestamp.to_le_bytes());
    message
}

/// Handle case with zero challengers
fn resolve_with_no_challengers<'info>(
    ctx: Context<'_, '_, 'info, 'info, ResolveCall<'info>>,
    _outcome: &Outcome,
) -> Result<()> {
    let call = &mut ctx.accounts.call;
    let escrow_bump = call.escrow_bump;

    // Verify we have exactly 1 remaining account (caller wallet)
    require!(
        ctx.remaining_accounts.len() == 1,
        ErrorCode::InvalidRemainingAccounts
    );

    let caller_wallet = &ctx.remaining_accounts[0];

    // NEW CRITICAL FIX: Verify wallet matches caller
    require!(
        caller_wallet.key() == call.caller,
        ErrorCode::InvalidCallerWallet
    );

    let call_key = call.key();
    let seeds = &[b"escrow", call_key.as_ref(), &[escrow_bump]];
    let signer = &[&seeds[..]];

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

    // Default to caller win if unchallenged
    call.status = CallStatus::ResolvedCallerWins;

    msg!("Zero challengers - stake returned to caller");

    Ok(())
}

#[event]
pub struct CallResolved {
    pub call_id: Pubkey,
    pub outcome: Outcome,
    pub resolved_at: i64,
}
