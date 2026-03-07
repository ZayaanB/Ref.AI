"use client"

import { motion } from "framer-motion"
import { Trophy } from "lucide-react"
import { useGame } from "@/lib/game-context"

export default function HistoryPage() {
  const { pastGames } = useGame()

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date)
  }

  return (
    <div className="px-5 pt-14 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">History</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Past matches</p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3 mb-8"
      >
        <div className="bg-card rounded-2xl p-5 border border-border">
          <p className="text-xs text-muted-foreground mb-1">Total Matches</p>
          <p className="text-3xl font-semibold">{pastGames.length}</p>
        </div>
        <div className="bg-card rounded-2xl p-5 border border-border">
          <p className="text-xs text-muted-foreground mb-1">This Week</p>
          <p className="text-3xl font-semibold">
            {pastGames.filter(g => {
              const weekAgo = new Date()
              weekAgo.setDate(weekAgo.getDate() - 7)
              return g.date > weekAgo
            }).length}
          </p>
        </div>
      </motion.div>

      {/* Match List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        {pastGames.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">No matches yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pastGames.map((game, index) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.03 }}
                className="bg-card rounded-2xl p-4 border border-border"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-sm truncate ${game.winner === "A" ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                        {game.playerA}
                      </span>
                      {game.winner === "A" && (
                        <Trophy className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm truncate ${game.winner === "B" ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                        {game.playerB}
                      </span>
                      {game.winner === "B" && (
                        <Trophy className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right ml-4">
                    <div className="flex items-center gap-2 text-xl font-semibold tabular-nums">
                      <span className={game.winner === "A" ? "text-foreground" : "text-muted-foreground"}>
                        {game.scoreA}
                      </span>
                      <span className="text-muted-foreground/40">-</span>
                      <span className={game.winner === "B" ? "text-foreground" : "text-muted-foreground"}>
                        {game.scoreB}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDate(game.date)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
