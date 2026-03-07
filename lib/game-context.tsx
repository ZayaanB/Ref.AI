"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export type GameStatus = "idle" | "active" | "paused" | "ended"
export type DetectionStatus = "disconnected" | "connecting" | "detecting" | "paused"
export type GameEvent = {
  id: string
  type: "point_a" | "point_b" | "out" | "double_bounce" | "let" | "fault" | "net"
  timestamp: Date
  description: string
}

export type PastGame = {
  id: string
  playerA: string
  playerB: string
  scoreA: number
  scoreB: number
  date: Date
  winner: "A" | "B"
  events: GameEvent[]
}

interface GameState {
  playerA: string
  playerB: string
  scoreA: number
  scoreB: number
  gameStatus: GameStatus
  detectionStatus: DetectionStatus
  events: GameEvent[]
  pastGames: PastGame[]
  servingPlayer: "A" | "B"
  matchPoints: number
  lastPoint: string | null
}

interface GameContextType extends GameState {
  setPlayerA: (name: string) => void
  setPlayerB: (name: string) => void
  incrementScore: (player: "A" | "B") => void
  decrementScore: (player: "A" | "B") => void
  setScoreA: (n: number) => void
  setScoreB: (n: number) => void
  setGameStatus: (status: GameStatus) => void
  setDetectionStatus: (status: DetectionStatus) => void
  addEvent: (event: Omit<GameEvent, "id" | "timestamp">) => void
  startMatch: () => void
  pauseMatch: () => void
  resumeMatch: () => void
  endMatch: () => void
  resetMatch: () => void
  setMatchPoints: (points: number) => void
  toggleServe: () => void
  setLastPoint: (s: string | null) => void
}

const GameContext = createContext<GameContextType | undefined>(undefined)

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>({
    playerA: "Player 1",
    playerB: "Player 2",
    scoreA: 0,
    scoreB: 0,
    gameStatus: "idle",
    detectionStatus: "disconnected",
    events: [],
    pastGames: [
      {
        id: "1",
        playerA: "Alex",
        playerB: "Jordan",
        scoreA: 11,
        scoreB: 8,
        date: new Date(Date.now() - 86400000),
        winner: "A",
        events: [],
      },
      {
        id: "2",
        playerA: "Sam",
        playerB: "Chris",
        scoreA: 9,
        scoreB: 11,
        date: new Date(Date.now() - 172800000),
        winner: "B",
        events: [],
      },
    ],
    servingPlayer: "A",
    matchPoints: 11,
    lastPoint: null,
  })

  const setPlayerA = useCallback((name: string) => {
    setState((s) => ({ ...s, playerA: name }))
  }, [])

  const setPlayerB = useCallback((name: string) => {
    setState((s) => ({ ...s, playerB: name }))
  }, [])

  const setScoreA = useCallback((n: number) => {
    setState((s) => ({ ...s, scoreA: n }))
  }, [])

  const setScoreB = useCallback((n: number) => {
    setState((s) => ({ ...s, scoreB: n }))
  }, [])

  const setLastPoint = useCallback((lp: string | null) => {
    setState((s) => ({ ...s, lastPoint: lp }))
  }, [])

  const incrementScore = useCallback((player: "A" | "B") => {
    setState((s) => ({
      ...s,
      [player === "A" ? "scoreA" : "scoreB"]: s[player === "A" ? "scoreA" : "scoreB"] + 1,
    }))
  }, [])

  const decrementScore = useCallback((player: "A" | "B") => {
    setState((s) => ({
      ...s,
      [player === "A" ? "scoreA" : "scoreB"]: Math.max(0, s[player === "A" ? "scoreA" : "scoreB"] - 1),
    }))
  }, [])

  const setGameStatus = useCallback((status: GameStatus) => {
    setState((s) => ({ ...s, gameStatus: status }))
  }, [])

  const setDetectionStatus = useCallback((status: DetectionStatus) => {
    setState((s) => ({ ...s, detectionStatus: status }))
  }, [])

  const addEvent = useCallback((event: Omit<GameEvent, "id" | "timestamp">) => {
    const newEvent: GameEvent = {
      ...event,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    }
    setState((s) => ({
      ...s,
      events: [newEvent, ...s.events].slice(0, 50),
    }))
  }, [])

  const startMatch = useCallback(() => {
    setState((s) => ({
      ...s,
      gameStatus: "active",
      scoreA: 0,
      scoreB: 0,
      events: [],
    }))
  }, [])

  const pauseMatch = useCallback(() => {
    setState((s) => ({ ...s, gameStatus: "paused" }))
  }, [])

  const resumeMatch = useCallback(() => {
    setState((s) => ({ ...s, gameStatus: "active" }))
  }, [])

  const endMatch = useCallback(() => {
    setState((s) => {
      const winner = s.scoreA > s.scoreB ? "A" : "B"
      const newPastGame: PastGame = {
        id: Math.random().toString(36).substr(2, 9),
        playerA: s.playerA,
        playerB: s.playerB,
        scoreA: s.scoreA,
        scoreB: s.scoreB,
        date: new Date(),
        winner,
        events: s.events,
      }
      return {
        ...s,
        gameStatus: "ended",
        pastGames: [newPastGame, ...s.pastGames],
      }
    })
  }, [])

  const resetMatch = useCallback(() => {
    setState((s) => ({
      ...s,
      scoreA: 0,
      scoreB: 0,
      gameStatus: "idle",
      events: [],
      servingPlayer: "A",
      lastPoint: null,
    }))
  }, [])

  const setMatchPoints = useCallback((points: number) => {
    setState((s) => ({ ...s, matchPoints: points }))
  }, [])

  const toggleServe = useCallback(() => {
    setState((s) => ({
      ...s,
      servingPlayer: s.servingPlayer === "A" ? "B" : "A",
    }))
  }, [])

  return (
    <GameContext.Provider
      value={{
        ...state,
        setPlayerA,
        setPlayerB,
        incrementScore,
        decrementScore,
        setScoreA,
        setScoreB,
        setGameStatus,
        setDetectionStatus,
        addEvent,
        startMatch,
        pauseMatch,
        resumeMatch,
        endMatch,
        resetMatch,
        setMatchPoints,
        toggleServe,
        setLastPoint,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const context = useContext(GameContext)
  if (context === undefined) {
    throw new Error("useGame must be used within a GameProvider")
  }
  return context
}
