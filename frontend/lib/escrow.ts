"use client"

import { useCallback, useRef, useState } from "react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js"

async function escrowApi(body: Record<string, unknown>) {
  const res = await fetch("/api/escrow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? "Escrow API error")
  return data
}

export type EscrowPhase =
  | "idle"
  | "creating"         // backend registers the match
  | "awaiting_deposit" // waiting for player to sign deposit tx
  | "depositing"       // tx is in flight
  | "holding"          // this player deposited; waiting for opponent
  | "both_deposited"   // both players deposited; game can start
  | "settling"
  | "settled"
  | "cancelled"
  | "error"

export interface MatchEscrowInfo {
  matchId: string
  stakeSOL: number
  stakeLamports: number
  refereePubkey: string
  programId: string
  escrowPDA: string | null
  playerADeposited: boolean
  playerBDeposited: boolean
  settled: boolean
}

export interface EscrowResult {
  phase: EscrowPhase
  matchInfo: MatchEscrowInfo | null
  depositSig: string | null
  settleSig: string | null
  error: string | null
  balance: number | null
  createMatch: (matchId: string, stakeSOL: number) => Promise<MatchEscrowInfo | null>
  deposit: (matchId: string, side: "A" | "B") => Promise<string | null>
  pollStatus: (matchId: string) => Promise<MatchEscrowInfo | null>
  settle: (matchId: string, winnerSide: string) => Promise<string | null>
  cancel: (matchId: string) => Promise<boolean>
  reset: () => void
}

export function useEscrow(): EscrowResult {
  const { connection } = useConnection()
  const { publicKey, sendTransaction, connected } = useWallet()

  const [phase, setPhase] = useState<EscrowPhase>("idle")
  const [matchInfo, setMatchInfo] = useState<MatchEscrowInfo | null>(null)
  const [depositSig, setDepositSig] = useState<string | null>(null)
  const [settleSig, setSettleSig] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const settleCalledRef = useRef(false)

  const createMatch = useCallback(
    async (matchId: string, stakeSOL: number): Promise<MatchEscrowInfo | null> => {
      setPhase("creating")
      setError(null)
      try {
        const data = await escrowApi({ action: "create", matchId, stakeSOL })
        const info: MatchEscrowInfo = {
          matchId: data.matchId,
          stakeSOL: data.stakeSOL,
          stakeLamports: data.stakeLamports,
          refereePubkey: data.refereePubkey,
          programId: data.programId,
          escrowPDA: null,
          playerADeposited: false,
          playerBDeposited: false,
          settled: false,
        }
        setMatchInfo(info)
        setPhase("awaiting_deposit")
        return info
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        setPhase("error")
        return null
      }
    },
    []
  )

  const deposit = useCallback(
    async (matchId: string, side: "A" | "B"): Promise<string | null> => {
      if (!connected || !publicKey || !sendTransaction) {
        setError("Wallet not connected")
        setPhase("error")
        return null
      }

      setPhase("depositing")
      setError(null)

      try {
        const data = await escrowApi({
          action: "build_deposit_tx",
          matchId,
          playerWallet: publicKey.toBase58(),
          side,
        })

        const refereePubkey = new PublicKey(data.refereePubkey)
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: refereePubkey,
            lamports: data.stakeLamports,
          })
        )
        tx.recentBlockhash = blockhash
        tx.feePayer = publicKey

        const sig = await sendTransaction(tx, connection)
        await connection.confirmTransaction(
          { signature: sig, blockhash, lastValidBlockHeight },
          "confirmed"
        )

        const confirmData = await escrowApi({
          action: "confirm_deposit",
          matchId,
          side,
          signature: sig,
        }        )

        const bal = await connection.getBalance(publicKey)
        setBalance(bal / LAMPORTS_PER_SOL)

        setDepositSig(sig)
        setMatchInfo((prev) =>
          prev
            ? {
                ...prev,
                escrowPDA: data.escrowPDA,
                playerADeposited: confirmData.playerADeposited,
                playerBDeposited: confirmData.playerBDeposited,
              }
            : prev
        )

        if (confirmData.playerADeposited && confirmData.playerBDeposited) {
          setPhase("both_deposited")
        } else {
          setPhase("holding")
        }
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

  const pollStatus = useCallback(
    async (matchId: string): Promise<MatchEscrowInfo | null> => {
      try {
        const data = await escrowApi({ action: "status", matchId })
        const info: MatchEscrowInfo = {
          matchId: data.matchId,
          stakeSOL: data.stakeSOL,
          stakeLamports: data.stakeLamports,
          refereePubkey: "",
          programId: "",
          escrowPDA: null,
          playerADeposited: data.playerADeposited,
          playerBDeposited: data.playerBDeposited,
          settled: data.settled,
        }
        setMatchInfo((prev) => (prev ? { ...prev, ...info } : info))
        if (data.playerADeposited && data.playerBDeposited && !data.settled) {
          setPhase("both_deposited")
        }
        return info
      } catch {
        return null
      }
    },
    []
  )

  const settle = useCallback(
    async (matchId: string, winnerSide: string): Promise<string | null> => {
      if (settleCalledRef.current) return settleSig
      settleCalledRef.current = true

      setPhase("settling")
      setError(null)

      try {
        const data = await escrowApi({
          action: "settle",
          matchId,
          winnerSide,
        })
        setSettleSig(data.signature)
        setPhase("settled")
        return data.signature
      } catch (e) {
        settleCalledRef.current = false
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        setPhase("error")
        return null
      }
    },
    [settleSig]
  )

  const cancel = useCallback(async (matchId: string): Promise<boolean> => {
    try {
      await escrowApi({ action: "cancel", matchId })
      setPhase("cancelled")
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      return false
    }
  }, [])

  const reset = useCallback(() => {
    setPhase("idle")
    setMatchInfo(null)
    setDepositSig(null)
    setSettleSig(null)
    setError(null)
    settleCalledRef.current = false
  }, [])

  return {
    phase,
    matchInfo,
    depositSig,
    settleSig,
    error,
    balance,
    createMatch,
    deposit,
    pollStatus,
    settle,
    cancel,
    reset,
  }
}

export function solscanTx(sig: string, network = "devnet") {
  return `https://solscan.io/tx/${sig}${network !== "mainnet-beta" ? `?cluster=${network}` : ""}`
}

export function shortenAddress(addr: string, chars = 4) {
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`
}
