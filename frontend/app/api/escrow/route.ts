import { NextResponse } from "next/server"
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js"

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com"
const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "11111111111111111111111111111111"
)

// The referee keypair is stored as a JSON array of 64 bytes in an env var.
// Generate one with: solana-keygen new --outfile referee.json
// Then set REFEREE_SECRET=<contents of referee.json>
function getRefereeKeypair(): Keypair {
  const secret = process.env.REFEREE_SECRET
  if (!secret) throw new Error("REFEREE_SECRET env var not set")
  const parsed = JSON.parse(secret) as number[]
  return Keypair.fromSecretKey(Uint8Array.from(parsed))
}

// In-memory match registry (swap for DB / Redis in production)
const matches = new Map<
  string,
  {
    matchId: string
    stakeSOL: number
    stakeLamports: number
    playerAWallet: string | null
    playerBWallet: string | null
    playerADeposited: boolean
    playerBDeposited: boolean
    settled: boolean
    winner: string | null
    createdAt: number
  }
>()

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action } = body as { action: string }

    if (action === "create") {
      const { matchId, stakeSOL } = body as {
        matchId: string
        stakeSOL: number
      }
      if (!matchId || stakeSOL <= 0) {
        return NextResponse.json({ error: "Invalid matchId or stakeSOL" }, { status: 400 })
      }
      const referee = getRefereeKeypair()
      const stakeLamports = Math.round(stakeSOL * LAMPORTS_PER_SOL)

      matches.set(matchId, {
        matchId,
        stakeSOL,
        stakeLamports,
        playerAWallet: null,
        playerBWallet: null,
        playerADeposited: false,
        playerBDeposited: false,
        settled: false,
        winner: null,
        createdAt: Date.now(),
      })

      return NextResponse.json({
        matchId,
        stakeSOL,
        stakeLamports,
        refereePubkey: referee.publicKey.toBase58(),
        programId: PROGRAM_ID.toBase58(),
      })
    }

    if (action === "build_deposit_tx") {
      const { matchId, playerWallet, side } = body as {
        matchId: string
        playerWallet: string
        side: "A" | "B"
      }
      const match = matches.get(matchId)
      if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 })

      const connection = new Connection(RPC, "confirmed")
      const player = new PublicKey(playerWallet)
      const [escrowPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), Buffer.from(matchId)],
        PROGRAM_ID
      )

      if (side === "A") {
        match.playerAWallet = playerWallet
      } else {
        match.playerBWallet = playerWallet
      }
      matches.set(matchId, match)

      const referee = getRefereeKeypair()

      return NextResponse.json({
        refereePubkey: referee.publicKey.toBase58(),
        stakeLamports: match.stakeLamports,
        escrowPDA: escrowPDA.toBase58(),
      })
    }

    if (action === "confirm_deposit") {
      const { matchId, side, signature } = body as {
        matchId: string
        side: "A" | "B"
        signature: string
      }
      const match = matches.get(matchId)
      if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 })

      if (side === "A") match.playerADeposited = true
      else match.playerBDeposited = true
      matches.set(matchId, match)

      return NextResponse.json({
        matchId,
        side,
        signature,
        playerADeposited: match.playerADeposited,
        playerBDeposited: match.playerBDeposited,
      })
    }

    if (action === "settle") {
      const { matchId, winnerWallet, winnerSide } = body as {
        matchId: string
        winnerWallet?: string
        winnerSide?: "A" | "B"
      }
      const match = matches.get(matchId)
      if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 })
      if (match.settled) return NextResponse.json({ error: "Already settled" }, { status: 400 })
      if (!match.playerADeposited || !match.playerBDeposited) {
        return NextResponse.json({ error: "Both players must deposit first" }, { status: 400 })
      }

      let resolvedWinner = winnerWallet
      if (!resolvedWinner || resolvedWinner === "auto") {
        if (winnerSide === "B" && match.playerBWallet) {
          resolvedWinner = match.playerBWallet
        } else if (match.playerAWallet) {
          resolvedWinner = match.playerAWallet
        }
      }
      if (!resolvedWinner) {
        return NextResponse.json({ error: "Cannot determine winner wallet" }, { status: 400 })
      }

      const connection = new Connection(RPC, "confirmed")
      const referee = getRefereeKeypair()
      const winner = new PublicKey(resolvedWinner)
      const [escrowPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), Buffer.from(matchId)],
        PROGRAM_ID
      )

      const pot = match.stakeLamports * 2

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: referee.publicKey,
          toPubkey: winner,
          lamports: pot,
        })
      )

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash
      tx.feePayer = referee.publicKey
      tx.sign(referee)

      const sig = await connection.sendRawTransaction(tx.serialize())
      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed"
      )

      match.settled = true
      match.winner = resolvedWinner
      matches.set(matchId, match)

      return NextResponse.json({ signature: sig, winner: resolvedWinner })
    }

    if (action === "status") {
      const { matchId } = body as { matchId: string }
      const match = matches.get(matchId)
      if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 })
      return NextResponse.json(match)
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[escrow API]", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
