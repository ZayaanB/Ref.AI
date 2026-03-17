# RefAI

A real-time automated ping pong referee system using computer vision. The system tracks the ball, detects bounces and out-of-bounds violations, and automatically scores rallies according to official ping pong rules.

## Features

- Real-time ball tracking via HSV color detection and Kalman filtering
- Automatic bounce detection using vertical velocity reversal
- Out-of-bounds detection with hysteresis
- Full serve and rally rule enforcement (state machine)
- Official ping pong scoring (first to 11, win by 2)
- Standalone OpenCV GUI mode or FastAPI web server mode
- Interactive calibration wizard
- Next.js web frontend with Solana escrow for staked matches

## Project Structure

```
Ref/
├── frontend/          # Next.js app (UI, Solana wallet, escrow)
│   ├── app/           # Pages and API routes
│   ├── components/    # React components
│   ├── hooks/         # Custom hooks
│   ├── lib/           # API client, game context, escrow logic
│   └── public/        # Static assets
├── backend/           # Python CV referee (FastAPI)
│   ├── server.py      # FastAPI server (CV + REST)
│   ├── game.py        # Game logic and state machine
│   ├── tracker.py     # Ball detection and bounce/OOB detection
│   ├── display.py     # OpenCV drawing utilities
│   ├── calibration.py # Interactive calibration wizard
│   └── requirements.txt
└── programs/refai_escrow/  # Solana escrow program (Anchor/Rust)
```

## Getting Started

### Backend (Python CV)

```bash
cd backend
pip install -r requirements.txt
python server.py
```

API runs at `http://localhost:8000`:
- `GET /score` — Current scores, game state, ball position
- `POST /game/reset` — Reset scores and start a new game
- `GET /frame` — Latest camera frame as JPEG

### Frontend (Next.js)

```bash
cd frontend
cp .env.local.example .env.local  # Configure Solana, API URL
pnpm install
pnpm dev
```

### Solana Program (optional)

```bash
anchor build
anchor deploy
```

## Key Technologies

| Technology         | Usage                                           |
| ------------------ | ----------------------------------------------- |
| OpenCV             | Camera capture, HSV filtering, contour analysis |
| Kalman Filter      | Smooth predictive ball tracking (x, y, vx, vy)  |
| FastAPI            | REST API for web frontend integration           |
| Next.js            | Web frontend, API routes for escrow             |
| Solana/Anchor      | On-chain escrow for match stakes                |

## Game Rules Enforced

- Serve must bounce on the server's side first, then cross to the opponent's side
- A missed return or out-of-bounds awards the point to the last valid striker
- If no return is detected within 3 seconds after a bounce, the point is awarded
- First player to 11 points wins, must win by 2
- Server alternates every 2 points
