
import { ID, MATCH, EVENT, PERIOD, ENDPOINTS, BASE } from "./constants";
import { DB, loadDb, MatchData, saveDb } from "./db";
import { LOCALE, language } from "./languages";
import { Slack } from "./slack";
import { EventsResponseSchema, MatchesResponseSchema, PlayerResponseSchema } from "./schema";
import { Match, MatchEvent } from "./types";

const USE_PROXY = process.env.USE_PROXY === "true";
const PROXY = process.env.PROXY ?? "";
const PROXY_USERPWD: string | false = process.env.PROXY_USERPWD || false;

const locale = (process.env.LOCALE ?? LOCALE.EN) as LOCALE;

let db: DB;

/*
 * Get data from URL
 */
async function getUrl(
  url: string,
  doNotUseEtag = false
): Promise<string | false> {
  const headers: Record<string, string> = {};

  if (!doNotUseEtag && db.etag && db.etag[url]) {
    headers["If-None-Match"] = `"${db.etag[url]}"`;
  }

  const fetchOptions: RequestInit = {
    headers,
    signal: AbortSignal.timeout(5000),
  };

  // Proxy support would require a proxy agent (e.g. https-proxy-agent package)
  if (USE_PROXY) {
    console.warn(`Proxy configured (${PROXY}) but not applied — install https-proxy-agent to enable proxy support.`);
  }

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (err) {
    console.error("Fetch error:", err);
    process.exit(1);
  }

  // Handle 304 Not Modified
  if (response.status === 304) {
    return false;
  }

  const etag = response.headers.get("ETag");
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

async function getEventPlayerAlias(eventPlayerId: string): Promise<string> {
  const response = PlayerResponseSchema.parse(
    JSON.parse((await getUrl(`${BASE}${ENDPOINTS.PLAYER}/${eventPlayerId}`, true)) as string)
  );
  return response.alias[0].description;
}


async function main(): Promise<void> {
  db = await loadDb();

  // Clean etag once in a while
  if (db.etag && Object.keys(db.etag).length > 5) {
    db.etag = {};
  }

  const t = language[locale];

  const url = `${BASE}${ENDPOINTS.MATCHES}?idCompetition=${ID.COMPETITION}&idSeason=${ID.SEASON}&count=500&language=${locale}`;
  
  // Retrieve all matches
  const matchesResponse = await getUrl(url);
  let matches: Match[] = [];

  // In case of not a 304
  if (matchesResponse !== false) {
    matches = MatchesResponseSchema.parse(JSON.parse(matchesResponse)).results;
  }

  // Find live matches and update score
  for (const match of matches) {
    if (
      match.matchStatus === MATCH.LIVE &&
      !db.live_matches.includes(match.idMatch)
    ) {
      // Yay new match!
      db.live_matches.push(match.idMatch);
      (db[match.idMatch] as MatchData) = {
        stage_id: match.idStage,
        teamsById: {
          [match.home.idTeam]: match.home.teamName[0].description,
          [match.away.idTeam]: match.away.teamName[0].description,
        },
        teamsByHomeAway: {
          home: match.home.teamName[0].description,
          away: match.away.teamName[0].description,
        },
        last_update: Date.now() / 1000,
      };

      // Notify Slack & save data
      await Slack.Post(
        `:zap: ${t.matchBetween} ${match.home.teamName[0].description} / ${match.away.teamName[0].description} ${t.isAboutToStart}! `
      );
    }

    if (db.live_matches.includes(match.idMatch)) {
      // Update score
      (db[match.idMatch] as MatchData).score =
        `${match.home.teamName[0].description} ${match.home.score} - ${match.away.score} ${match.away.teamName[0].description}`;
    }

    // Save immediately, to avoid loops
    await saveDb(db);
  }

  // Post update on live matches (events since last updated time)
  for (let key = 0; key < db.live_matches.length; key++) {
    const matchId = db.live_matches[key];
    const matchData = db[matchId] as MatchData;
    const homeTeamName = matchData.teamsByHomeAway.home;
    const awayTeamName = matchData.teamsByHomeAway.away;
    const lastUpdateSeconds = matchData.last_update;

    // Retrieve match events
    const eventsResponse = await getUrl(
      `${BASE}${ENDPOINTS.TIMELINES}/${ID.COMPETITION}/${ID.SEASON}/${matchData.stage_id}/${matchId}?language=${locale}`
    );

    // In case of 304
    if (eventsResponse === false) {
      continue;
    }

    const events: MatchEvent[] = EventsResponseSchema.parse(JSON.parse(eventsResponse)).events;
    for (const event of events) {
      const eventType = event.type;
      const period = event.period;
      const eventTimeSeconds = new Date(event.timestamp).getTime() / 1000;

      if (eventTimeSeconds > lastUpdateSeconds) {
        const matchTime = event.matchMinute;

        const teamsById = { ...matchData.teamsById };
        const eventTeam = teamsById[event.idTeam];
        delete teamsById[event.idTeam];
        const eventOtherTeam = Object.values(teamsById)[0];
        let eventPlayerAlias: string | null = null;

        const score = `${homeTeamName} ${event.homeGoals} - ${event.awayGoals} ${awayTeamName}`;
        let subject = "";
        let details = "";
        let interestingEvent = true;

        switch (eventType) {
          // Timekeeping
          case EVENT.PERIOD_START:
            switch (period) {
              case PERIOD.FIRST_HALF:
                subject = `:zap: ${t.matchBetween} ${homeTeamName} / ${awayTeamName} ${t.hasStarted}!`;
                break;
              case PERIOD.SECOND_HALF:
              case PERIOD.FIRST_ET:
              case PERIOD.SECOND_ET:
              case PERIOD.PENALTY:
                subject = `:runner: ${t.matchBetween} ${homeTeamName} / ${awayTeamName} ${t.hasResumed}`;
                break;
            }
            break;

          case EVENT.PERIOD_END:
            switch (period) {
              case PERIOD.FIRST_HALF:
                subject = `:toilet: ${t.halfTime} ${score}`;
                details = matchTime;
                break;
              case PERIOD.SECOND_HALF:
                subject = `:stopwatch: ${t.fullTime} ${score}`;
                details = matchTime;
                break;
              case PERIOD.FIRST_ET:
                subject = `:toilet: ${t.endOf1stET} ${score}`;
                details = matchTime;
                break;
              case PERIOD.SECOND_ET:
                subject = `:stopwatch: ${t.endOf2ndET} ${score}`;
                details = matchTime;
                break;
              case PERIOD.PENALTY:
                subject = `:stopwatch: ${t.endOfPenaltyShootout} ${score} (${event.homePenaltyGoals} - ${event.awayPenaltyGoals})`;
                details = matchTime;
                break;
            }
            break;

          // Goals
          case EVENT.GOAL:
          case EVENT.FREE_KICK_GOAL:
          case EVENT.PENALTY_GOAL:
            eventPlayerAlias = await getEventPlayerAlias(event.idPlayer);
            subject = `:soccer: ${t.goal} ${eventTeam}!!!`;
            details = `${eventPlayerAlias} (${matchTime}) ${score}`;
            if (period === PERIOD.PENALTY) {
              details += ` (${event.homePenaltyGoals} - ${event.awayPenaltyGoals})`;
            }
            break;

          case EVENT.OWN_GOAL:
            eventPlayerAlias = await getEventPlayerAlias(event.idPlayer);
            subject = `:face_palm: ${t.ownGoal} ${eventTeam}!!!`;
            details = `${eventPlayerAlias} (${matchTime}) ${score}`;
            break;

          // Cards
          case EVENT.YELLOW_CARD:
            eventPlayerAlias = await getEventPlayerAlias(event.idPlayer);
            subject = `:collision: ${t.yellowCard} ${eventTeam}`;
            details = `${eventPlayerAlias} (${matchTime})`;
            break;

          case EVENT.SECOND_YELLOW_CARD_RED:
          case EVENT.STRAIGHT_RED:
            eventPlayerAlias = await getEventPlayerAlias(event.idPlayer);
            subject = `:collision: ${t.redCard} ${eventTeam}`;
            details = `${eventPlayerAlias} (${matchTime})`;
            break;

          // Penalties
          case EVENT.FOUL_PENALTY:
            subject = `:exclamation: ${t.penalty} ${eventOtherTeam}!!!`;
            break;

          case EVENT.PENALTY_MISSED:
          case EVENT.PENALTY_SAVED:
          case EVENT.PENALTY_CROSSBAR:
            eventPlayerAlias = await getEventPlayerAlias(event.idPlayer);
            subject = `:no_good: ${t.missedPenalty} ${eventTeam}!!!`;
            details = `${eventPlayerAlias} (${matchTime})`;
            if (period === PERIOD.PENALTY) {
              details += ` (${event.homePenaltyGoals} - ${event.awayPenaltyGoals})`;
            }
            break;

          // End of live match
          case EVENT.END_OF_GAME:
            db.live_matches.splice(key, 1);
            key--;
            delete db[matchId];
            interestingEvent = false;
            break;

          default:
            interestingEvent = false;
            continue;
        }

        if (interestingEvent) {
          await Slack.Post(subject, details);
          matchData.last_update = Date.now() / 1000;
        }
      }
    }
  }

  // Record state for next run
  await saveDb(db);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
