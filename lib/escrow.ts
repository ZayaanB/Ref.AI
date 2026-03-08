"use client"

import { useCallback, useRef, useState } from "react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js"

// ─── Config ───────────────────────────────────────────────────────────────────
// Set NEXT_PUBLIC_PROGRAM_ID for full on-chain escrow (Anchor program required).
// Set NEXT_PUBLIC_ESCROW_MODE=direct for real devnet transfers without a program.
// Without either, the hook runs in simulation mode — no real SOL moves.
const PROGRAM_ID_STR = process.env.NEXT_PUBLIC_PROGRAM_ID
const DIRECT_MODE = process.env.NEXT_PUBLIC_ESCROW_MODE === "direct"

// ─── Escrow PDA seed ─────────────────────────────────────────────────────────
function getEscrowPDA(matchId: string, programId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), Buffer.from(matchId)],
    programId
  )
}

// ─── Types ───────────────────────────────────────────────────────────────────
export type EscrowPhase =
  | "idle"
  | "depositing"
  | "holding"    // funds are in escrow
  | "releasing"
  | "released"
  | "error"

export interface EscrowResult {
  phase: EscrowPhase
  depositSig: string | null
  releaseSig: string | null
  error: string | null
  /** true when NEXT_PUBLIC_PROGRAM_ID is set */
  programReady: boolean
  /** SOL balance of the connected wallet (null until fetched) */
  balance: number | null
  deposit: (matchId: string, lamports: number) => Promise<string | null>
  release: (matchId: string, winnerPubkey: string, lamports: number) => Promise<string | null>
  reset: () => void
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useEscrow(): EscrowResult {
  const { connection } = useConnection()
  const { publicKey, sendTransaction, connected } = useWallet()

  const [phase, setPhase] = useState<EscrowPhase>("idle")
  const [depositSig, setDepositSig] = useState<string | null>(null)
  const [releaseSig, setReleaseSig] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const releaseCalledRef = useRef(false)

  const programReady = !!PROGRAM_ID_STR || DIRECT_MODE

  // ── deposit ────────────────────────────────────────────────────────────────
  const deposit = useCallback(
    async (matchId: string, lamports: number): Promise<string | null> => {
      if (!connected || !publicKey || !sendTransaction) {
        setError("Wallet not connected")
        setPhase("error")
        return null
      }

      setPhase("depositing")
      setError(null)

      // Pure simulation — no wallet interaction at all
      if (!PROGRAM_ID_STR && !DIRECT_MODE) {
        await new Promise((r) => setTimeout(r, 800))
        setPhase("holding")
        setDepositSig("SIMULATION")
        return "SIMULATION"
      }

      // Direct mode — Player A confirms they are committing the stake.
      // Funds stay in Player A's wallet until release; a 0-lamport self-transfer
      // is used here just to prove wallet connectivity and get a real txn sig.
      if (DIRECT_MODE) {
        try {
          const tx = new Transaction().add(
            SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: publicKey, lamports: 0 })
          )
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
          tx.recentBlockhash = blockhash
          tx.feePayer = publicKey
          const sig = await sendTransaction(tx, connection)
          await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed")
          const bal = await connection.getBalance(publicKey)
          setBalance(bal / LAMPORTS_PER_SOL)
          setDepositSig(sig)
          setPhase("holding")
          return sig
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          setError(msg)
          setPhase("error")
          return null
        }
      }

      try {
        const programId = new PublicKey(PROGRAM_ID_STR!)
        const [escrowPDA] = getEscrowPDA(matchId, programId)

        // ── TODO: replace with Anchor program CPI once program is deployed ──
        // const program = new Program(IDL, programId, anchorProvider)
        // const sig = await program.methods
        //   .initializeEscrow(matchId, new BN(lamports), playerBPubkey)
        //   .accounts({ escrow: escrowPDA, playerA: publicKey, systemProgram: SystemProgram.programId })
        //   .rpc()
        //
        // Placeholder: raw SOL transfer to the escrow PDA address so the
        // organiser can at least demonstrate the flow before the program is live.
        const tx = new Transaction().add(
          SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: escrowPDA, lamports })
        )

