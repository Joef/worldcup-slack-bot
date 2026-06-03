/**
 * FIFA API
 */

export const BASE = 'https://api.fifa.com/api/v3/';

export enum ENDPOINTS {
  MATCHES = 'calendar/matches',
  TIMELINES = 'timelines',
  SQUAD = 'teams/43911/squad',
  PLAYER = 'players'
}

// 2026 Women's World Cup
export enum ID {
  COMPETITION = 17,
  SEASON = 285023,
}

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
  PERIOD_START = 7,
  PERIOD_END = 8,
  END_OF_GAME = 26,
  OWN_GOAL = 34,
  FREE_KICK_GOAL = 39,
  PENALTY_GOAL = 41,
  PENALTY_SAVED = 60,
  PENALTY_CROSSBAR = 46,
  PENALTY_MISSED = 65,
  FOUL_PENALTY = 72,
}

export enum PERIOD {
  FIRST_HALF = 3,
  SECOND_HALF = 5,
  FIRST_ET = 7,
  SECOND_ET = 9,
  PENALTY = 11,
}
