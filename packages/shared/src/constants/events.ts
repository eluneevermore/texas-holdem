/** Socket.io event name constants — single source of truth for all packages. */

export const ROOM_EVENTS = {
  JOINED: 'room:joined',
  PLAYER_JOINED: 'room:playerJoined',
  PLAYER_LEFT: 'room:playerLeft',
  KICKED: 'room:kicked',
  CLOSED: 'room:closed',
  READY_TOGGLE: 'room:readyToggle',
  READY_CHANGED: 'room:readyChanged',
  CONFIG_UPDATE: 'room:configUpdate',
  CONFIG_CHANGED: 'room:configChanged',
  ADD_BOT: 'room:addBot',
  BOT_ADDED: 'room:botAdded',
  KICK_PLAYER: 'room:kickPlayer',
  TRANSFER_HOST: 'room:transferHost',
  HOST_CHANGED: 'room:hostChanged',
  COUNTDOWN: 'room:countdown',
} as const;

export const GAME_EVENTS = {
  START: 'game:start',
  DEAL_HOLE_CARDS: 'game:dealHoleCards',
  PHASE_CHANGE: 'game:phaseChange',
  TURN_START: 'game:turnStart',
  TIMER_TICK: 'game:timerTick',
  ACTION: 'game:action',
  ACTION_BROADCAST: 'game:actionBroadcast',
  POT_UPDATE: 'game:potUpdate',
  SHOWDOWN: 'game:showdown',
  HAND_RESULT: 'game:handResult',
  HAND_HISTORY: 'game:handHistory',
  HAND_HISTORY_RESULT: 'game:handHistoryResult',
  PLAYER_BROKE: 'game:playerBroke',
  PLAYER_AFK: 'game:playerAFK',
  BUY_IN: 'game:buyIn',
  BUY_IN_CONFIRMED: 'game:buyInConfirmed',
} as const;

export const ERROR_EVENT = 'error' as const;
