import { PERIOD } from './constants';
import { DB, saveDb } from './db';
import { IconName } from './icons';
import { language, locale, TranslationKey } from './languages';
import {
  EventsResponseSchema,
  MatchesResponseSchema,
  PlayerResponseSchema,
} from './schema';
import { slack } from './slack';
import { Match, MatchEvent } from './types';

export const BASE = 'https://api.fifa.com/api/v3/';

export enum ENDPOINTS {
  MATCHES = 'calendar/matches',
  TIMELINES = 'timelines',
  SQUAD = 'teams/43911/squad',
  PLAYER = 'players',
}

// 2026 Women's World Cup
export enum ID {
  COMPETITION = 17,
  SEASON = 285023,
}

const USE_PROXY = process.env.USE_PROXY === 'true';
const PROXY = process.env.PROXY ?? '';

function buildUrl(url: string) {
  return BASE + url;
}

export async function getUrl(
  url: string,
  db: DB,
  doNotUseEtag = false,
): Promise<string | false> {
  const headers: Record<string, string> = {};

  if (!doNotUseEtag && db.etag && db.etag[url]) {
    headers['If-None-Match'] = `"${db.etag[url]}"`;
  }

  const fetchOptions: RequestInit = {
    headers,
    signal: AbortSignal.timeout(5000),
  };

  if (USE_PROXY) {
    console.warn(
      `Proxy configured (${PROXY}) but not applied — install https-proxy-agent to enable proxy support.`,
    );
  }

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (err) {
    console.error('Fetch error:', err);
    process.exit(1);
  }

  if (response.status === 304) {
    return false;
  }

  const etag = response.headers.get('ETag');
  if (etag) {
    const etagMatch = etag.match(/"([0-9]+)"/i);
    if (etagMatch) {
      db.etag[url] = etagMatch[1];
      await saveDb(db);
    }
  }

  const text = await response.text();
  if (text.trim().length === 0) {
    return false;
  }

  return text;
}

export async function getMatches(db: DB): Promise<Match[]> {
  const url = buildUrl(
    `${ENDPOINTS.MATCHES}?idCompetition=${ID.COMPETITION}&idSeason=${ID.SEASON}&count=500&language=${locale}`,
  );
  const response = await getUrl(url, db);
  if (response === false) return [];
  return MatchesResponseSchema.parse(JSON.parse(response)).results;
}

export async function getMatchEvents(
  stageId: string,
  matchId: string,
  db: DB,
): Promise<MatchEvent[]> {
  const url = buildUrl(
    `${ENDPOINTS.TIMELINES}/${ID.COMPETITION}/${ID.SEASON}/${stageId}/${matchId}?language=${locale}`,
  );
  const response = await getUrl(url, db);
  if (response === false) return [];
  return EventsResponseSchema.parse(JSON.parse(response)).events;
}

export async function getEventPlayerAlias(
  eventPlayerId: string,
  db: DB,
): Promise<string> {
  const url = buildUrl(`${ENDPOINTS.PLAYER}/${eventPlayerId}`);
  const response = PlayerResponseSchema.parse(
    JSON.parse((await getUrl(url, db, true)) as string),
  );
  return response.alias[0].description;
}

export interface Output {
  message: string;
  details?: string;
}

export function parsePeriodStart(period: number, matchInfo: string): Output {
  const t = language[locale];
  switch (period) {
    case PERIOD.FIRST_HALF:
      return {
        message: slack.m(
          'zap',
          'matchBetween',
          `${matchInfo} ${t.hasStarted}!`,
        ),
      };

    case PERIOD.SECOND_HALF:
    case PERIOD.FIRST_ET:
    case PERIOD.SECOND_ET:
    case PERIOD.PENALTY:
      return {
        message: slack.m(
          'runner',
          'matchBetween',
          `${matchInfo} ${t.hasResumed}`,
        ),
      };
    default:
      return { message: '' };
  }
}

export type EventInfo = {
  period: number;
  score?: string;
  matchTimeInfo: string;
};

export function parsePeriodEnd(
  eventInfo: EventInfo,
  penalties?: string,
): Output {
  const { period, score, matchTimeInfo } = eventInfo;
  const output: Output = { message: '', details: matchTimeInfo };

  switch (period) {
    case PERIOD.FIRST_HALF:
      output.message = slack.m('toilet', 'halfTime', score);
      break;
    case PERIOD.SECOND_HALF:
      output.message = slack.m('stopwatch', 'fullTime', score);
      break;
    case PERIOD.FIRST_ET:
      output.message = slack.m('toilet', 'endOf1stET', score);
      break;
    case PERIOD.SECOND_ET:
      output.message = slack.m('stopwatch', 'endOf2ndET', score);
      break;
    case PERIOD.PENALTY:
      output.message = slack.m(
        'stopwatch',
        'endOfPenaltyShootout',
        `${score} (${penalties})`,
      );
      break;
  }
  return output;
}

export type PlayerInfo = {
  playerId: string;
  db: DB;
  eventTeam: string;
};

export async function parsePlayerEvent(
  playerInfo: PlayerInfo,
  eventInfo: EventInfo,
  icon: IconName,
  text: TranslationKey,
  options: {
    includeExclamation?: boolean;
    includeScore?: boolean;
    includeTime?: boolean;
    meta?: string;
  } = { includeTime: true },
): Promise<Output> {
  const { playerId, db, eventTeam } = playerInfo;
  const { score, matchTimeInfo } = eventInfo;
  const eventPlayerAlias = await getEventPlayerAlias(playerId, db);
  return {
    message: slack.m(
      icon,
      text,
      `${eventTeam}${options?.includeExclamation ? '!!!' : ''}`,
    ),
    details: `${eventPlayerAlias} ${options.includeTime ? `(${matchTimeInfo})` : ''} ${options.includeScore ? score : ''} ${options.meta}`,
  };
}
