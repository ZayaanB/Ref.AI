use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("5YpYBhXdpqUuw7gpmsuoL3bsyW9XYsAVxBqeh3Mj2aHz"); // Replace after `anchor deploy`

/// RefAI Escrow — trustless 1-v-1 betting with an AI referee.
///
/// Flow:
///   1. Player A calls `init_escrow`  → creates PDA, deposits SOL
///   2. Player B calls `join_escrow`  → deposits matching SOL
///   3. Referee (backend keypair) calls `settle_escrow` → winner receives pot
///      OR either player calls `cancel_escrow` before opponent joins.
#[program]
pub mod refai_escrow {
    use super::*;

    /// Player A creates the escrow and deposits `lamports`.
    pub fn init_escrow(
        ctx: Context<InitEscrow>,
        match_id: String,
        lamports: u64,
        referee: Pubkey,
    ) -> Result<()> {
        require!(lamports > 0, EscrowError::ZeroStake);
        require!(match_id.len() <= 32, EscrowError::MatchIdTooLong);

        let escrow = &mut ctx.accounts.escrow;
        escrow.match_id = match_id;
        escrow.player_a = ctx.accounts.player_a.key();
        escrow.player_b = Pubkey::default(); // set when B joins
        escrow.referee = referee;
        escrow.stake = lamports;
        escrow.player_a_deposited = true;
        escrow.player_b_deposited = false;
        escrow.settled = false;
        escrow.bump = ctx.bumps.escrow;

        // Transfer SOL from player A → escrow PDA
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.player_a.to_account_info(),
                    to: ctx.accounts.escrow.to_account_info(),
                },
            ),
            lamports,
        )?;

        msg!("Escrow created. Player A deposited {} lamports", lamports);
        Ok(())
    }

    /// Player B joins the escrow and deposits the matching stake.
    pub fn join_escrow(ctx: Context<JoinEscrow>, _match_id: String) -> Result<()> {
        require!(ctx.accounts.escrow.player_a_deposited, EscrowError::NotInitialized);
        require!(!ctx.accounts.escrow.player_b_deposited, EscrowError::AlreadyFull);
        require!(!ctx.accounts.escrow.settled, EscrowError::AlreadySettled);

        let stake = ctx.accounts.escrow.stake;
        ctx.accounts.escrow.player_b = ctx.accounts.player_b.key();
        ctx.accounts.escrow.player_b_deposited = true;

        // Transfer matching SOL from player B → escrow PDA
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.player_b.to_account_info(),
                    to: ctx.accounts.escrow.to_account_info(),
                },
            ),
            stake,
        )?;

        msg!("Player B deposited {} lamports", stake);
        Ok(())
    }

    /// Referee settles the escrow — sends the full pot to the winner.
    pub fn settle_escrow(
        ctx: Context<SettleEscrow>,
        _match_id: String,
        winner: Pubkey,
    ) -> Result<()> {
        let pot = {
            let escrow = &ctx.accounts.escrow;
            require!(escrow.player_a_deposited, EscrowError::NotInitialized);
            require!(escrow.player_b_deposited, EscrowError::NotFull);
            require!(!escrow.settled, EscrowError::AlreadySettled);
            require!(
                winner == escrow.player_a || winner == escrow.player_b,
                EscrowError::InvalidWinner
            );
            require!(
                ctx.accounts.referee.key() == escrow.referee,
                EscrowError::UnauthorizedReferee
            );
            require!(
                ctx.accounts.winner.key() == winner,
                EscrowError::WinnerMismatch
            );
            escrow.stake * 2
        };

        // Transfer pot from PDA → winner
        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= pot;
        **ctx.accounts.winner.to_account_info().try_borrow_mut_lamports()? += pot;

        ctx.accounts.escrow.settled = true;

        msg!("Escrow settled. {} lamports sent to winner", pot);
        Ok(())
    }

    /// Cancel an escrow before Player B joins — refunds Player A.
    pub fn cancel_escrow(ctx: Context<CancelEscrow>, _match_id: String) -> Result<()> {
        let refund = {
            let escrow = &ctx.accounts.escrow;
            require!(escrow.player_a_deposited, EscrowError::NotInitialized);
            require!(!escrow.player_b_deposited, EscrowError::AlreadyFull);
            require!(!escrow.settled, EscrowError::AlreadySettled);
            require!(
                ctx.accounts.player_a.key() == escrow.player_a,
                EscrowError::Unauthorized
            );
            escrow.stake
        };

        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= refund;
        **ctx.accounts.player_a.to_account_info().try_borrow_mut_lamports()? += refund;

        ctx.accounts.escrow.settled = true; // prevent reuse

        msg!("Escrow cancelled. {} lamports refunded to Player A", refund);
        Ok(())
    }
}

// ─── Accounts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(match_id: String, lamports: u64, referee: Pubkey)]
pub struct InitEscrow<'info> {
    #[account(
        init,
        payer = player_a,
        space = Escrow::LEN,
        seeds = [b"escrow", match_id.as_bytes()],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(mut)]
    pub player_a: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(match_id: String)]
pub struct JoinEscrow<'info> {
    #[account(
        mut,
        seeds = [b"escrow", match_id.as_bytes()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(mut)]
    pub player_b: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(match_id: String, winner: Pubkey)]
pub struct SettleEscrow<'info> {
    #[account(
        mut,
        seeds = [b"escrow", match_id.as_bytes()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,
    pub referee: Signer<'info>,
    /// CHECK: validated against the winner pubkey passed in the instruction
    #[account(mut)]
    pub winner: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(match_id: String)]
pub struct CancelEscrow<'info> {
    #[account(
        mut,
        seeds = [b"escrow", match_id.as_bytes()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(mut)]
    pub player_a: Signer<'info>,
}

// ─── State ───────────────────────────────────────────────────────────────────

#[account]
pub struct Escrow {
    pub match_id: String,       // 4 + 32 = 36
    pub player_a: Pubkey,       // 32
    pub player_b: Pubkey,       // 32
    pub referee: Pubkey,        // 32
    pub stake: u64,             // 8
    pub player_a_deposited: bool, // 1
    pub player_b_deposited: bool, // 1
    pub settled: bool,          // 1
    pub bump: u8,               // 1
}

impl Escrow {
    pub const LEN: usize = 8   // discriminator
        + (4 + 32)             // match_id (String: 4-byte len + max 32 chars)
        + 32                   // player_a
        + 32                   // player_b
        + 32                   // referee
        + 8                    // stake
        + 1                    // player_a_deposited
        + 1                    // player_b_deposited
        + 1                    // settled
        + 1;                   // bump
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum EscrowError {
    #[msg("Stake must be greater than zero")]
    ZeroStake,
    #[msg("Match ID must be ≤ 32 characters")]
    MatchIdTooLong,
    #[msg("Escrow not initialized")]
    NotInitialized,
    #[msg("Both players have already deposited")]
    AlreadyFull,
    #[msg("Escrow has already been settled")]
    AlreadySettled,
    #[msg("Both deposits required before settling")]
    NotFull,
    #[msg("Winner must be player A or player B")]
    InvalidWinner,
    #[msg("Only the designated referee can settle")]
    UnauthorizedReferee,
    #[msg("Winner account does not match the declared winner")]
    WinnerMismatch,
    #[msg("Unauthorized")]
    Unauthorized,
}
