"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play, Pause, RotateCcw, Video, VideoOff, Minus, Plus, Zap, Eye, AlertCircle, Trophy, Wallet, Loader2, CheckCircle2, XCircle, Copy } from "lucide-react"
import QRCode from "react-qr-code"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useGame } from "@/lib/game-context"
import { fetchScore, resetGame, getFrameUrl } from "@/lib/api"
import { useWallet } from "@solana/wallet-adapter-react"
import { useEscrow, shortenAddress } from "@/lib/escrow"

export default function HomePage() {
  const {
    playerA,
    playerB,
    scoreA,
    scoreB,
    gameStatus,
    detectionStatus,
    lastPoint,
    stakeSOL,
    matchId,
    matchWinner,
    setPlayerA,
    setPlayerB,
    incrementScore,
    decrementScore,
    setScoreA,
    setScoreB,
    setLastPoint,
    setStakeSOL,
    setMatchWinner,
    startMatch,
    pauseMatch,
    resumeMatch,
    endMatch,
    resetMatch,
    setDetectionStatus,
    pastGames,
  } = useGame()

  const { publicKey, connected, wallet, wallets, select, connect, disconnect } = useWallet()
  const escrow = useEscrow()

  // Track which player slot is depositing on this device
  const [mySide, setMySide] = useState<"A" | "B" | null>(null)
  const [joinCode, setJoinCode] = useState("")
  const [copied, setCopied] = useState(false)

  const [isConnecting, setIsConnecting] = useState(false)
  const [frameTs, setFrameTs] = useState(Date.now())
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scoreIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Poll escrow status when holding (waiting for opponent)
  useEffect(() => {
    if (escrow.phase !== "holding" || !matchId) return
    const interval = setInterval(() => escrow.pollStatus(matchId), 3000)
    return () => clearInterval(interval)
  }, [escrow.phase, matchId, escrow.pollStatus])

  // Auto-settle when we have a winner + both deposited
  const settleAttempted = useRef(false)
  useEffect(() => {
    if (!matchWinner || !matchId || settleAttempted.current) return
    if (escrow.phase !== "both_deposited") return

    settleAttempted.current = true

    // Determine winner side from the matchWinner string the API returns
    const winnerIsB =
      !!matchWinner && (
        matchWinner.toLowerCase().includes(playerB.toLowerCase()) ||
        matchWinner.toUpperCase().includes(" B") ||
        matchWinner.toUpperCase().startsWith("B")
      )

    // Tell the backend which side won — it knows both wallet addresses
    escrow.settle(matchId, winnerIsB ? "B" : "A")
  }, [matchWinner, matchId, escrow.phase, playerB])

  // Copy match code to clipboard
  const copyMatchCode = useCallback(() => {
    if (!matchId) return
    navigator.clipboard.writeText(matchId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [matchId])

  // Always poll /score every second
  useEffect(() => {
    const poll = async () => {
      try {
        const data = await fetchScore()
        setScoreA(data.score_a)
        setScoreB(data.score_b)
        if (data.last_point) setLastPoint(data.last_point)
        if (data.match_winner) setMatchWinner(data.match_winner)
      } catch {
        // silently ignore transient fetch errors
      }
    }
    poll()
    scoreIntervalRef.current = setInterval(poll, 1000)
    return () => {
      if (scoreIntervalRef.current) clearInterval(scoreIntervalRef.current)
    }
  }, [setScoreA, setScoreB, setLastPoint, setMatchWinner])

  // Refresh camera frame ~6fps only when detecting
  useEffect(() => {
    if (detectionStatus !== "detecting") {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current)
      return
    }
    frameIntervalRef.current = setInterval(() => {
      setFrameTs(Date.now())
    }, 150)
    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current)
    }
  }, [detectionStatus])

  const handleNewMatch = async () => {
    try {
      await resetGame()
    } catch {
      // proceed even if API reset fails
    }
    escrow.reset()
    settleAttempted.current = false
    setMySide(null)
    setJoinCode("")
    resetMatch()
  }

  // Create match as Player A: register escrow on backend, then deposit
  const handleCreateMatch = async () => {
    if (stakeSOL <= 0) return
    const newMatchId = Math.random().toString(36).slice(2, 11)
    startMatch(newMatchId)
    setMySide("A")

    const info = await escrow.createMatch(newMatchId, stakeSOL)
    if (info && connected && publicKey) {
      await escrow.deposit(newMatchId, "A")
    }
  }

  // Join match as Player B: deposit into existing escrow
  const handleJoinMatch = async () => {
    if (!joinCode.trim()) return
    setMySide("B")
    startMatch(joinCode.trim())

    // Check the match exists on the backend
    const info = await escrow.pollStatus(joinCode.trim())
    if (!info) return

    setStakeSOL(info.stakeSOL)
    if (connected && publicKey) {
      await escrow.deposit(joinCode.trim(), "B")
    }
  }

  // Connect wallet then deposit
  const handleConnectAndDeposit = async () => {
    if (!wallet) {
      // Auto-select Phantom if available
      const phantom = wallets.find((w) => w.adapter.name === "Phantom")
      if (phantom) select(phantom.adapter.name)
    }
    try {
      await connect()
    } catch {
      // user rejected
    }
  }

  // After wallet connects, auto-deposit if we have a side but haven't deposited yet
  useEffect(() => {
    if (!connected || !publicKey || !mySide || !matchId) return
    if (escrow.phase !== "awaiting_deposit") return

    escrow.deposit(matchId, mySide)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, publicKey, mySide, matchId, escrow.phase])

  const handleCameraToggle = () => {
    if (detectionStatus === "disconnected") {
      setIsConnecting(true)
      setDetectionStatus("connecting")
      setTimeout(() => {
        setDetectionStatus("detecting")
        setIsConnecting(false)
      }, 1500)
    } else {
      setDetectionStatus("disconnected")
    }
  }

  const isMatchActive = gameStatus === "active" || gameStatus === "paused"

  const lastGame = pastGames[0] ?? null

  return (
    <div className="px-5 pt-16 pb-8">
      {/* Camera Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-6"
      >
        {/* AI Status Badge */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-foreground">Camera Feed</p>
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                detectionStatus === "detecting"
                  ? "bg-green-500"
                  : detectionStatus === "connecting"
                  ? "bg-yellow-400 animate-pulse"
                  : "bg-muted-foreground/30"
              }`}
            />
            <span className="text-xs text-muted-foreground">
              {detectionStatus === "detecting"
                ? "AI Active"
                : detectionStatus === "connecting"
                ? "Connecting"
                : "Offline"}
            </span>
          </div>
        </div>
        <div className="relative aspect-video bg-secondary rounded-2xl overflow-hidden">
          {detectionStatus === "detecting" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={getFrameUrl(frameTs)}
              alt="Camera feed"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : detectionStatus === "connecting" ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-2.5 h-2.5 bg-yellow-400 rounded-full mx-auto mb-2"
                />
                <p className="text-xs text-muted-foreground">Connecting...</p>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Camera Off</p>
            </div>
          )}
          
          <Button
            variant="secondary"
            size="icon"
            className="absolute bottom-3 right-3 rounded-full w-10 h-10"
            onClick={handleCameraToggle}
            disabled={isConnecting}
          >
            {detectionStatus !== "disconnected" ? (
              <Video className="w-4 h-4" />
            ) : (
              <VideoOff className="w-4 h-4" />
            )}
          </Button>
        </div>
      </motion.div>

      {/* Solana Bet panel — shown only in idle state */}
      {gameStatus === "idle" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mb-6 bg-card rounded-2xl border border-border p-4 space-y-4"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Solana Escrow Bet</p>

          {/* Wallet connection status */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full shrink-0 ${connected ? "bg-green-500" : "bg-muted-foreground/30"}`} />
            <span className="text-xs text-muted-foreground">
              {connected && publicKey
                ? <span className="font-mono text-foreground">{shortenAddress(publicKey.toBase58())}</span>
                : "Wallet not connected"}
            </span>
            {!connected && (
              <Button variant="secondary" size="sm" className="h-7 text-xs rounded-lg ml-auto"
                onClick={handleConnectAndDeposit}>
                <Wallet className="w-3 h-3 mr-1" />Connect Phantom
              </Button>
            )}
            {connected && (
              <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg ml-auto"
                onClick={() => disconnect()}>
                Disconnect
              </Button>
            )}
          </div>

          <div className="border-t border-border" />

          {/* Stake amount */}
          <div className="flex items-center gap-2">
            <Input type="number" min={0} step={0.1}
              value={stakeSOL || ""}
              onChange={(e) => setStakeSOL(parseFloat(e.target.value) || 0)}
              className="h-9 text-sm rounded-xl flex-1"
              placeholder="Stake (SOL)"
            />
            <span className="text-xs text-muted-foreground shrink-0">SOL each</span>
          </div>

          {/* Create or Join */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              className="h-10 text-sm rounded-xl"
              disabled={!connected || stakeSOL <= 0 || escrow.phase !== "idle"}
              onClick={handleCreateMatch}
            >
              <Wallet className="w-4 h-4 mr-1.5" />Create Match
            </Button>
            <div className="flex gap-1.5">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="h-10 text-sm rounded-xl flex-1"
                placeholder="Match code"
              />
              <Button
                variant="secondary"
                className="h-10 text-sm rounded-xl shrink-0 px-3"
                disabled={!connected || !joinCode.trim() || escrow.phase !== "idle"}
                onClick={handleJoinMatch}
              >
                Join
              </Button>
            </div>
          </div>

          {escrow.error && (
            <div className="flex items-center gap-1.5 text-destructive">
              <XCircle className="w-3.5 h-3.5" />
              <span className="text-xs">{escrow.error}</span>
            </div>
          )}
        </motion.div>
      )}

      {/* Escrow status pill — shown during active match */}
      <AnimatePresence>
        {(gameStatus === "active" || gameStatus === "paused") && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 space-y-2"
          >
            {/* Escrow phase indicator */}
            <div className="flex items-center justify-center gap-1.5">
              {escrow.phase === "depositing" && <Loader2 className="w-3 h-3 animate-spin text-yellow-500" />}
              {escrow.phase === "holding" && <Loader2 className="w-3 h-3 animate-spin text-yellow-500" />}
              {escrow.phase === "both_deposited" && <CheckCircle2 className="w-3 h-3 text-green-500" />}
              {escrow.phase === "settled" && <CheckCircle2 className="w-3 h-3 text-green-500" />}
              {(escrow.phase === "idle" || escrow.phase === "awaiting_deposit") && <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />}
              <span className="text-xs text-muted-foreground">
                {escrow.phase === "depositing" && "Depositing SOL..."}
                {escrow.phase === "holding" && `Waiting for opponent (${stakeSOL} SOL locked)`}
                {escrow.phase === "both_deposited" && `${stakeSOL * 2} SOL in escrow — game on!`}
                {escrow.phase === "settling" && "Settling payout..."}
                {escrow.phase === "settled" && "Payout complete!"}
                {escrow.phase === "idle" && stakeSOL > 0 && `${stakeSOL} SOL at stake`}
                {escrow.phase === "idle" && stakeSOL <= 0 && "No bet"}
                {escrow.phase === "awaiting_deposit" && "Connect wallet to deposit"}
                {escrow.phase === "error" && (escrow.error || "Escrow error")}
              </span>
            </div>

            {/* Share match code for Player B */}
            {matchId && mySide === "A" && escrow.phase === "holding" && (
              <div className="bg-card border border-border rounded-xl p-3 text-center space-y-2">
                <p className="text-xs text-muted-foreground">Share this match code with your opponent:</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-lg font-bold text-foreground tracking-wider">{matchId}</span>
                  <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg" onClick={copyMatchCode}>
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                {/* QR code with the match code */}
                <div className="flex justify-center p-2 bg-white rounded-lg">
                  <QRCode value={matchId} size={120} bgColor="#ffffff" fgColor="#000000" />
                </div>
                <p className="text-[11px] text-muted-foreground">Opponent opens RefAI, pastes this code, and connects their Phantom wallet</p>
              </div>
            )}

            {/* DEV ONLY: simulate winner buttons */}
            {process.env.NEXT_PUBLIC_SOLANA_NETWORK === "devnet" && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs rounded-xl" onClick={() => setMatchWinner(`${playerA} wins (test)`)}>
                  {playerA} wins
                </Button>
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs rounded-xl" onClick={() => setMatchWinner(`${playerB} wins (test)`)}>
                  {playerB} wins
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Winner + auto-payout banner */}
      <AnimatePresence>
        {matchWinner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mb-6 bg-primary/10 border border-primary/20 rounded-2xl p-4 text-center space-y-3"
          >
            <Trophy className="w-5 h-5 text-primary mx-auto" />
            <p className="text-sm font-semibold text-foreground">{matchWinner}!</p>

            {stakeSOL > 0 && (
              <div className="space-y-2">
                {escrow.phase === "settling" && (
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    AI Referee is settling payout...
                  </div>
                )}
                {escrow.phase === "settled" && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-1.5 text-green-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm font-medium">{stakeSOL * 2} SOL paid to winner!</span>
                    </div>
                    {escrow.settleSig && (
                      <p className="text-[11px] text-muted-foreground font-mono">
                        tx: {shortenAddress(escrow.settleSig, 8)}
                      </p>
                    )}
                  </div>
                )}
                {escrow.phase === "error" && (
                  <div className="flex items-center justify-center gap-1.5 text-destructive">
                    <XCircle className="w-3.5 h-3.5" />
                    <span className="text-xs">{escrow.error}</span>
                  </div>
                )}
                {escrow.phase === "both_deposited" && !settleAttempted.current && (
                  <p className="text-xs text-muted-foreground">Payout will be triggered automatically...</p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Player Names */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-2 gap-3 mb-6"
      >
        <Input
          value={playerA}
          onChange={(e) => setPlayerA(e.target.value)}
          disabled={isMatchActive}
          className="h-11 text-sm rounded-xl text-center"
          placeholder="Player 1"
        />
        <Input
          value={playerB}
          onChange={(e) => setPlayerB(e.target.value)}
          disabled={isMatchActive}
          className="h-11 text-sm rounded-xl text-center"
          placeholder="Player 2"
        />
      </motion.div>

      {/* Scoreboard */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-2xl p-6 mb-6 border border-border"
      >
        <div className="grid grid-cols-2 gap-4">
          {/* Player A Score */}
          <div className="text-center">
            <p className="text-xs font-medium text-muted-foreground mb-3 truncate">
              {playerA}
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full w-8 h-8"
                onClick={() => decrementScore("A")}
                disabled={!isMatchActive || scoreA === 0}
              >
                <Minus className="w-3 h-3" />
              </Button>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={scoreA}
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -15, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="text-5xl font-semibold tabular-nums w-16"
                >
                  {scoreA}
                </motion.span>
              </AnimatePresence>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full w-8 h-8"
                onClick={() => incrementScore("A")}
                disabled={!isMatchActive}
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Player B Score */}
          <div className="text-center">
            <p className="text-xs font-medium text-muted-foreground mb-3 truncate">
              {playerB}
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full w-8 h-8"
                onClick={() => decrementScore("B")}
                disabled={!isMatchActive || scoreB === 0}
              >
                <Minus className="w-3 h-3" />
              </Button>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={scoreB}
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -15, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="text-5xl font-semibold tabular-nums w-16"
                >
                  {scoreB}
                </motion.span>
              </AnimatePresence>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full w-8 h-8"
                onClick={() => incrementScore("B")}
                disabled={!isMatchActive}
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Last Point */}
      <AnimatePresence mode="wait">
        {lastPoint && (
          <motion.div
            key={lastPoint}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="-mt-3 mb-4 flex items-center justify-center gap-1.5"
          >
            <Zap className="w-3 h-3 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground truncate">{lastPoint}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="space-y-3"
      >
        {gameStatus === "idle" && (
          <Button
            className="w-full h-12 text-sm font-medium rounded-xl"
            onClick={() => startMatch(Math.random().toString(36).slice(2, 11))}
          >
            <Play className="w-4 h-4 mr-2" />
            Start Match (No Bet)
          </Button>
        )}

        {gameStatus === "active" && (
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              className="h-12 text-sm font-medium rounded-xl"
              onClick={pauseMatch}
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
            <Button
              variant="destructive"
              className="h-12 text-sm font-medium rounded-xl"
              onClick={endMatch}
            >
              End Match
            </Button>
          </div>
        )}

        {gameStatus === "paused" && (
          <div className="grid grid-cols-2 gap-3">
            <Button
              className="h-12 text-sm font-medium rounded-xl"
              onClick={resumeMatch}
            >
              <Play className="w-4 h-4 mr-2" />
              Resume
            </Button>
            <Button
              variant="destructive"
              className="h-12 text-sm font-medium rounded-xl"
              onClick={endMatch}
            >
              End Match
            </Button>
          </div>
        )}

        {gameStatus === "ended" && (
          <Button
            variant="secondary"
            className="w-full h-12 text-sm font-medium rounded-xl"
            onClick={handleNewMatch}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            New Match
          </Button>
        )}
      </motion.div>

      {/* Features Section */}
      {gameStatus === "idle" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            What RefAI Does
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Eye, label: "Ball Tracking", desc: "Follows every shot" },
              { icon: Zap, label: "Auto Score", desc: "Real-time points" },
              { icon: AlertCircle, label: "Fault Detect", desc: "Spots bad serves" },
            ].map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="bg-card rounded-2xl p-3 border border-border flex flex-col items-center gap-2 text-center"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Last Match */}
      {gameStatus === "idle" && lastGame && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-6"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Last Match
          </p>
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 text-center">
                <p className="text-sm font-semibold text-foreground truncate">{lastGame.playerA}</p>
                {lastGame.winner === "A" && (
                  <p className="text-[10px] text-primary font-medium mt-0.5">Winner</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-3xl font-bold tabular-nums text-foreground">{lastGame.scoreA}</span>
                <span className="text-muted-foreground text-sm">—</span>
                <span className="text-3xl font-bold tabular-nums text-foreground">{lastGame.scoreB}</span>
              </div>
              <div className="flex-1 text-center">
                <p className="text-sm font-semibold text-foreground truncate">{lastGame.playerB}</p>
                {lastGame.winner === "B" && (
                  <p className="text-[10px] text-primary font-medium mt-0.5">Winner</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-border">
              <Trophy className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {lastGame.winner === "A" ? lastGame.playerA : lastGame.playerB} won
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
