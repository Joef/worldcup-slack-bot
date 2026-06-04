
import { ID, MATCH, EVENT, PERIOD, ENDPOINTS, BASE } from "./constants";
import { DB, loadDb, MatchData, saveDb } from "./db";
import { LOCALE, language } from "./languages";
import { postToSlack } from "./slack";

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
  const response = JSON.parse(
    (await getUrl(
      `${BASE}${ENDPOINTS.PLAYER}/${eventPlayerId}`,
      true
    )) as string
  );
  return response["Alias"][0]["Description"];
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
  let matches: any[] = [];

  // In case of not a 304
  if (matchesResponse !== false) {
    matches = JSON.parse(matchesResponse)["Results"];
  }

  // Find live matches and update score
  for (const match of matches) {
    if (
      match["MatchStatus"] === MATCH.LIVE &&
      !db.live_matches.includes(match["IdMatch"])
    ) {
      // Yay new match!
      db.live_matches.push(match["IdMatch"]);
      (db[match["IdMatch"]] as MatchData) = {
        stage_id: match["IdStage"],
        teamsById: {
          [match["Home"]["IdTeam"]]: match["Home"]["TeamName"][0]["Description"],
          [match["Away"]["IdTeam"]]: match["Away"]["TeamName"][0]["Description"],
        },
        teamsByHomeAway: {
          Home: match["Home"]["TeamName"][0]["Description"],
          Away: match["Away"]["TeamName"][0]["Description"],
        },
        last_update: Date.now() / 1000,
      };

      // Notify Slack & save data
      await postToSlack(
        `:zap: ${t.matchBetween} ${match["Home"]["TeamName"][0]["Description"]} / ${match["Away"]["TeamName"][0]["Description"]} ${t.isAboutToStart}! `
      );
    }

    if (db.live_matches.includes(match["IdMatch"])) {
      // Update score
      (db[match["IdMatch"]] as MatchData).score =
        `${match["Home"]["TeamName"][0]["Description"]} ${match["Home"]["Score"]} - ${match["Away"]["Score"]} ${match["Away"]["TeamName"][0]["Description"]}`;
    }

    // Save immediately, to avoid loops
    await saveDb(db);
  }

  // Post update on live matches (events since last updated time)
  for (let key = 0; key < db.live_matches.length; key++) {
    const matchId = db.live_matches[key];
    const matchData = db[matchId] as MatchData;
    const homeTeamName = matchData.teamsByHomeAway["Home"];
    const awayTeamName = matchData.teamsByHomeAway["Away"];
    const lastUpdateSeconds = matchData.last_update;

    // Retrieve match events
    const eventsResponse = await getUrl(
      `${BASE}${ENDPOINTS.TIMELINES}/${ID.COMPETITION}/${ID.SEASON}/${matchData.stage_id}/${matchId}?language=${locale}`
    );

    // In case of 304
    if (eventsResponse === false) {
      continue;
    }

    const events: any[] = JSON.parse(eventsResponse)["Event"];
    for (const event of events) {
      const eventType: number = event["Type"];
      const period: number = event["Period"];
      const eventTimeSeconds = new Date(event["Timestamp"]).getTime() / 1000;

      if (eventTimeSeconds > lastUpdateSeconds) {
        const matchTime: string = event["MatchMinute"];

        const teamsById = { ...matchData.teamsById };
        const eventTeam = teamsById[event["IdTeam"]];
        delete teamsById[event["IdTeam"]];
        const eventOtherTeam = Object.values(teamsById)[0];
        let eventPlayerAlias: string | null = null;

        const score = `${homeTeamName} ${event["HomeGoals"]} - ${event["AwayGoals"]} ${awayTeamName}`;
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
                subject = `:stopwatch: ${t.endOfPenaltyShootout} ${score} (${event["HomePenaltyGoals"]} - ${event["AwayPenaltyGoals"]})`;
                details = matchTime;
                break;
            }
            break;

          // Goals
          case EVENT.GOAL:
          case EVENT.FREE_KICK_GOAL:
          case EVENT.PENALTY_GOAL:
            eventPlayerAlias = await getEventPlayerAlias(event["IdPlayer"]);
            subject = `:soccer: ${t.goal} ${eventTeam}!!!`;
            details = `${eventPlayerAlias} (${matchTime}) ${score}`;
            if (period === PERIOD.PENALTY) {
              details += ` (${event["HomePenaltyGoals"]} - ${event["AwayPenaltyGoals"]})`;
            }
            break;

          case EVENT.OWN_GOAL:
            eventPlayerAlias = await getEventPlayerAlias(event["IdPlayer"]);
            subject = `:face_palm: ${t.ownGoal} ${eventTeam}!!!`;
            details = `${eventPlayerAlias} (${matchTime}) ${score}`;
            break;

          // Cards
          case EVENT.YELLOW_CARD:
            eventPlayerAlias = await getEventPlayerAlias(event["IdPlayer"]);
            subject = `:collision: ${t.yellowCard} ${eventTeam}`;
            details = `${eventPlayerAlias} (${matchTime})`;
            break;

          case EVENT.SECOND_YELLOW_CARD_RED:
          case EVENT.STRAIGHT_RED:
            eventPlayerAlias = await getEventPlayerAlias(event["IdPlayer"]);
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
            eventPlayerAlias = await getEventPlayerAlias(event["IdPlayer"]);
            subject = `:no_good: ${t.missedPenalty} ${eventTeam}!!!`;
            details = `${eventPlayerAlias} (${matchTime})`;
            if (period === PERIOD.PENALTY) {
              details += ` (${event["HomePenaltyGoals"]} - ${event["AwayPenaltyGoals"]})`;
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
          await postToSlack(subject, details);
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
