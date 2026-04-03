# Texas Hold'em Poker — Project Specification

**Version:** 1.2.0
**Status:** Draft

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Real-Time Communication](#3-real-time-communication)
4. [Authentication & Identity](#4-authentication--identity)
5. [Room Lifecycle](#5-room-lifecycle)
6. [Game Rules — Texas Hold'em](#6-game-rules--texas-holdem)
7. [Player & Bot Behaviour](#7-player--bot-behaviour)
8. [Buy-In System](#8-buy-in-system)
9. [Data Models](#9-data-models)
10. [API Reference](#10-api-reference)
11. [WebSocket Events](#11-websocket-events)
12. [Web Client (React)](#12-web-client-react)
13. [Terminal Client](#13-terminal-client)
14. [Bot AI Design](#14-bot-ai-design)
15. [Error Handling & Edge Cases](#15-error-handling--edge-cases)
16. [Security](#16-security)
17. [Environment & Deployment](#17-environment--deployment)
18. [Testing Strategy](#18-testing-strategy)
19. [Open Questions / Future Work](#19-open-questions--future-work)

---

## 1. Overview

A multiplayer Texas Hold'em poker platform supporting Google-authenticated users and guests, real-time room-based gameplay, bot opponents, and both a web and terminal client — all within a monorepo.

### Goals

- Low-friction entry: join as a guest with one click or sign in via Google.
- Host-controlled rooms with shareable invite codes.
- Accurate Texas Hold'em rules including side pots and all-in logic.
- Extensible bot AI system starting with Normal difficulty.
- Playable from a terminal as a first-class experience.

### Non-Goals (v1)

- Persistent leaderboards or ELO ranking.
- Real-money transactions.
- Spectator chat or emoji reactions.
- Mobile-native apps.

---

## 2. Architecture

### 2.1 Monorepo Structure

```
poker/
├── packages/
│   ├── server/          # API + WebSocket server (Node.js / Fastify)
│   ├── web/             # React web client
│   ├── terminal/        # Terminal client (Node.js / Ink)
│   └── shared/          # Shared types, game logic, constants
├── package.json         # Root workspace config (pnpm workspaces)
└── turbo.json           # Turborepo task pipeline (optional)
```

### 2.2 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Server | Node.js + Fastify | Fast, low overhead, native WS support |
| Real-time | Socket.io | Rooms, reconnection, fallback transport |
| Auth | Google OAuth 2.0 + JWT | Standard, easy guest fallback |
| Web client | React + Vite + Zustand | Lightweight state, fast HMR |
| Terminal client | Node.js + Ink | React-like TUI, shared logic from `shared/` |
| Shared logic | TypeScript | Type safety across all packages |
| Database | PostgreSQL + Prisma | Player records, hand history |
| Session store | Redis | Socket sessions, room state cache |

### 2.3 Package Responsibilities

**`packages/shared`**

- TypeScript types and interfaces for all domain objects (Room, Player, Hand, Card, etc.)
- Pure game logic: hand evaluation, pot calculation, side pot splitting, deck operations.
- Constants: blind levels, default configs, event name enums.
- This package has zero runtime dependencies and is imported by all other packages.

**`packages/server`**

- REST endpoints for auth, room creation, and join.
- Socket.io server managing room namespaces and game state machines.
- Bot player process / coroutine spawning.
- Persistence layer via Prisma.

**`packages/web`**

- React SPA communicating with server via REST + Socket.io client.
- Renders lobby, waiting room, and game table.

**`packages/terminal`**

- Full-featured TUI built with Ink.
- Connects to the same server via Socket.io.
- Shares all types and game logic from `shared/`.

---

## 3. Real-Time Communication

### 3.1 Transport

Socket.io is used for all real-time communication with WebSocket as the primary transport and HTTP long-polling as an automatic fallback. This gives:

- Built-in room/namespace scoping per poker room.
- Automatic reconnection with session resumption.
- Works through most corporate firewalls via the polling fallback.

### 3.2 Room Namespacing

Each poker room maps to a Socket.io room identified by its `roomCode`. All game events are scoped to that room — the server never broadcasts a game event to sockets outside the relevant room.

### 3.3 Reconnection Behaviour

When a human player disconnects mid-game (network drop, browser close):

- Server marks them as `DISCONNECTED` but keeps their seat for **60 seconds**.
- During this window, the game pauses only if it is their turn. A countdown timer is shown to all players.
- If not their turn, the game continues.
- On reconnect within the window, full game state is pushed to the rejoining client.
- After 60 seconds, their hand is auto-folded and they are treated as if they voluntarily left.

---

## 4. Authentication & Identity

### 4.1 Google OAuth Sign-In

- Standard OAuth 2.0 flow via Google Identity Services.
- On successful sign-in, server issues a short-lived JWT (access token, 1 hour) and a refresh token (7 days, stored HTTP-only cookie).
- User record stored in DB: `userId`, `email`, `displayName`, `avatarUrl`.
- Stats tracked: games played, games won, total buy-ins.

### 4.2 Guest Users

- Clicking "Play as Guest" generates a temporary identity server-side: `guestId` (UUID), `displayName` (e.g. "Guest#4821").
- Guest session is valid for the duration of their browser session (or terminal session).
- No stats are persisted for guests.
- Guests can play fully but cannot view historical records.

### 4.3 Identity in Terminal Client

- On first launch, terminal client checks for a stored token in `~/.poker/config.json`.
- User can run `poker login` to open a browser-based OAuth flow and store the resulting token.
- Or run `poker play --guest` to play as a guest without authentication.

---

## 5. Room Lifecycle

### 5.1 Room States

```
WAITING (lobby) ──► PLAYING (hand in progress) ──► BETWEEN_HANDS
       ▲                       │                        │
       │                       └── only 1 player ──►   │
       │                                                │
       └──────────────── all ready again ───────────────┘
                                │
                          no humans left
                                │
                                ▼
                             CLOSED
```

There are two conceptually different WAITING sub-states:

- **Lobby WAITING**: No game has started yet. All players join with their initial stack. Host can change all settings freely.
- **Between-hand WAITING**: At least one hand has been played. Seats are assigned. Players retain their chip counts. Only the host can change settings that take effect from the *next* hand (e.g. buy-in toggle). Blind/stack settings are locked once a game has started to prevent mid-session inconsistencies.

The distinction is tracked via a `handCount` field on the room (`handCount === 0` means lobby state).

### 5.2 Creating a Room

Any authenticated or guest user can host a room. On creation, the server generates:

- A unique `roomCode` (6 uppercase alphanumeric characters, e.g. `AX7K2Q`).
- A shareable invite URL: `https://<host>/join/<roomCode>`.

#### Host-Configurable Settings (editable during WAITING only)

| Setting | Type | Default | Notes |
|---|---|---|---|
| `smallBlind` | number | 10 | Must be > 0 |
| `bigBlind` | number | 20 | Must be ≥ 2× small blind |
| `initialStack` | number | 1000 | Chips each player starts with |
| `buyInAllowed` | boolean | true | Whether broke players may buy in |
| `buyInAmount` | number | 1000 | Chips received per buy-in |
| `maxPlayers` | number | 9 | 2–9 |

#### Seat Assignment

Seats (indexed 0–8) are assigned in join order: the first player to join takes seat 0, the next seat 1, and so on. Bots are assigned to the next available seat when added. Seats do not shift when a player leaves — the empty seat remains until the hand ends, at which point it is removed and remaining players keep their seats.

### 5.3 Joining a Room

- Via URL: `GET /join/:roomCode` redirects to the room page, auto-connecting via Socket.io.
- Via code entry: user types the 6-character code in the lobby.
- Joining is rejected if: room is full, room does not exist, or the game is in an ongoing hand (players may join between hands only).

### 5.4 Waiting Room

All players start in the waiting room after joining.

#### Ready System

- Each human player has a ready toggle (default: unready).
- Bot players are always ready.
- The host can start the game manually **only** when all human players are ready and there are at least 2 players total (human + bot counts).
- When all human players flip to ready simultaneously, the game auto-starts after a 3-second countdown (giving time to unready).

#### Host Actions (WAITING only)

- Change room settings.
- Add a bot player (up to `maxPlayers` total). Bot is added instantly and shown in the player list.
- Kick any player (human or bot) from the room. Kicked players see a notification and are returned to the lobby.
- Transfer host role manually to another human player via `room:transferHost`.
- Start the game manually once all players are ready (if auto-start countdown was cancelled).

### 5.5 Host Migration

When the current host leaves at any time:

1. The server selects a random connected human player to become the new host.
2. The new host is notified and gains host privileges.
3. If no human players remain, the room is closed immediately.

### 5.6 Room Closure

A room closes (state `CLOSED`) when:

- All human players have left and there are no human players remaining.
- The host explicitly closes the room from the waiting room.

Bots do not prevent room closure — a room with only bots closes immediately.

### 5.7 Leaving Mid-Game

When a human player leaves during an active hand:

1. If it is their turn, their hand is immediately folded.
2. If they are in a current bet (have chips in the pot), those chips remain in the pot and are distributed as normal.
3. Their seat is removed after the current hand completes.
4. Host migration logic applies if applicable.

---

## 6. Game Rules — Texas Hold'em

### 6.1 Hand Phases

Each hand proceeds through the following phases in order:

```
Pre-Deal → Pre-Flop → Flop → Turn → River → Showdown
```

**Pre-Deal**

- Dealer button advances clockwise each hand.
- Small blind posts `smallBlind` chips; big blind posts `bigBlind` chips.
- Each active player is dealt 2 private hole cards.

**Pre-Flop**

- Betting begins with the player to the left of the big blind (Under the Gun).
- Action order: call, raise, or fold. Minimum raise = current bet size.

**Flop**

- 3 community cards are dealt face-up.
- Betting begins with the first active player to the left of the dealer button.

**Turn**

- 1 community card is dealt face-up.
- Betting round as above.

**River**

- 1 final community card is dealt face-up.
- Final betting round.

**Showdown**

- Players reveal hole cards in order starting from the last aggressor (the player who made the final bet or raise), then proceeding clockwise.
- A player whose hand is beaten by an already-revealed hand may **muck** (discard without showing). Only the winning hand(s) are required to be shown. The server enforces eligibility.
- Best 5-card hand from any combination of 2 hole cards + 5 community cards wins.
- In case of a tie, the pot is split equally (odd chip goes to player closest left of dealer).

#### Pot Display Definition

The displayed pot value at all times equals all chips committed in previous betting rounds **plus** all chips committed in the current round. The pot shown always includes live bets. Individual player bet amounts are displayed separately beneath each seat so players can distinguish their contribution from the total pot.

### 6.2 Betting Rules

- **Check**: Allowed when no bet has been placed in the current round.
- **Call**: Match the current highest bet.
- **Raise**: Increase the current bet. Minimum raise equals the size of the previous raise (or the big blind if no raise yet). No cap on raises (no-limit).
- **Fold**: Discard hand and forfeit chips already in pot.
- **All-In**: Bet all remaining chips. Player may win only up to the amount they matched from each other player.

#### Big Blind Option (Pre-Flop)

If no player raises pre-flop (everyone calls or folds around to the big blind), the big blind has the option to raise before the flop is dealt. This is the last action of the pre-flop round. The UI must present the big blind with raise/check options rather than immediately advancing to the flop.

#### Re-Raise After a Sub-Minimum All-In

If a player goes all-in for an amount less than a full minimum raise, this does not re-open the betting for players who have already acted in that round. Only players who have not yet acted, or who face a full raise, may re-raise. The server enforces this; the client must reflect it by disabling the raise option for ineligible players.

### 6.3 Side Pots

Side pots are created whenever a player goes all-in for less than the current bet:

1. The all-in player can only win the main pot, which is capped at their all-in amount × number of contributors.
2. Players who called beyond that amount form a side pot among themselves.
3. Multiple side pots may exist simultaneously (one per all-in event at a different stack size).
4. At showdown, pots are awarded **smallest (innermost) first, then outward to larger side pots**. This ensures an all-in player is evaluated for pots they are eligible to win before those they are not. A player who is all-in and loses the main pot cannot win a side pot they are ineligible for.

### 6.4 Hand Rankings (highest to lowest)

1. Royal Flush — A K Q J 10 of the same suit
2. Straight Flush — Five consecutive cards of the same suit
3. Four of a Kind — Four cards of the same rank
4. Full House — Three of a kind + a pair
5. Flush — Five cards of the same suit
6. Straight — Five consecutive cards (Ace can be high or low)
7. Three of a Kind
8. Two Pair
9. One Pair
10. High Card

### 6.5 Turn Timer

Each player has **30 seconds** to act on their turn. A visible countdown is displayed to all players. If the timer expires:

- If the player can check, they automatically check.
- Otherwise, they automatically fold.

A player who times out 3 consecutive times in a single session is marked as `AFK` and auto-folds every subsequent turn until they take a manual action.

### 6.6 Between Hands

After each hand resolves:

- Pot(s) are awarded with an animated summary.
- Broke players (0 chips) are moved to observer status.
- A 5-second pause before the next hand begins (skippable if all players click "Ready for next hand").
- Players who joined mid-game (between hands) are seated for the next hand.

---

## 7. Player & Bot Behaviour

### 7.1 Player States

| State | Description |
|---|---|
| `WAITING` | In the lobby waiting room before any hand has been played |
| `SITTING_OUT` | Joined between hands; will be seated at the start of the next hand |
| `ACTIVE` | Playing in the current hand |
| `FOLDED` | Folded in the current hand |
| `ALL_IN` | All chips committed, waiting for showdown |
| `OBSERVER` | Watching; no chips to play (went broke, not yet bought in) |
| `DISCONNECTED` | Temporarily disconnected, 60-second grace period active |
| `LEFT` | Has left the room |

`SITTING_OUT` applies to players who join a room while a hand is already in progress, or who have queued a buy-in and are waiting for the next hand to start. They are visible in the player list but do not participate in the current hand.

### 7.2 Observer Mode

Players with 0 chips become observers automatically after the hand ends. Observers:

- See all community cards and bet amounts.
- Do **not** see other players' hole cards until showdown.
- Can see their own previous hand history for the session.
- See a "Buy In" button if `buyInAllowed` is enabled on the room.

### 7.3 Bot Players

- Bots occupy seats like human players and act within the same turn timer window.
- Bots simulate "thinking" with a randomised delay (0.5–3 seconds) before acting.
- Bots never disconnect, never go AFK, and cannot be given host privileges.
- Bots added during the waiting room are visible in the player list with a `[BOT]` tag.
- The host can remove bots during the waiting room via kick.

---

## 8. Buy-In System

- When a player reaches 0 chips, they become an observer.
- If `buyInAllowed` is `true`, they see a "Buy In" button.
- Clicking "Buy In" queues the player to re-enter at the start of the **next hand** with `buyInAmount` chips. Their state transitions to `SITTING_OUT`.
- Each buy-in is tracked as a counter per player per room session (`buyInCount`).
- Buy-ins are not allowed mid-hand.
- Guests' buy-in counts are tracked for the session but not persisted.
- The host can disable buy-ins at any time from the room settings (takes effect from the next hand). Players who have already queued a buy-in before it is disabled will still receive their chips for that next hand.
- **Buy-in cap:** `buyInAmount` must be ≤ `initialStack × 3`. The host cannot set a buy-in amount that would give a returning player a stack more than 3× the initial stack. This is validated server-side on config update.

#### Stats: When `gamesPlayed` Increments

For authenticated users, `gamesPlayed` increments once per room session in which the player participated in **at least one hand as an active player** (not as a pure observer). `gamesWon` increments once per hand in which the player wins any pot (including side pots). `totalBuyIns` increments once per confirmed buy-in.

---

## 9. Data Models

### 9.1 User

```typescript
interface User {
  userId: string;           // UUID
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: Date;
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    totalBuyIns: number;
  };
}
```

### 9.2 Room

```typescript
interface Room {
  roomId: string;           // UUID
  roomCode: string;         // 6-char invite code
  hostId: string;           // userId or guestId
  state: 'WAITING' | 'PLAYING' | 'CLOSED';
  handCount: number;        // 0 = lobby WAITING; >0 = between-hand WAITING
  config: RoomConfig;
  players: RoomPlayer[];
  createdAt: Date;
  closedAt?: Date;
}

interface RoomConfig {
  smallBlind: number;
  bigBlind: number;
  initialStack: number;
  buyInAllowed: boolean;
  buyInAmount: number;
  maxPlayers: number;
}
```

### 9.3 RoomPlayer

```typescript
interface RoomPlayer {
  playerId: string;         // userId, guestId, or botId
  displayName: string;
  isBot: boolean;
  isHost: boolean;
  isReady: boolean;
  seatIndex: number;        // 0–8, assigned in join order
  chips: number;
  playerState: PlayerState;
  buyInCount: number;
}
```

### 9.4 GameHand

```typescript
interface GameHand {
  handId: string;
  roomId: string;
  handNumber: number;
  dealerSeatIndex: number;
  communityCards: Card[];
  pots: Pot[];
  players: HandPlayer[];
  winners: HandWinner[];    // Populated at hand completion
  phase: 'PRE_FLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN' | 'COMPLETE';
  activePlayerSeatIndex: number | null; // null during SHOWDOWN and COMPLETE phases
  currentBet: number;
  startedAt: Date;
  completedAt?: Date;
}

interface HandWinner {
  playerId: string;
  potIndex: number;         // Which pot (0 = main pot, 1+ = side pots)
  amount: number;
  handRank?: string;        // e.g. "Full House, Aces over Kings" — null if won by fold
  mucked: boolean;          // Did the winner choose to muck (only possible if all others folded)
}

interface Pot {
  amount: number;
  eligiblePlayerIds: string[];
}

interface Card {
  suit: 'spades' | 'hearts' | 'diamonds' | 'clubs';
  rank: '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A';
}

interface HandPlayer {
  playerId: string;
  seatIndex: number;
  holeCards: Card[];          // Visible to owner only; revealed at showdown unless mucked
  mucked: boolean;
  chipsAtStart: number;
  chipsAtEnd?: number;
  actions: PlayerAction[];
  handState: 'ACTIVE' | 'FOLDED' | 'ALL_IN';
}

interface PlayerAction {
  type: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE' | 'ALL_IN';
  amount?: number;
  phase: string;
  timestamp: Date;
}
```

### 9.5 BotGameState

The shape passed to all bot strategy functions:

```typescript
interface BotGameState {
  // Bot's own identity
  botPlayerId: string;
  botSeatIndex: number;
  botHoleCards: Card[];
  botChips: number;

  // Current hand context
  phase: 'PRE_FLOP' | 'FLOP' | 'TURN' | 'RIVER';
  communityCards: Card[];
  pots: Pot[];
  currentBet: number;       // Highest bet in this round
  botCurrentBet: number;    // How much the bot has already bet this round
  callAmount: number;       // Chips needed to call (currentBet - botCurrentBet)
  minRaiseAmount: number;   // Minimum total raise amount
  maxRaiseAmount: number;   // Bot's total chips (all-in cap)

  // Other players (hole cards not visible)
  opponents: Array<{
    playerId: string;
    seatIndex: number;
    chips: number;
    currentBet: number;
    handState: 'ACTIVE' | 'FOLDED' | 'ALL_IN';
    isDealer: boolean;
    isSmallBlind: boolean;
    isBigBlind: boolean;
  }>;

  dealerSeatIndex: number;
  handNumber: number;
}
```

---

## 10. API Reference

### 10.1 Authentication

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/google` | Initiate Google OAuth flow |
| `GET` | `/auth/google/callback` | OAuth callback, sets JWT cookie |
| `POST` | `/auth/guest` | Create guest session, returns guestId + token |
| `POST` | `/auth/refresh` | Refresh access token using refresh cookie |
| `POST` | `/auth/logout` | Invalidate session |

### 10.2 Rooms

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/rooms` | Required | Create a new room |
| `GET` | `/rooms/:roomCode` | Optional | Get room info (for join page preview) |
| `POST` | `/rooms/:roomCode/join` | Required | Join a room (returns Socket.io token) |
| `PATCH` | `/rooms/:roomCode/config` | Required (host) | Update room config (WAITING state only) |
| `GET` | `/rooms/:roomCode/hands` | Required | Fetch last N hands for the session (`?limit=10`) |

### 10.3 User

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/me` | Required | Get current user profile + stats |

All endpoints return JSON. Auth endpoints use cookies for tokens; game API uses `Authorization: Bearer <token>` header.

---

## 11. WebSocket Events

All events are scoped to a room via Socket.io room membership. Events are namespaced as `server → client` or `client → server`.

### 11.1 Connection

| Event | Direction | Payload | Description |
|---|---|---|---|
| `room:joined` | S→C | `{ room, player }` | Emitted to joining player with full room state |
| `room:playerJoined` | S→C (broadcast) | `{ player }` | New player visible to all |
| `room:playerLeft` | S→C (broadcast) | `{ playerId, newHostId? }` | Player left, optional host change |
| `room:kicked` | S→C (target) | `{ reason }` | You were kicked |
| `room:closed` | S→C (broadcast) | `{}` | Room has closed |

### 11.2 Waiting Room

| Event | Direction | Payload | Description |
|---|---|---|---|
| `room:readyToggle` | C→S | `{}` | Toggle own ready state |
| `room:readyChanged` | S→C (broadcast) | `{ playerId, isReady }` | A player's ready state changed |
| `room:configUpdate` | C→S | `Partial<RoomConfig>` | Host updates room settings |
| `room:configChanged` | S→C (broadcast) | `{ config }` | Settings changed |
| `room:addBot` | C→S | `{}` | Host requests adding a bot |
| `room:botAdded` | S→C (broadcast) | `{ player: RoomPlayer }` | Bot successfully added; contains full bot player record |
| `room:kickPlayer` | C→S | `{ playerId }` | Host kicks a player |
| `room:transferHost` | C→S | `{ playerId }` | Host manually transfers host role |
| `room:hostChanged` | S→C (broadcast) | `{ newHostId }` | Host role transferred |
| `room:countdown` | S→C (broadcast) | `{ seconds }` | Auto-start countdown |

### 11.3 Gameplay

| Event | Direction | Payload | Description |
|---|---|---|---|
| `game:start` | S→C (broadcast) | `{ hand }` | New hand begins, initial state |
| `game:dealHoleCards` | S→C (target) | `{ cards: Card[] }` | Private hole cards dealt to each player |
| `game:phaseChange` | S→C (broadcast) | `{ phase, communityCards }` | Phase advanced, new cards revealed |
| `game:turnStart` | S→C (broadcast) | `{ playerId, timeoutAt, canCheck, canRaise, callAmount, minRaise }` | A player's turn begins |
| `game:timerTick` | S→C (broadcast) | `{ playerId, secondsRemaining }` | Sent every second during a player's turn; clients should use this as authoritative countdown rather than local timers |
| `game:action` | C→S | `{ type, amount? }` | Player submits action |
| `game:actionBroadcast` | S→C (broadcast) | `{ playerId, action }` | Action taken, visible to all |
| `game:potUpdate` | S→C (broadcast) | `{ pots, currentRoundBets }` | Pot and bet amounts updated |
| `game:showdown` | S→C (broadcast) | `{ players: [{id, cards, handRank, mucked}] }` | Cards revealed (mucked players excluded) |
| `game:handResult` | S→C (broadcast) | `{ winners: HandWinner[], players: [{id, chipsEnd}] }` | Hand complete, winners and chip counts |
| `game:handHistory` | C→S | `{ limit: number }` | Request last N hand summaries |
| `game:handHistoryResult` | S→C (target) | `{ hands: GameHand[] }` | Hand history response |
| `game:playerBroke` | S→C (broadcast) | `{ playerId }` | Player has 0 chips |
| `game:playerAFK` | S→C (broadcast) | `{ playerId, consecutiveTimeouts }` | Player marked AFK after 3 consecutive timeouts; clients should display a visual indicator on their seat |
| `game:buyIn` | C→S | `{}` | Player requests buy-in for next hand |
| `game:buyInConfirmed` | S→C (broadcast) | `{ playerId, chips, buyInCount }` | Buy-in queued |
| `error` | S→C (target) | `{ code, message, context? }` | Server rejected an action or request; `code` is a stable string enum (e.g. `INVALID_ACTION`, `NOT_YOUR_TURN`, `ROOM_FULL`) |

---

## 12. Web Client (React)

### 12.1 Pages & Routes

| Route | Component | Description |
|---|---|---|
| `/` | `Lobby` | Sign in or guest entry, join/create room |
| `/room/:roomCode` | `RoomPage` | Waiting room or game table (state-driven) |
| `/profile` | `Profile` | Auth users only: stats and history |

### 12.2 State Management

Zustand stores:

- `useAuthStore` — current user identity, token.
- `useRoomStore` — room config, player list, ready states.
- `useGameStore` — current hand state, community cards, pot, active player.
- `useSocketStore` — Socket.io connection instance, connection status.

### 12.3 Key Components

**Connection Status Indicator**

A persistent banner or badge is displayed at all times indicating socket connection health:

- `CONNECTED` — no indicator shown (normal state).
- `RECONNECTING` — amber banner: "Connection lost — reconnecting… (Xm Xs remaining)". The countdown reflects the 60-second grace window. If it is the disconnected player's turn, the turn timer is paused and a "waiting for reconnection" label is shown on their seat.
- `FAILED` — red banner: "Connection lost. Your hand has been folded." with a "Return to Lobby" button.

**Waiting Room**

- Player list with ready indicators and host crown.
- Room code display with copy button and QR code.
- Config panel (host only): sliders/inputs for blind levels, stack, buy-in settings.
- "Add Bot" button (host only).
- "Ready / Unready" toggle button.
- Countdown overlay when auto-start is triggered.

**Game Table**

- Oval table layout with seats positioned around it.
- Each seat shows: avatar, display name, chip count, current bet, player state indicator, turn timer ring.
- **AFK indicator**: a grey `ZZZ` badge overlaid on the seat avatar when `game:playerAFK` is received for that player.
- **Disconnected indicator**: a pulsing red ring on the seat when a player's state is `DISCONNECTED`.
- Community card area in the center with pot display.
- Hole cards in the bottom-center (current player's cards, always visible to owner).
- Action panel (fold, check/call, raise with amount slider) — visible only on your turn.
- **Observer view**: Observers see the full table, all chip counts, and the pot. They do not see any player's hole cards until showdown. The action panel is replaced by a "You are observing" label with a "Buy In" button (if `buyInAllowed`). A `SITTING_OUT` badge is shown on their own seat slot.
- Hand result overlay: winner highlight, pot animation, hand ranking label.
- Side pot breakdown shown when multiple pots exist.

### 12.4 Responsive Design

- Desktop (≥1024px): full oval table layout.
- Tablet (768–1023px): compact table, smaller seats.
- Mobile (< 768px): linear player list layout, action bar pinned to bottom. (Functional but not the primary target.)

---

## 13. Terminal Client

The terminal client is a first-class playable client built with **Ink** (React for terminals). It connects to the same server via Socket.io and shares all types and game logic from `packages/shared`.

### 13.1 CLI Entry Points

```bash
poker login           # Browser-based OAuth, stores token in ~/.poker/config.json
poker play            # Interactive lobby: shows options to create or join a room
poker play --guest    # Skip auth, enter lobby as guest
poker join <code>     # Join specific room by code directly (skips lobby)
```

`poker play` is the single entry point for gameplay. The `create` flow is an option within the interactive lobby — there is no separate `poker create` command. This avoids ambiguity.

### 13.2 Screens

**Lobby Screen**

```
┌─ POKER ─────────────────────────────────────┐
│ Signed in as: elune@gmail.com               │
│                                             │
│  [1] Create Room                            │
│  [2] Join Room                              │
│  [3] View Profile                           │
│  [Q] Quit                                   │
└─────────────────────────────────────────────┘
```

**Waiting Room Screen**

```
┌─ Room: AX7K2Q ──────────────────────────────┐
│ Blinds: 10/20   Stack: 1000   Buy-in: ON    │
│                                             │
│  Seat  Player            Chips    Ready     │
│  ────  ──────────────    ─────    ─────     │
│  [1]   elune (you, HOST) 1000     ✓         │
│  [2]   Guest#4821        1000     ✗         │
│  [3]   Bot_Normal        1000     ✓         │
│                                             │
│ [R] Toggle Ready  [A] Add Bot  [K] Kick     │
│ [S] Settings      [Q] Leave                 │
└─────────────────────────────────────────────┘
```

**Game Table Screen**

```
┌─ Hand #7 ─ Pot: 340 ────────────────────────┐
│                                             │
│  Community: [A♠][K♦][7♣][2♥][ ? ]          │
│                                             │
│  Seat  Player          Chips   Bet   Role   │
│  ────  ──────────────  ─────   ───   ────   │
│  [1]   elune (you)      650     80   BB     │
│  [2]   Guest#4821       420     80   FOLD   │
│  [3]   Bot_Normal       890     80   D/SB   │
│                                             │
│  Your cards: [Q♠][J♠]                      │
│  Phase: TURN  ── Your turn! (28s)           │
│                                             │
│  [F] Fold   [C] Call 80   [R] Raise         │
└─────────────────────────────────────────────┘
```

Role column values: `D` (Dealer), `SB` (Small Blind), `BB` (Big Blind), `D/SB` (Dealer + Small Blind in heads-up), `FOLD` (Folded this hand).

**Between-Hand Summary Screen**

Displayed for 5 seconds after each hand before the next hand begins:

```
┌─ Hand #7 Result ────────────────────────────┐
│                                             │
│  🏆  elune wins 340 chips                   │
│      with: Flush, Queen-high                │
│                                             │
│  Cards revealed:                            │
│    elune:      [Q♠][J♠]  (Flush)            │
│    Bot_Normal: [mucked]                     │
│                                             │
│  Chip counts:                               │
│    elune       990  (+340)                  │
│    Bot_Normal  890   (-80)                  │
│    Guest#4821  420   (-80) (observer)       │
│                                             │
│  Next hand in 4s...  [SPACE] Skip           │
└─────────────────────────────────────────────┘
```

### 13.3 Raise Input

When the player presses `R`, an inline input appears:

```
Raise amount (min 160, max 650): 200█
```

Arrow keys can increment/decrement in configurable steps.

### 13.4 Notifications

- Inline status messages appear below the table for events: "Bot_Normal raises to 200", "Guest#4821 has left the room", "You are now the host".
- Turn notifications include a bell sound (optional, `--sound` flag).

---

## 14. Bot AI Design

### 14.1 Architecture

Bot logic is split across two layers:

- **`packages/shared/src/bot/`** — Pure strategy functions. Take a `BotGameState` and return a `BotDecision`. Zero side effects, fully unit-testable without a server.
- **`packages/server/src/bots/`** — Bot execution runtime. Manages the bot's Socket.io identity, listens for `game:turnStart` events targeting the bot's `playerId`, calls the shared strategy function, applies the randomised delay, then emits `game:action` back to the server on the bot's behalf. Bots run as lightweight in-process coroutines (not separate processes).

```typescript
interface BotDecision {
  action: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE' | 'ALL_IN';
  amount?: number;
}

type BotStrategy = (state: BotGameState) => BotDecision;
```

### 14.2 Normal Difficulty

The Normal bot uses a rule-based strategy with randomised deviations to avoid being predictable:

**Pre-Flop**

- Folds weak hands (low unsuited, unconnected cards) roughly 40% of the time.
- Calls with medium hands (pairs, suited connectors, high cards).
- Raises occasionally (20%) with strong hands (high pairs, AK, AQ).

**Post-Flop**

- Evaluates current hand rank and outs (draws).
- Bluffs ~10% of the time on the flop when it checks.
- Calls bets under 30% of pot size with any pair or better.
- Folds to large bets with weak holdings.

**General**

- Never angles (intentional timing tells, etc.).
- Respects pot odds loosely.
- Randomised action delay: 0.5–3 seconds to simulate thinking.

### 14.3 Extensibility for Future Difficulties

The strategy system is designed for extension. Adding a new difficulty requires only implementing a new `BotStrategy` function and registering it:

```typescript
// packages/shared/src/bot/strategies/index.ts
export const botStrategies: Record<BotDifficulty, BotStrategy> = {
  NORMAL: normalStrategy,
  // HARD: hardStrategy,     // Future: add equity calculations
  // EXPERT: expertStrategy, // Future: add GTO approximation
};
```

**Hard (planned):** Equity-based decisions using Monte Carlo simulation of possible opponent hands. Better pot-odds calculations and continuation betting.

**Expert (planned):** GTO-approximation using pre-computed range tables. Balanced bluff-to-value ratios, position-aware aggression.

---

## 15. Error Handling & Edge Cases

### 15.1 All Players Fold

If all players fold to one player, that player wins the pot immediately without showdown. Hole cards are not revealed.

### 15.2 Only One Player Remains

If all other players leave or are eliminated mid-hand, the remaining player wins the pot. The game returns to waiting state with only that player.

### 15.3 Exactly Two Players (Heads-Up)

Heads-up rules apply automatically:

- Dealer posts small blind; other player posts big blind.
- Dealer acts first pre-flop, second on all subsequent streets.

### 15.4 Simultaneous All-Ins

Multiple players going all-in in the same round each get their own side pot at their stack level. The server resolves pots from smallest to largest at showdown.

### 15.5 Deck Exhaustion

Standard 52-card deck. With up to 9 players, hole cards (18) + community cards (5) = 23 cards maximum. No deck exhaustion is possible. A fresh shuffle occurs at the start of each hand.

### 15.6 Invalid Actions

If a client sends an invalid action (e.g. raise below minimum, action out of turn), the server rejects it with an error event and takes no game-state change. The client should prevent this via UI guards, but the server is authoritative.

### 15.7 Host Adds Bot When Full

Adding a bot when the room is at `maxPlayers` is rejected with an error. The UI should disable the "Add Bot" button in this state.

### 15.8 Hand History

A full hand log is recorded server-side per hand, including all actions, cards dealt (revealed at showdown), and pot results. Players and observers can request the last N hands for the current session via a `game:handHistory` socket event. This is displayed as a scrollable log in both the web and terminal client.

### 15.9 Player Goes All-In Posting a Blind

A player whose remaining chips are less than or equal to the required blind posts what they have and is immediately placed in `ALL_IN` state before any cards are dealt. The blind is still considered posted; the game proceeds normally. A side pot is created for all remaining chips that other players bet above the all-in player's contribution. This is handled in the Pre-Deal phase, not during the betting round.

---

## 16. Security

### 16.1 Socket.io Authentication

Every Socket.io connection must present a valid JWT in the handshake auth header. The server validates the token on `connection` and disconnects unauthenticated sockets immediately. Guest tokens are issued identically to signed-in user tokens and are validated the same way.

```typescript
// Client handshake
const socket = io(SERVER_URL, {
  auth: { token: accessToken }
});
```

### 16.2 Action Authorisation

The server validates every `game:action` event against the following rules before processing:

- The emitting socket's `playerId` matches the current `activePlayerSeatIndex` player.
- The action type is legal given the current game state (e.g. no `CHECK` when there is an outstanding bet; no `RAISE` when `canRaise` was `false` in `game:turnStart` due to a sub-minimum all-in scenario).
- The raise amount is within valid bounds (`minRaiseAmount ≤ amount ≤ playerChips`).
- The player is not in `FOLDED`, `OBSERVER`, `SITTING_OUT`, or `DISCONNECTED` state.

Any violation emits an `error` event back to the sender and is otherwise ignored — the game state does not change.

### 16.3 Preventing Impersonation

Players can only emit actions for their own `playerId`. The server derives player identity solely from the validated JWT in the socket handshake — the client never sends `playerId` in action payloads. Bot actions are emitted by the server-side bot runtime using the bot's own internal socket connection, not relayed through any human player's socket.

### 16.4 Rate Limiting

- Socket events are rate-limited to **30 events per 10 seconds** per connection. Clients exceeding this are temporarily disconnected.
- REST endpoints are rate-limited to **60 requests per minute** per IP.
- Room creation is limited to **5 rooms per user per hour** to prevent abuse.

### 16.5 Room Code Enumeration

Room codes are 6 uppercase alphanumeric characters (36^6 ≈ 2.2 billion combinations). The join endpoint rate-limits failed lookups to **10 attempts per minute per IP** to prevent brute-force enumeration.

---

## 17. Environment & Deployment

### 17.1 Environment Variables

All packages discover configuration via environment variables. A `.env.example` file is committed to the repo root; actual `.env` files are gitignored.

**Server (`packages/server/.env`)**

```
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/poker
REDIS_URL=redis://localhost:6379
JWT_SECRET=<secret>
JWT_REFRESH_SECRET=<secret>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
CORS_ORIGINS=http://localhost:5173,http://localhost:3002
```

**Web client (`packages/web/.env`)**

```
VITE_SERVER_URL=http://localhost:3001
```

**Terminal client (`packages/terminal/.env` or `~/.poker/config.json`)**

```
POKER_SERVER_URL=http://localhost:3001
```

The terminal client checks, in order: `POKER_SERVER_URL` env var → `serverUrl` field in `~/.poker/config.json` → falls back to `http://localhost:3001`.

### 17.2 Local Development

```bash
# Install dependencies
pnpm install

# Start all packages in dev mode (Turborepo)
pnpm dev

# Or individually:
pnpm --filter server dev     # API + WS server on :3001
pnpm --filter web dev        # Vite dev server on :5173
pnpm --filter terminal dev   # Ink terminal client
```

### 17.3 Database Setup

```bash
# Run migrations
pnpm --filter server db:migrate

# Seed with test data (optional)
pnpm --filter server db:seed
```

### 17.4 Production Deployment

- Server: Node.js process behind a reverse proxy (nginx/Caddy). Sticky sessions required for Socket.io if running multiple server instances (or use Socket.io Redis adapter).
- Web: Static build deployed to a CDN (`pnpm --filter web build`).
- Terminal: Published to npm as `poker-cli` or distributed as a standalone binary via `pkg` or `bun build --compile`.
- Database: Managed PostgreSQL (e.g. Supabase, Railway, RDS).
- Redis: Managed Redis (e.g. Upstash, ElastiCache).

---

## 18. Testing Strategy

### 18.1 Unit Tests (`packages/shared`)

The shared package contains all pure game logic and is the highest-priority test target. Tests cover:

- Hand evaluator: all 10 hand rankings, tie-breaking, kicker logic.
- Side pot calculator: single all-in, multiple simultaneous all-ins, split pots.
- Deck: shuffle distribution (statistical), deal correctness.
- Bot strategies: given a `BotGameState`, assert expected action distribution over N runs.
- Betting rules: big blind option, re-raise eligibility after sub-minimum all-in.

**Framework:** Vitest (fast, TypeScript-native).

### 18.2 Integration Tests (`packages/server`)

Server integration tests spin up a real Fastify + Socket.io instance against a test database (separate schema or Docker container).

- Room lifecycle: create → join → ready → start → hand completion → next hand.
- Auth flows: Google OAuth mock, guest session.
- Action validation: all invalid action scenarios from §16.2.
- Reconnection: disconnect mid-hand, reconnect within grace period, reconnect after grace period.
- Host migration: host leaves mid-hand, mid-wait.
- Side pot distribution: multi-player all-in scenario with verified chip outcomes.

**Framework:** Vitest + `socket.io-client` for socket testing.

### 18.3 End-to-End Tests

E2E tests drive the web client in a real browser against a running server.

- Full hand from join to result in 2-player game (human vs bot).
- Guest join via invite code.
- Host kicks a player.
- Buy-in flow after going broke.

**Framework:** Playwright.

### 18.4 Terminal Client Tests

- CLI argument parsing.
- Screen rendering: snapshot tests of Ink component output.
- Key binding correctness.

**Framework:** Vitest + Ink's `@testing-library/ink`.

---

## 19. Open Questions / Future Work

| Topic | Notes |
|---|---|
| **Persistent hand history storage** | Currently session-only. Storing to DB enables replay features and hand replays. |
| **Hard / Expert bots** | Architecture is ready; strategy implementations pending. |
| **Spectator links** | Non-playing observers joining via a separate read-only URL without occupying a seat. |
| **Room password** | Optional password on room creation for private games. |
| **Tournament mode** | Blind levels that increase over time; eliminations; final table logic. |
| **Mobile-native** | React Native or PWA packaging for iOS/Android. |
| **Sound / Animations** | Web client action sounds, card-flip animations, chip-slide animations. |
| **Internationalization** | UI strings extracted for i18n support. |
| **Admin panel** | Server-side dashboard to view active rooms, force-close abusive rooms, ban users. |
| **Configurable turn timer** | Allow hosts to set turn timer duration (e.g. 15s / 30s / 60s) as a room config option. |
| **Player avatars** | Custom avatar upload for authenticated users; shown on table seats. |