        const sig = await sendTransaction(tx, connection)
        await connection.confirmTransaction(sig, "confirmed")

        // Refresh balance
        const bal = await connection.getBalance(publicKey)
        setBalance(bal / LAMPORTS_PER_SOL)

        setDepositSig(sig)
        setPhase("holding")
        return sig
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        setPhase("error")
        return null
      }
    },
    [connected, publicKey, sendTransaction, connection]
  )

  // ── release ────────────────────────────────────────────────────────────────
  const release = useCallback(
    async (matchId: string, winnerPubkey: string, lamports: number): Promise<string | null> => {
      // Guard: only release once per match
      if (releaseCalledRef.current) return releaseSig
      releaseCalledRef.current = true

      if (!connected || !publicKey || !sendTransaction) {
        setError("Wallet not connected")
        setPhase("error")
        return null
      }

      if (!winnerPubkey) {
        setError("Winner wallet address unknown")
        setPhase("error")
        return null
      }

      setPhase("releasing")
      setError(null)

      // Pure simulation
      if (!PROGRAM_ID_STR && !DIRECT_MODE) {
        await new Promise((r) => setTimeout(r, 1000))
        setPhase("released")
        setReleaseSig("SIMULATION")
        return "SIMULATION"
      }

      // Direct mode — Player A's wallet sends the staked amount straight to winner
      if (DIRECT_MODE) {
        try {
          const winner = new PublicKey(winnerPubkey)
          if (lamports === 0) {
            // No stake configured — still mark released so UI updates
            setPhase("released")
            setReleaseSig("NO_STAKE")
            return "NO_STAKE"
          }
          const tx = new Transaction().add(
            SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: winner, lamports })
          )
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
          tx.recentBlockhash = blockhash
          tx.feePayer = publicKey
          const sig = await sendTransaction(tx, connection)
          await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed")
          const bal = await connection.getBalance(publicKey)
          setBalance(bal / LAMPORTS_PER_SOL)
          setReleaseSig(sig)
          setPhase("released")
          return sig
        } catch (e) {
          releaseCalledRef.current = false
          const msg = e instanceof Error ? e.message : String(e)
          setError(msg)
          setPhase("error")
          return null
        }
      }

      try {
        const winner = new PublicKey(winnerPubkey)
        const programId = new PublicKey(PROGRAM_ID_STR!)
        const [escrowPDA] = getEscrowPDA(matchId, programId)

        // ── TODO: replace with Anchor program CPI once program is deployed ──
        // const program = new Program(IDL, programId, anchorProvider)
        // const sig = await program.methods
        //   .releaseToWinner(matchId)
        //   .accounts({ escrow: escrowPDA, winner, authority: publicKey, systemProgram: SystemProgram.programId })
        //   .rpc()
        //
        // Placeholder: organiser wallet sends escrowed amount to winner directly.
        // This is NOT trustless — replace with the program instruction above.
        const escrowBalance = await connection.getBalance(escrowPDA)
        if (escrowBalance === 0) {
          setError("Escrow account is empty")
          setPhase("error")
          releaseCalledRef.current = false
          return null
        }

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: winner,
            lamports: escrowBalance,
          })
        )

        const sig = await sendTransaction(tx, connection)
        await connection.confirmTransaction(sig, "confirmed")

        setReleaseSig(sig)
        setPhase("released")
        return sig
      } catch (e) {
        releaseCalledRef.current = false
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        setPhase("error")
        return null
      }
    },
    [connected, publicKey, sendTransaction, connection, releaseSig]
  )

  // ── reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    releaseCalledRef.current = false
    setPhase("idle")
    setDepositSig(null)
    setReleaseSig(null)
    setError(null)
  }, [])

  return { phase, depositSig, releaseSig, error, programReady, balance, deposit, release, reset }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function solscanTx(sig: string, network = "devnet") {
  return `https://solscan.io/tx/${sig}${network !== "mainnet-beta" ? `?cluster=${network}` : ""}`
}

export function shortenAddress(addr: string, chars = 4) {
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`
}
