# Agent Coding Instructions — Texas Hold'em Poker

> This document tells you **how to work** on this codebase. Read it fully before writing any code.
> The **what to build** is in `SPEC.md`. When this document and the spec conflict, ask for clarification — do not guess.

---

## Table of Contents

1. [The Golden Rules](#1-the-golden-rules)
2. [Before You Write Any Code](#2-before-you-write-any-code)
3. [Project Structure & Navigation](#3-project-structure--navigation)
4. [Implementation Order](#4-implementation-order)
5. [Code Style & Standards](#5-code-style--standards)
6. [TypeScript Rules](#6-typescript-rules)
7. [Package-Specific Guidelines](#7-package-specific-guidelines)
8. [Testing Requirements](#8-testing-requirements)
9. [The Review Checklist](#9-the-review-checklist)
10. [Git & Commits](#10-git--commits)
11. [What To Do When Stuck](#11-what-to-do-when-stuck)
12. [What Never To Do](#12-what-never-to-do)

---

## 1. The Golden Rules

These apply to every single task, no exceptions:

**Rule 1 — Read before you write.**
Before touching any file, read the files you are about to change. Before implementing a feature, re-read the relevant spec sections. Code written without reading context is almost always wrong.

**Rule 2 — One thing at a time.**
Each task you are given has a clear scope. Do not expand that scope. If you notice something broken outside your current task, note it in a `// TODO:` comment and continue. Do not fix it silently — silent scope creep breaks reviews.

**Rule 3 — The spec is the source of truth.**
If the spec says a function should behave a certain way, implement it that way even if you think there is a smarter approach. Improvements belong in a spec update, not in silent implementation divergence.

**Rule 4 — No code without tests.**
Every function in `packages/shared`, every API endpoint, and every socket handler must have a test written before or alongside the implementation — not after. If a task does not include test scope, ask for it to be defined before starting.

**Rule 5 — Self-review before declaring done.**
Before marking any task complete, run the [Review Checklist](#9-the-review-checklist) yourself. Do not rely on a human reviewer to catch what you already know is missing.

---

## 2. Before You Write Any Code

Run through this checklist at the start of every task:

**Understand the task**

- [ ] Read the task description fully.
- [ ] Identify which spec sections are relevant. Re-read them.
- [ ] Identify which existing files will be modified (not just created).
- [ ] Identify downstream effects: if you change a type in `shared/`, which packages break?

**Understand the existing code**

- [ ] Read every file you plan to modify.
- [ ] Read the files that import the modules you plan to modify.
- [ ] Check if a similar pattern already exists in the codebase that you should follow.

**Plan before coding**

- [ ] Write a brief plan (in a code comment or a scratch note) of what you will create/modify and in what order.
- [ ] Identify the test cases you will write before you write the implementation.
- [ ] If the task involves a new data type, write the TypeScript interface first and make sure it compiles cleanly before writing logic that uses it.

**Confirm the scope**

- [ ] Confirm you know exactly where the task ends. If unsure, stop and ask.

---

## 3. Project Structure & Navigation

```
poker/
├── packages/
│   ├── shared/                  # ALWAYS start here for new domain concepts
│   │   ├── src/
│   │   │   ├── types/           # All TypeScript interfaces and enums
│   │   │   ├── game/            # Pure game logic (hand eval, deck, pots, betting)
│   │   │   ├── bot/
│   │   │   │   ├── strategies/  # BotStrategy implementations
│   │   │   │   └── types.ts     # BotGameState, BotDecision
│   │   │   ├── constants/       # Blind defaults, config limits, event name enums
│   │   │   └── index.ts         # Public barrel export
│   │   └── __tests__/
│   │
│   ├── server/
│   │   ├── src/
│   │   │   ├── routes/          # Fastify REST route handlers
│   │   │   ├── socket/          # Socket.io event handlers (one file per domain)
│   │   │   ├── game/            # Game state machine, hand orchestration
│   │   │   ├── bots/            # Bot execution runtime (not strategy logic)
│   │   │   ├── auth/            # JWT, OAuth, guest session
│   │   │   ├── db/              # Prisma client, repository functions
│   │   │   └── middleware/      # Auth middleware, rate limiting
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── __tests__/
│   │
│   ├── web/
│   │   ├── src/
│   │   │   ├── pages/           # Route-level components (Lobby, RoomPage, Profile)
│   │   │   ├── components/      # Reusable UI components
│   │   │   │   ├── table/       # Game table, seats, cards, pot display
│   │   │   │   ├── waiting/     # Waiting room components
│   │   │   │   └── common/      # Buttons, modals, connection banner
│   │   │   ├── stores/          # Zustand stores
│   │   │   ├── hooks/           # Custom React hooks
│   │   │   ├── socket/          # Socket.io client setup and event bindings
│   │   │   └── lib/             # Utility functions, formatters
│   │   └── src/__tests__/
│   │
│   └── terminal/
│       ├── src/
│       │   ├── cli/             # CLI entry, argument parsing
│       │   ├── screens/         # Ink screen components (Lobby, WaitingRoom, GameTable, Summary)
│       │   ├── components/      # Reusable Ink components
│       │   ├── socket/          # Socket.io client for terminal
│       │   └── store/           # Terminal-side state (plain objects, not Zustand)
│       └── __tests__/
│
├── SPEC.md                      # The source of truth — read this
├── INSTRUCTION.md               # This file
├── package.json
└── turbo.json
```

### Key Navigation Rules

- **New domain concept?** → Define the type in `packages/shared/src/types/` first.
- **New game logic?** → Implement it as a pure function in `packages/shared/src/game/`, test it in isolation.
- **New socket event?** → Add the event name to `packages/shared/src/constants/events.ts`, then add the handler in `packages/server/src/socket/`.
- **New UI behaviour?** → Check if a hook or utility already exists before writing new code.
- **Touching the database?** → All DB access goes through repository functions in `packages/server/src/db/`. Never write raw Prisma calls in route or socket handlers.

---

## 4. Implementation Order

Follow this order within the project. Do not skip ahead — later packages depend on earlier ones being correct.

### Phase 1 — Foundation (`packages/shared`)

Build this first and fully before touching any other package. Everything else imports from here.

1. All TypeScript interfaces and enums (`types/`)
2. Constants and event name enums (`constants/`)
3. Deck: shuffle, deal
4. Hand evaluator: rank all 5-card hands, compare, determine kicker
5. Pot calculator: single pot, side pots, odd-chip split
6. Betting rules: valid action checker, minimum raise calculator, re-raise eligibility, big blind option
7. Bot `BotGameState` type and Normal strategy
8. Barrel export (`index.ts`)

**Do not proceed to Phase 2 until all shared unit tests pass.**

### Phase 2 — Server (`packages/server`)

1. Database schema and Prisma migrations
2. Repository layer (User, Room, GameHand CRUD)
3. Auth: Google OAuth routes, guest session, JWT issue/verify/refresh
4. Auth middleware and socket JWT validation
5. REST routes: create room, join room, get room, update config, hand history
6. Socket: connection lifecycle, room join, room events
7. Game state machine: hand phases, turn management, timer
8. Socket: gameplay events (deal, action, phase change, showdown, result)
9. Bot execution runtime
10. Rate limiting middleware

**Do not proceed to Phase 3 until server integration tests pass.**

### Phase 3 — Web Client (`packages/web`)

1. Socket store and connection setup
2. Auth store and login flow
3. Lobby page
4. Room store and waiting room
5. Game store
6. Game table components (seats, cards, pot, action panel)
7. Connection status indicator
8. Observer view and buy-in flow
9. Hand result overlay and between-hand summary

### Phase 4 — Terminal Client (`packages/terminal`)

1. CLI entry and argument parsing
2. Socket connection (reuse pattern from web socket module)
3. Lobby screen
4. Waiting room screen
5. Game table screen (with dealer/blind roles)
6. Between-hand summary screen
7. Raise input flow
8. Notification log

---

## 5. Code Style & Standards

### General

- **Explicit over implicit.** Prefer named exports over default exports (except React components and Ink screens, which conventionally use default exports).
- **Small, focused functions.** A function that does more than one thing should be two functions. The hand evaluator, the pot calculator, and the action validator are all separate functions — not one big `processHand()`.
- **No magic numbers.** All tunable constants (timer durations, rate limits, default config values) go in `packages/shared/src/constants/`. Never inline them.
- **Errors are values in game logic.** Pure game functions in `shared/` must never throw. Return a discriminated union: `{ ok: true, value: X } | { ok: false, error: string }`. Throwing is reserved for truly unrecoverable programmer errors (invariant violations).
- **Side effects belong in the server.** `packages/shared` must have zero side effects. No timers, no network calls, no randomness beyond what is explicitly passed in (i.e. pass a `shuffle` function as a parameter rather than calling `Math.random()` directly — this makes shuffles testable).

### Naming

| Thing | Convention | Example |
|---|---|---|
| Types / Interfaces | PascalCase | `RoomPlayer`, `BotDecision` |
| Enums | PascalCase (name), SCREAMING_SNAKE (members) | `PlayerState.SITTING_OUT` |
| Functions | camelCase, verb-first | `evaluateHand()`, `calculateSidePots()` |
| React components | PascalCase | `GameTable`, `ActionPanel` |
| Zustand stores | camelCase hook | `useGameStore` |
| Socket event names | `domain:eventName` (kebab noun:camelVerb) | `game:turnStart`, `room:playerLeft` |
| Event name constants | SCREAMING_SNAKE | `GAME_EVENTS.TURN_START` |
| Test files | Mirror source path, `.test.ts` suffix | `src/game/pot.test.ts` |
| Database tables | snake_case | `room_player`, `game_hand` |

### File Length

If a file exceeds 300 lines, it is almost certainly doing too much. Split it. The only exception is generated files (Prisma schema output, etc.).

### Comments

- Write comments to explain **why**, not **what**. The code says what; the comment says why.
- Every exported function in `packages/shared` must have a JSDoc comment describing its purpose, parameters, and return value.
- Mark all known limitations or edge cases with `// EDGE CASE:` comments inline.
- Mark incomplete work with `// TODO(scope): description`. Do not use `// TODO` without a scope label.

---

## 6. TypeScript Rules

- **`strict: true`** is non-negotiable. All packages have it enabled. Do not disable it or any sub-option.
- **No `any`.** If you are tempted to use `any`, use `unknown` and narrow it properly. If you find `any` in existing code, fix it as part of your task and note it in the commit.
- **No non-null assertions (`!`)** unless you have a comment explaining why the value is guaranteed to be non-null at that point. Prefer narrowing with `if` or `??`.
- **Discriminated unions over optional fields.** Model state explicitly:

```typescript
// BAD — ambiguous, requires runtime checks everywhere
interface Pot {
  amount: number;
  winnerId?: string;       // Is this set? When? Why might it be absent?
}

// GOOD — state is unambiguous
type Pot =
  | { status: 'open'; amount: number; eligiblePlayerIds: string[] }
  | { status: 'awarded'; amount: number; winnerId: string; handRank?: string };
```

- **Enums for player/room/hand states.** Use string enums so values are readable in logs and the database:

```typescript
enum PlayerState {
  WAITING = 'WAITING',
  SITTING_OUT = 'SITTING_OUT',
  ACTIVE = 'ACTIVE',
  // ...
}
```

- **Shared types are the contract.** If you need to change a type in `packages/shared`, update all usages in all packages in the same commit. Never leave a type change that compiles in `shared` but breaks a dependent package.

---

## 7. Package-Specific Guidelines

### `packages/shared` — Game Logic

**Purity is everything.** Every function here must be a pure function: given the same inputs, always returns the same output. No side effects, no global state, no I/O.

**Shuffle must be injectable:**

```typescript
// CORRECT — shuffle function is a parameter, making it testable
function dealHoleCards(deck: Card[], numPlayers: number, shuffleFn: (cards: Card[]) => Card[]): Card[][] {
  const shuffled = shuffleFn([...deck]);
  // ...
}

// WRONG — not testable, not deterministic
function dealHoleCards(deck: Card[], numPlayers: number): Card[][] {
  const shuffled = [...deck].sort(() => Math.random() - 0.5);
  // ...
}
```

**Hand evaluator must handle all edge cases:** wheel straight (A-2-3-4-5), Broadway (A-K-Q-J-10), identical hands with kicker tiebreakers, and split pots.

**Pot calculator edge cases:** multiple all-ins at different stack sizes, a player eligible for the main pot but not a side pot, odd-chip distribution.

### `packages/server` — API & Socket

**Repository pattern is mandatory.** All Prisma access is behind repository functions. Route and socket handlers call repository functions; they never write Prisma queries directly.

```typescript
// CORRECT
import { findRoomByCode, updateRoomState } from '../db/roomRepository';

// WRONG
import { prisma } from '../db/client';
const room = await prisma.room.findUnique({ where: { roomCode } }); // in a socket handler
```

**Game state machine is the authority.** The `packages/server/src/game/` state machine holds the current hand in memory (Redis-backed for crash recovery). Socket handlers must only call state machine methods — they must never mutate game state directly.

**All socket handlers must:**
1. Validate the JWT identity of the emitting socket first.
2. Validate the action is legal (call the appropriate validator from `shared/`).
3. Mutate state through the state machine.
4. Broadcast results to the room.
5. Persist changes to the DB asynchronously (do not `await` DB writes that would block the game loop — use fire-and-forget with error logging).

**Timer management:** The turn timer runs server-side. The server emits `game:timerTick` every second and fires the auto-action when it expires. Never trust a client to manage turn timing.

### `packages/web` — React Client

**Zustand stores own all server-derived state.** React component state (`useState`) is only for local ephemeral UI state (e.g. "is this dropdown open?"). Anything that comes from the socket or the API lives in a Zustand store.

**Socket events are bound in one place.** All `socket.on(...)` bindings for a domain live in a single file (e.g. `src/socket/gameEvents.ts`). They dispatch to stores. Components never call `socket.on` directly.

**Optimistic updates are forbidden for game actions.** A player clicks "Fold" → the UI sends the action → the UI waits for `game:actionBroadcast` from the server before updating the display. Do not update the UI before server confirmation. This prevents divergence between clients.

**Component structure:**

```
pages/
  RoomPage.tsx           ← decides which scene to render (waiting vs playing)
components/
  table/
    GameTable.tsx         ← layout shell
    PlayerSeat.tsx        ← one seat: avatar, chips, bet, timer, state indicators
    CommunityCards.tsx    ← five card slots + pot display
    ActionPanel.tsx       ← fold/check/call/raise controls
    HandResultOverlay.tsx ← winner banner, chip animations
  waiting/
    WaitingRoom.tsx
    PlayerList.tsx
    ConfigPanel.tsx
  common/
    ConnectionBanner.tsx  ← RECONNECTING / FAILED states
    BuyInButton.tsx
```

Each component file: one component, co-located `.test.tsx` file, no inline styles (use CSS modules or Tailwind utility classes).

### `packages/terminal` — Ink Client

**Reuse shared socket patterns.** The terminal socket module should mirror the web's socket module structure so both are maintained together.

**Ink rendering:** Every screen is a full-screen Ink component. Use `useInput` from Ink for all keyboard bindings — do not use `process.stdin` directly.

**Key bindings must be documented** in the component's JSDoc and must not conflict across screens. Maintain a key binding map per screen.

**Terminal width awareness:** Check `process.stdout.columns` and adapt layouts for narrow terminals (< 80 cols) by abbreviating columns or hiding non-essential fields. Never let content overflow and wrap — it breaks the TUI layout.

---

## 8. Testing Requirements

### Coverage Targets

| Package | Minimum Coverage | Priority |
|---|---|---|
| `shared` — game logic | 95% line coverage | Critical |
| `server` — socket handlers | 85% line coverage | High |
| `server` — REST routes | 80% line coverage | High |
| `web` — stores and hooks | 75% line coverage | Medium |
| `terminal` — screens | Snapshot + key binding tests | Medium |

These are minimums. Aim higher on critical paths (hand evaluator, pot calculator, side pot logic).

### What to Test

**Unit tests (`shared/`):**

Every exported function must have:
- A test for the happy path with representative input.
- A test for each documented edge case (see §15 of the spec and `// EDGE CASE:` comments).
- A test for invalid input (what does the function do when called incorrectly?).

Example test structure for the hand evaluator:

```typescript
describe('evaluateHand', () => {
  describe('hand rankings', () => {
    it('identifies a royal flush', () => { ... });
    it('identifies a straight flush', () => { ... });
    // one test per rank
  });

  describe('tiebreaking', () => {
    it('breaks a tie between two flushes by high card', () => { ... });
    it('breaks a tie between two pairs by kicker', () => { ... });
    it('returns a split when hands are exactly equal', () => { ... });
  });

  describe('edge cases', () => {
    it('handles the wheel straight (A-2-3-4-5)', () => { ... });
    it('handles ace-high Broadway straight', () => { ... });
  });
});
```

**Integration tests (`server/`):**

Each socket event handler must have:
- A test for the authorised, valid action path — game state updates correctly.
- A test for an unauthorised action — the error event is emitted, state does not change.
- A test for an invalid action (e.g. fold when not your turn) — same as above.
- A test for the broadcast — other connected clients receive the correct event.

Use a real Socket.io server and multiple `socket.io-client` instances in integration tests. Do not mock Socket.io.

**Snapshot tests (`web/`, `terminal/`):**

Snapshot tests are used for UI components that are well-defined and unlikely to change frequently. Update snapshots intentionally with `vitest --update-snapshots` — do not blindly accept snapshot diffs.

### Test File Conventions

```typescript
// Each test file follows this structure:

describe('<ModuleName>', () => {
  // 1. Setup — shared fixtures and mocks
  beforeEach(() => { ... });
  afterEach(() => { ... });

  // 2. Group by function name
  describe('<functionName>', () => {

    // 3. Group by scenario
    describe('when <condition>', () => {
      it('<expected behaviour>', () => { ... });
    });
  });
});
```

- Test descriptions must read as complete sentences: `it('returns an error when the raise amount is below the minimum', ...)`.
- No `describe.only` or `it.only` in committed code.
- No `describe.skip` or `it.skip` without a `// TODO:` comment explaining why and what is needed to unskip.
- Test data factories go in `__tests__/factories/` — never inline large fixture objects in test files.

### Running Tests

```bash
# All packages
pnpm test

# Single package
pnpm --filter shared test
pnpm --filter server test
pnpm --filter web test

# Watch mode during development
pnpm --filter shared test --watch

# Coverage report
pnpm --filter shared test --coverage
```

Tests must pass in CI before any code is considered done. If a test is failing and you cannot fix it within the scope of your task, do not delete or skip it — escalate.

---

## 9. The Review Checklist

Run this yourself before declaring a task complete. This is not optional.

### Correctness

- [ ] Does the implementation match the spec exactly? Re-read the relevant spec sections with fresh eyes.
- [ ] Are all edge cases from §15 of the spec handled (or explicitly deferred with a `// TODO`)?
- [ ] Does the game state remain consistent after every possible action (including invalid ones)?
- [ ] Are all error paths handled? Does every function that can fail communicate that failure to the caller?

### Types

- [ ] Does `tsc --noEmit` pass with zero errors across all packages?
- [ ] Are there any `any` types? If yes, fix them.
- [ ] Are there any non-null assertions (`!`) without an explanatory comment? If yes, fix them.
- [ ] Have shared type changes been propagated to all dependent packages?

### Tests

- [ ] Do all tests pass (`pnpm test`)?
- [ ] Is coverage at or above the target for the packages you touched?
- [ ] Are all new functions in `packages/shared` tested?
- [ ] Are all new socket handlers tested with both valid and invalid input?
- [ ] Are there tests for the new edge cases introduced by this task?

### Security

- [ ] Are all new socket handlers validating JWT identity before acting?
- [ ] Are all new socket handlers validating that the action belongs to the correct player?
- [ ] Are new REST endpoints protected by auth middleware where required?
- [ ] Is any user-supplied input sanitised or validated before being used in a DB query?

### Performance

- [ ] Are there any synchronous operations in socket handlers that could block the event loop? (DB calls must be `await`ed but not block the game loop for other rooms.)
- [ ] Are there any N+1 query patterns in new repository functions?

### Code Quality

- [ ] Are there any functions longer than 40 lines? If so, consider splitting.
- [ ] Are there any files longer than 300 lines? If so, split by responsibility.
- [ ] Are all exported functions in `packages/shared` documented with JSDoc?
- [ ] Have you removed all debug `console.log` statements?
- [ ] Are all `// TODO:` comments scoped and described?

### Consistency

- [ ] Do new event names follow the `domain:eventName` convention and are they added to `constants/events.ts`?
- [ ] Do new components follow the established file and folder structure?
- [ ] Are new database columns in snake_case? Are new TypeScript fields in camelCase?
- [ ] Does the terminal client behaviour match the web client behaviour for the same feature?

---

## 10. Git & Commits

### Branch Naming

```
feature/<short-description>     # New functionality
fix/<short-description>         # Bug fix
refactor/<short-description>    # No behaviour change
test/<short-description>        # Tests only
```

### Commit Message Format

Use conventional commits format:

```
<type>(<scope>): <short description>

[Optional body: what and why, not how]

[Optional footer: breaking changes, issue refs]
```

Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`

Scopes: `shared`, `server`, `web`, `terminal`, `all`

Examples:

```
feat(shared): add side pot calculator with multi-all-in support

Implements calculateSidePots() per spec §6.3. Handles multiple
simultaneous all-ins at different stack sizes. Pots are returned
ordered smallest to largest as required for showdown resolution.

feat(server): add game:timerTick broadcast every second during turns

fix(shared): correct wheel straight (A-2-3-4-5) detection in hand evaluator

Previously, aces were only treated as high cards, causing wheel
straights to be misidentified as ace-high no-pairs. Ace is now
evaluated as both rank 1 and rank 14 during straight detection.

test(server): add integration tests for sub-minimum all-in re-raise rule
```

### Commit Discipline

- **One logical change per commit.** A commit that adds a feature, refactors an unrelated module, and fixes a typo is three commits.
- **Tests in the same commit as the code they test.** Never commit implementation without tests, and never commit tests without the implementation they test (unless writing tests for pre-existing untested code).
- **Never commit failing tests.** If `pnpm test` fails, do not commit.
- **Never force-push to `main` or `develop`.**

---

## 11. What To Do When Stuck

If you are blocked on a task, work through this process in order:

1. **Re-read the spec.** The answer is usually there. Read the relevant section and the adjacent sections — context often resolves ambiguity.

2. **Check the existing code.** Has a similar problem already been solved somewhere in the codebase? Follow that pattern.

3. **Write a failing test first.** Sometimes the act of writing the test clarifies what the implementation needs to do.

4. **State the ambiguity explicitly.** If the spec is genuinely silent on a case, write a comment documenting the two possible interpretations and the one you chose, along with your reasoning. Then implement your choice. Example:

```typescript
// SPEC AMBIGUITY: §6.3 does not specify what happens when two players
// go all-in for identical amounts in the same round. We treat this as
// a single main pot with both players eligible, rather than two
// separate pots of the same size. This matches standard casino rules.
```

5. **Escalate if it blocks the path.** If a spec ambiguity blocks you from completing the task (not just an edge case you can defer), stop and surface it rather than guessing.

---

## 12. What Never To Do

These are hard stops. If you are about to do any of these, stop and reconsider.

- **Never write raw Prisma queries outside of `db/` repository files.**
- **Never put game logic in socket handlers.** Game logic belongs in `packages/shared` or `packages/server/src/game/`. Socket handlers wire events to the game engine — they do not contain rules.
- **Never import `packages/server` or `packages/web` from `packages/shared`.** The dependency arrow is one-way: everything imports `shared`, `shared` imports nothing.
- **Never trust the client.** Every action emitted by a client is re-validated server-side. The client's UI state is a display layer only.
- **Never expose hole cards to the wrong socket.** `game:dealHoleCards` is always a targeted emit (`socket.emit`) to the individual player, never a broadcast (`io.to(room).emit`). Audit every card emission.
- **Never send a player another player's hole cards** in any payload, at any time before showdown (and at showdown, only for players who have not mucked).
- **Never delete or skip a failing test** without a comment explaining why it is skipped and what is needed to restore it. A failing test is a signal, not a nuisance.
- **Never use `setTimeout` or `setInterval` in `packages/shared`.** All timing is managed by the server.
- **Never hardcode a `roomCode`, `userId`, or any environment-specific value** in application code. Use constants or environment variables.
- **Never commit `.env` files** or files containing secrets, tokens, or credentials.
