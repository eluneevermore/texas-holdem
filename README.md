# Texas Hold'em Poker

A real-time multiplayer Texas Hold'em poker platform built as a pnpm monorepo with a shared game engine, Fastify/Socket.io backend, React web client, and Ink terminal client.

## Architecture

```
packages/
  shared/     Pure game logic, types, constants, bot strategies (zero side effects)
  server/     Fastify REST API + Socket.io real-time server, Prisma/Postgres, Redis
  web/        React + Vite SPA with Zustand state management
  terminal/   Ink (React for CLI) TUI client
```

### Data flow

1. **shared** defines all types, game rules, and event constants.
2. **server** runs the authoritative game state machine, validates every action, and broadcasts state via Socket.io.
3. **web** and **terminal** are display-only clients — they never trust local state, always wait for server confirmation.

## Prerequisites

- **Node.js** >= 18
- **pnpm** >= 9
- **PostgreSQL** (default port 5432, or configure via `DATABASE_URL`)
- **Redis** (default port 6379)

## Setup

```bash
# Clone and install
git clone <repo-url> && cd PER.texas-holdem
pnpm install

# Environment variables
cp .env.example .env
# Edit .env with your database credentials, JWT secrets, and Google OAuth keys

# Database setup
pnpm --filter @poker/server db:migrate

# Build shared package (required before running server/web/terminal)
pnpm --filter @poker/shared build
```

## Running

```bash
# All packages in dev mode (server + web + terminal)
pnpm dev

# Individual packages
pnpm --filter @poker/server dev      # API server on http://localhost:3001
pnpm --filter @poker/web dev         # Web UI on http://localhost:5173
pnpm --filter @poker/terminal dev    # Terminal TUI (requires server running)
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server HTTP port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `JWT_SECRET` | — | Access token signing key |
| `JWT_REFRESH_SECRET` | — | Refresh token signing key |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | `http://localhost:3001/auth/google/callback` | OAuth callback |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `VITE_SERVER_URL` | `http://localhost:3001` | Server URL for web client |
| `POKER_SERVER_URL` | `http://localhost:3001` | Server URL for terminal client |

## Testing

Tests use **Vitest** with real PostgreSQL and Redis connections.

### Test database setup

Create a separate test database:

```sql
CREATE DATABASE poker_test;
```

Run migrations against it:

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/poker_test pnpm --filter @poker/server db:migrate
```

### Running tests

```bash
# All packages
pnpm test

# Individual packages
pnpm --filter @poker/shared test
pnpm --filter @poker/server test
pnpm --filter @poker/terminal test

# Watch mode
pnpm --filter @poker/shared test -- --watch

# Type checking
pnpm typecheck
```

### Test structure

| Package | Test type | What it covers |
|---|---|---|
| `shared` | Unit | Hand evaluator, pot calculator, betting rules, bot strategies |
| `server` | Integration | Full game flow with real DB/Redis: auth, rooms, hands, showdowns, multi-hand persistence |
| `terminal` | Integration | CLI startup (execa), full game simulations via Socket.io with rigged decks, state synchronization |

Server and terminal integration tests:
- Boot a real Fastify + Socket.io server on a random port
- Connect multiple `socket.io-client` instances
- Use `setShuffleOverride` to rig decks for deterministic outcomes
- Simulate complete multi-hand games including fold wins, showdowns, all-ins, and chip carryover

## Game Features

- **Room system**: Create/join rooms with 6-character codes, configurable blinds and stacks
- **Full Texas Hold'em**: Pre-flop through river with proper blind posting, dealer rotation, side pots
- **Bot players**: AI opponents with Normal difficulty strategy (no access to other players' cards)
- **Turn timer**: 30-second server-enforced timer with auto-fold on timeout
- **Buy-in**: Re-buy when broke (configurable per room)
- **Real-time state**: Unified `GamePublicState` broadcast keeps all clients in sync
- **Google OAuth + Guest**: Authenticated sessions or quick guest play

## Web UI Features

- Pot-relative raise presets (1/4, 1/2, 1/1 pot) in dropdown menu
- Player seat rotation (current user always at bottom)
- Inline hand results — winner bubbles and showdown cards on player seats
- Turn highlighting with animated timer ring
- Action bubbles (fade-out animation on player actions)

## Terminal UI Controls

| Screen | Key | Action |
|---|---|---|
| Lobby | `1` | Create room |
| Lobby | `2` | Join room |
| Lobby | `Q` | Quit |
| Waiting | `R` | Toggle ready |
| Waiting | `A` | Add bot (host only) |
| Game | `F` | Fold |
| Game | `C` | Check / Call |
| Game | `R` | Raise (enter amount) |
| Game | `A` | All-in |

## Project Structure

```
packages/shared/src/
  types/          TypeScript interfaces and enums (Card, Player, Game, Room)
  constants/      Event names, config limits, rate limits
  game/           Pure functions: deck, hand evaluator, pot calculator, betting
  bot/            Bot strategies and types

packages/server/src/
  routes/         Fastify REST handlers (auth, rooms)
  socket/         Socket.io event handlers (room, game)
  game/           State machine, room manager
  bots/           Bot execution runtime
  auth/           JWT, OAuth, guest sessions
  db/             Prisma client and repositories

packages/web/src/
  pages/          Route-level components
  components/     UI components (table/, waiting/, common/)
  stores/         Zustand stores (auth, room, game, socket)
  socket/         Socket.io event bindings

packages/terminal/src/
  cli/            Entry point
  screens/        Ink screen components
  socket/         Socket.io client
  store/          Plain object state (no Zustand)
```

## License

Private — not for redistribution.
