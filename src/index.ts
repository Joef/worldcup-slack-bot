import 'dotenv/config';
import { MATCH, EVENT, PERIOD } from './constants';
import { DB, loadDb, MatchData, saveDb } from './db';
import { locale, language } from './languages';
import { logger } from './logger';
import { slack } from './slack';
import {
  getMatches,
  getMatchEvents,
  EventInfo,
  Output,
  parsePeriodEnd,
  parsePeriodStart,
  parsePlayerEvent,
  PlayerInfo,
} from './api';
import { CountryIcon, CountryName } from './icons';

const IS_PROD = process.env.ENVIRONMENT === 'prod';
const DEBUG = process.env.DEBUG === 'true';
const DEBUG_ID = process.env.DEBUG_ID ?? '';

async function main(): Promise<void> {
  const runStart = Date.now();
  logger.info(`Run started - ${new Date().toISOString()}`);
  const db: DB = await loadDb();

  const t = language[locale];

  // Clean etag once in a while
  if (db.etag && Object.keys(db.etag).length > 5) {
    db.etag = {};
  }

  // Retrieve all matches
  const matches = await getMatches(db);
  logger.info(`Fetched ${matches.length} matches`);

  logger.info(`${db.live_matches.length} Live match(es): [${db.live_matches}]`)

  // Find live matches and update score
  let dbDirty = false;
  for (const match of matches) {
    if (
      (match.matchStatus === MATCH.LIVE || (DEBUG && match.idMatch === DEBUG_ID))
      &&
      !db.live_matches.includes(match.idMatch)
    ) {
      // Yay new match!
      const home = match.home!;
      const away = match.away!;

      const homeTeamName = home.teamName[0].description;
      const awayTeamName = away.teamName[0].description;

      const homeTeamNameIcon = CountryIcon[home.abbreviation as CountryName];
      const awayTeamNameIcon = CountryIcon[away.abbreviation as CountryName];

      logger.info(
        `New live match: ${home.teamName[0].description} vs ${away.teamName[0].description} (${match.idMatch})`,
      );
      db.live_matches.push(match.idMatch);

      const lastUpdate = Date.now() / 1000;

      (db[match.idMatch] as MatchData) = {
        stage_id: match.idStage,
        teamsById: {
          [home.idTeam]: `${homeTeamNameIcon} ${homeTeamName}`,
          [away.idTeam]: `${awayTeamNameIcon} ${awayTeamName}`,
        },
        teamsByHomeAway: {
          home: `${homeTeamName} ${homeTeamNameIcon}`,
          away: `${awayTeamNameIcon}  ${awayTeamName}`,
        },
        last_update: DEBUG ? lastUpdate - 100000 : lastUpdate,
      };

      // Notify Slack & save data
      await slack.post(
        slack.m(
          'zap',
          'matchBetween',
          `${homeTeamName} ${homeTeamNameIcon} - ${awayTeamNameIcon} ${awayTeamName} ${t.isAboutToStart}!`,
        ),
      );
      dbDirty = true;
    }

    if (db.live_matches.includes(match.idMatch)) {
      const home = match.home!;
      const away = match.away!;
      const matchData = db[match.idMatch] as MatchData;
      const newScore = `${CountryIcon[home.abbreviation as CountryName]} ${home.teamName[0].description} ${home.score} - ${away.score} ${away.teamName[0].description} ${CountryIcon[away.abbreviation as CountryName]}`;
      if (matchData.score !== newScore) {
        matchData.score = newScore;
        dbDirty = true;
      }
    }
  }

  if (dbDirty) {
    await saveDb(db);
  }

  // Post update on live matches (events since last updated time)
  for (let key = 0; key < db.live_matches.length; key++) {
    const matchId = db.live_matches[key];
    const matchData = db[matchId] as MatchData;
    const homeTeamName = matchData.teamsByHomeAway.home;
    const awayTeamName = matchData.teamsByHomeAway.away;
    const lastUpdateSeconds = matchData.last_update;

    const events = await getMatchEvents(matchData.stage_id, matchId, db);

    for (const event of events) {
      const eventType = event.type;
      const period = event.period;
      const eventTimeSeconds = new Date(event.timestamp).getTime() / 1000;

      if (eventTimeSeconds > lastUpdateSeconds) {
        const matchTime = event.matchMinute;

        const teamsById = { ...matchData.teamsById };
        let eventTeam = '';;
        if (event.idTeam) {
          eventTeam = teamsById[event.idTeam];
          delete teamsById[event.idTeam];
        }

        const eventOtherTeam = Object.values(teamsById)[0];

        const score = `${homeTeamName} ${event.homeGoals} - ${event.awayGoals} ${awayTeamName}`;

        let output: Output = { message: '', details: '' };
        let interestingEvent = true;
        const matchInfo = `${homeTeamName} - ${awayTeamName}`;

        const info: EventInfo = {
          period,
          score,
          matchTimeInfo: matchTime,
        };

        const player: PlayerInfo = {
          playerId: event.idPlayer,
          db,
          eventTeam,
        };

        switch (eventType) {
          // Timekeeping
          case EVENT.PERIOD_START:
            output = parsePeriodStart(period, matchInfo);
            break;

          case EVENT.PERIOD_END:
            output = parsePeriodEnd(
              info,
              `${event.homePenaltyGoals} - ${event.awayPenaltyGoals}`,
            );

            break;
          case EVENT.HYDRATION_BREAK:
            output = {
              message: slack.m('beers', 'hydrationBreak'),
              details: `${matchTime}`,
            };
            break;

          // Goals
          case EVENT.GOAL:
          case EVENT.FREE_KICK_GOAL:
          case EVENT.PENALTY_GOAL:
            output = await parsePlayerEvent(player, info, 'soccer', 'goal', {
              includeScore: true,
              includeExclamation: true,
              includeTime: true,
            });
            break;

          case EVENT.OWN_GOAL:
            output = await parsePlayerEvent(
              player,
              info,
              'face_palm',
              'ownGoal',
              {
                includeScore: true,
                includeExclamation: true,
                includeTime: true,
              },
            );
            break;

          // Cards
          case EVENT.YELLOW_CARD:
            output = await parsePlayerEvent(
              player,
              info,
              'large_yellow_square',
              'yellowCard',
              {
                includeTime: true
              }
            );
            break;

          case EVENT.SECOND_YELLOW_CARD_RED:
          case EVENT.STRAIGHT_RED:
            output = await parsePlayerEvent(
              player,
              info,
              'large_red_square',
              'redCard',
              {
                includeTime: true
              }
            );
            break;

          // Penalties
          case EVENT.FOUL_PENALTY:
            output = {
              message: slack.m(
                'exclamation',
                'penalty',
                `${eventOtherTeam}!!!`,
              ),
            };
            break;

          case EVENT.PENALTY_MISSED:
          case EVENT.PENALTY_SAVED:
          case EVENT.PENALTY_CROSSBAR:
            const meta =
              period === PERIOD.PENALTY
                ? ` (${event.homePenaltyGoals} - ${event.awayPenaltyGoals})`
                : '';
            output = await parsePlayerEvent(
              player,
              info,
              'no_good',
              'missedPenalty',
              {
                includeExclamation: true,
                includeScore: false,
                includeTime: period !== PERIOD.PENALTY,
                meta,
              },
            );
            break;
          // case EVENT.SUBSTITUTION:
          //   output = {
          //     message: slack.m('arrow_up_down', 'substitution')
          //   }
          //   break;

          // End of live match
          case EVENT.END_OF_GAME:
            logger.info(`End of game, removing live_match(${key})`);
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
          await slack.post(output.message, output.details);
          matchData.last_update = Date.now() / 1000;
        }

      }
    }
    // remove from live if end of game.
    const match = matches.findIndex((m) => m.idMatch === matchId);
    if (match >= 0 && matches[match].matchStatus === MATCH.FINISHED) {
      logger.info(`Removing live_match(${key})`);
      db.live_matches.splice(key, 1);
      key--;
      delete db[matchId];
    }

  }

  logger.info(`Run complete - ${new Date().toISOString()} (${Date.now() - runStart}ms)`);

  // Record state for next run
  await saveDb(db);
  if (IS_PROD) {
    process.exit(0);
  }
}



if (IS_PROD) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error(err instanceof Error ? err.stack ?? err.message : String(err));
      process.exit(1);
    });
} else {
  async function loop() {
    try {
      await main();
    } catch (err) {
      logger.error(err instanceof Error ? (err as Error).stack ?? (err as Error).message : String(err));
    } finally {
      setTimeout(loop, 60 * 1000);
    }
  }

  loop();
}