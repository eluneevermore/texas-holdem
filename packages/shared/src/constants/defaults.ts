/** Tunable constants — never inline magic numbers. */

export const TURN_TIMER_SECONDS = 30;
export const RECONNECT_GRACE_SECONDS = 60;
export const BETWEEN_HAND_PAUSE_SECONDS = 5;
export const AUTO_START_COUNTDOWN_SECONDS = 3;
export const AFK_TIMEOUT_THRESHOLD = 3;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS_LIMIT = 9;

export const BOT_DELAY_MIN_MS = 500;
export const BOT_DELAY_MAX_MS = 3000;

export const ROOM_CODE_LENGTH = 6;

export const BUY_IN_CAP_MULTIPLIER = 3;

export const SOCKET_RATE_LIMIT_EVENTS = 30;
export const SOCKET_RATE_LIMIT_WINDOW_MS = 10_000;
export const REST_RATE_LIMIT_PER_MINUTE = 60;
export const ROOM_CREATION_LIMIT_PER_HOUR = 5;
export const JOIN_ATTEMPT_LIMIT_PER_MINUTE = 10;
