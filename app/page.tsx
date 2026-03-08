"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play, Pause, RotateCcw, Video, VideoOff, Minus, Plus, Zap, Eye, AlertCircle, Trophy, Wallet, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useGame } from "@/lib/game-context"
import { fetchScore, resetGame, getFrameUrl } from "@/lib/api"
import { useWallet } from "@solana/wallet-adapter-react"
import { LAMPORTS_PER_SOL } from "@solana/web3.js"
import { useEscrow, solscanTx, shortenAddress } from "@/lib/escrow"

export default function HomePage() {
  const {
    playerA,
    playerB,
    scoreA,
    scoreB,
    gameStatus,
    detectionStatus,
    lastPoint,
    matchId,
    stakeSOL,
    playerBWallet,
    matchWinner,
    setPlayerA,
    setPlayerB,
    incrementScore,
    decrementScore,
    setScoreA,
    setScoreB,
    setLastPoint,
    setStakeSOL,
    setPlayerBWallet,
    setMatchWinner,
    startMatch,
    pauseMatch,
    resumeMatch,
    endMatch,
    resetMatch,
    setDetectionStatus,
    pastGames,
  } = useGame()

  const { publicKey, connected, wallets, select, connect, disconnect } = useWallet()
  const escrow = useEscrow()
  const [showWallets, setShowWallets] = useState(false)
  const [bettingOn, setBettingOn] = useState<"A" | "B">("A")
  const [isConnecting, setIsConnecting] = useState(false)
  const [frameTs, setFrameTs] = useState(Date.now())
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scoreIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  // Auto-release escrow when API reports a winner
  useEffect(() => {
    if (!matchWinner || escrow.phase !== "holding") return
    // Determine if the player we bet on won
    const winsB =
      matchWinner.toLowerCase().includes(playerB.toLowerCase()) ||
      matchWinner.toUpperCase().includes(" B") ||
      matchWinner.toUpperCase().startsWith("B")
    const betWon = (bettingOn === "B") === winsB
    // If we bet on the winner → we receive the opponent's stake
    // If we bet on the loser  → opponent receives our stake
    const winnerWallet = betWon
      ? (publicKey?.toBase58() ?? "")
      : playerBWallet
    if (!winnerWallet) return
    escrow.release(matchId, winnerWallet, Math.round(stakeSOL * LAMPORTS_PER_SOL))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchWinner])

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
    resetMatch()
  }

  const handleStartMatch = async () => {
    const newMatchId = Math.random().toString(36).slice(2, 11)
    startMatch(newMatchId)
    if (stakeSOL > 0 && connected) {
      await escrow.deposit(newMatchId, Math.round(stakeSOL * LAMPORTS_PER_SOL))
    }
  }

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

      {/* Escrow / Wallet panel — shown only in idle state */}
      {gameStatus === "idle" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mb-6 bg-card rounded-2xl border border-border p-4 space-y-3"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Solana Bet</p>

          {/* Wallet connect */}
          {!connected ? (
            <div className="space-y-2">
              <Button
                variant="secondary"
                className="w-full h-10 text-sm rounded-xl"
                onClick={() => setShowWallets((v) => !v)}
              >
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet
              </Button>
              {showWallets && (
                <div className="space-y-1">
                  {wallets.map((w) => (
                    <Button
                      key={w.adapter.name}
                      variant="ghost"
                      className="w-full h-9 text-sm rounded-xl justify-start"
                      onClick={() => {
                        select(w.adapter.name)
                        connect().catch(() => {})
                        setShowWallets(false)
                      }}
                    >
                      {w.adapter.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs font-mono text-muted-foreground">
                  {shortenAddress(publicKey!.toBase58())}
                </span>
              </div>
              <Button variant="ghost" size="sm" className="text-xs h-7 rounded-lg" onClick={() => disconnect()}>
                Disconnect
              </Button>
            </div>
          )}

          {/* Bet config */}
          {connected && (
            <>
              {/* Who are you betting on? */}
              <div>
                <p className="text-[11px] text-muted-foreground mb-1.5">I'm betting on</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setBettingOn("A")}
                    className={`h-10 rounded-xl text-sm font-medium border transition-colors ${
                      bettingOn === "A"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {playerA || "Player 1"}
                  </button>
                  <button
                    onClick={() => setBettingOn("B")}
                    className={`h-10 rounded-xl text-sm font-medium border transition-colors ${
                      bettingOn === "B"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {playerB || "Player 2"}
                  </button>
                </div>
              </div>

              {/* Stake amount */}
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={stakeSOL || ""}
                  onChange={(e) => setStakeSOL(parseFloat(e.target.value) || 0)}
                  className="h-9 text-sm rounded-xl flex-1"
                  placeholder="Stake amount"
                />
                <span className="text-xs text-muted-foreground shrink-0">SOL</span>
              </div>

              {/* Opponent wallet */}
              <Input
                value={playerBWallet}
                onChange={(e) => setPlayerBWallet(e.target.value)}
                className="h-9 text-sm rounded-xl font-mono"
                placeholder="Opponent wallet address"
              />

              {stakeSOL > 0 && playerBWallet && (
                <p className="text-[11px] text-muted-foreground text-center">
                  You stake <span className="text-foreground font-medium">{stakeSOL} SOL</span> on{" "}
                  <span className="text-foreground font-medium">{bettingOn === "A" ? (playerA || "Player 1") : (playerB || "Player 2")}</span>.
                  {" "}If they lose, opponent gets your SOL.
                </p>
              )}
            </>
          )}
        </motion.div>
      )}

      {/* Escrow status pill — shown during active match */}
      <AnimatePresence>
        {(gameStatus === "active" || gameStatus === "paused") && stakeSOL > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 space-y-2"
          >
            <div className="flex items-center justify-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${
                  escrow.phase === "holding" ? "bg-green-500" :
                  escrow.phase === "depositing" ? "bg-yellow-400 animate-pulse" :
                  "bg-muted-foreground/30"
                }`}
              />
              <span className="text-xs text-muted-foreground">
                {escrow.phase === "holding"
                  ? `${stakeSOL} SOL on ${bettingOn === "A" ? (playerA || "Player 1") : (playerB || "Player 2")}`
                  : escrow.phase === "depositing" ? "Depositing…"
                  : "No bet"}
              </span>
            </div>
            {/* DEV ONLY: simulate winner button to test SOL transfer */}
            {process.env.NEXT_PUBLIC_SOLANA_NETWORK === "devnet" && escrow.phase === "holding" && playerBWallet && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs rounded-xl"
                  onClick={() => setMatchWinner(`${playerA} wins (test)`)}
                >
                  🧪 {playerA} wins
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs rounded-xl"
                  onClick={() => setMatchWinner(`${playerB} wins (test)`)}
                >
                  🧪 {playerB} wins
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Winner + release banner */}
      <AnimatePresence>
        {matchWinner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mb-6 bg-primary/10 border border-primary/20 rounded-2xl p-4 text-center"
          >
            <Trophy className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-sm font-semibold text-foreground">{matchWinner} wins!</p>
            {escrow.phase === "releasing" && (
              <p className="text-xs text-muted-foreground mt-1">Releasing escrow…</p>
            )}
            {escrow.phase === "released" && escrow.releaseSig && escrow.releaseSig !== "SIMULATION" && (
              <a
                href={solscanTx(escrow.releaseSig, process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary mt-1 underline"
              >
                View transaction <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {escrow.phase === "released" && escrow.releaseSig === "SIMULATION" && (
              <p className="text-xs text-muted-foreground mt-1">Escrow released (demo mode)</p>
            )}
            {escrow.error && (
              <p className="text-xs text-destructive mt-1">{escrow.error}</p>
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
            onClick={handleStartMatch}
          >
            <Play className="w-4 h-4 mr-2" />
            Start Match
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
