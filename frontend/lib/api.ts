export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export interface ScoreData {
  score_a: number
  score_b: number
  match_winner: string | null
  ball_x: number | null
  ball_y: number | null
  state: string
  last_point: string | null
}

export async function fetchScore(): Promise<ScoreData> {
  const res = await fetch(`${API_BASE}/score`, { cache: "no-store" })
  if (!res.ok) throw new Error("Failed to fetch score")
  return res.json()
}

export async function resetGame(): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/game/reset`, { method: "POST" })
  if (!res.ok) throw new Error("Failed to reset game")
  return res.json()
}

export function getFrameUrl(ts: number): string {
  return `${API_BASE}/frame?t=${ts}`
}
