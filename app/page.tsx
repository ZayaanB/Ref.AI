"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play, Pause, RotateCcw, Video, VideoOff, Minus, Plus, Zap, Eye, AlertCircle, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useGame } from "@/lib/game-context"
import { fetchScore, resetGame, getFrameUrl } from "@/lib/api"

export default function HomePage() {
  const {
    playerA,
    playerB,
    scoreA,
    scoreB,
    gameStatus,
    detectionStatus,
    lastPoint,
    setPlayerA,
    setPlayerB,
    incrementScore,
    decrementScore,
    setScoreA,
    setScoreB,
    setLastPoint,
    startMatch,
    pauseMatch,
    resumeMatch,
    endMatch,
    resetMatch,
    setDetectionStatus,
    pastGames,
  } = useGame()

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
      } catch {
        // silently ignore transient fetch errors
      }
    }
    poll()
    scoreIntervalRef.current = setInterval(poll, 1000)
    return () => {
      if (scoreIntervalRef.current) clearInterval(scoreIntervalRef.current)
    }
  }, [setScoreA, setScoreB, setLastPoint])

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
    resetMatch()
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
            onClick={startMatch}
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
