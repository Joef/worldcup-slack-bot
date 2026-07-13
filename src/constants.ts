/**
 * FIFA API
 */
export enum MATCH {
  FINISHED = 0,
  NOT_STARTED = 1,
  LIVE = 3,
  PREMATCH = 12,
}

export enum EVENT {
  GOAL = 0,
  YELLOW_CARD = 2,
  STRAIGHT_RED = 3,
  SECOND_YELLOW_CARD_RED = 4,
  // SUBSTITUTION = 5,
  PERIOD_START = 7,
  PERIOD_END = 8,
  HYDRATION_BREAK = 83,
  // HYDRATION_RESUME = 78,
  END_OF_GAME = 26,
  OWN_GOAL = 34,
  FREE_KICK_GOAL = 39,
  PENALTY_AWARDED = 6,
  PENALTY_GOAL = 41,
  PENALTY_SAVED = 60,
  PENALTY_CROSSBAR = 46,
  PENALTY_MISSED = 65,
  GOAL_DISALLOWED = 71,
  FOUL_PENALTY = 72,
  WEATHER_DELAY = 85
}

export const INTERESTING_EVENTS = Object.values(EVENT);

/**
 * VAR (Type=71) notification codes — inferred from 2026 World Cup match data.
 * Values marked "?" are unconfirmed and may be incorrect.
 */
export enum VAR_INCIDENT {
  GOAL = 1,
  GOAL_PENALTY = 2, // ?
  PENALTY = 4,
  RED_CARD = 13,
  YELLOW_CARD = 14, // mistaken identity / card reassignment
  HANDBALL_PENALTY = 16, // ?
}

export enum VAR_RESULT {
  UPHELD = 1,           // decision confirmed / goal awarded
  OVERTURNED = 2,       // decision reversed / goal disallowed
  PENALTY_AWARDED = 3,
  NO_PENALTY = 4,
  RED_CARD_GIVEN = 8,
  PENALTY_AWARDED_ALT = 10, // ? same outcome as 3 but different incident type
  CARD_REASSIGNED = 11,
}

export enum VAR_STATUS {
  FINAL = 0,
  UNDER_REVIEW = 1, // ?
}

export enum PERIOD {
  FIRST_HALF = 3,
  SECOND_HALF = 5,
  FIRST_ET = 7,
  SECOND_ET = 9,
  PENALTY = 11,
}
