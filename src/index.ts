import 'dotenv/config';
import {
  MATCH,
  EVENT,
  PERIOD,
  INTERESTING_EVENTS,
  PENALTY_RESULT,
} from './constants';
import { DB, loadDb, MatchData, PenaltyResult, saveDb } from './db';
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
const START_TIME = process.env.DEBUG_TIME
  ? Number(process.env.DEBUG_TIME)
  : Date.now() / 1000;

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

  logger.info(`${db.live_matches.length} Live match(es): [${db.live_matches}]`);

  // Find live matches and update score
  let dbDirty = false;
  for (const match of matches) {
    if (
      (match.matchStatus === MATCH.LIVE ||
        (DEBUG && match.idMatch === DEBUG_ID)) &&
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
        events: [],
        teamsById: {
          [home.idTeam]: `${homeTeamNameIcon} ${homeTeamName}`,
          [away.idTeam]: `${awayTeamNameIcon} ${awayTeamName}`,
        },
        teamsByHomeAway: {
          home: {
            id: home.idTeam,
            name: `${homeTeamNameIcon} ${homeTeamName} `,
          },
          away: {
            id: away.idTeam,
            name: `${awayTeamNameIcon} ${awayTeamName}`,
          },
        },
        last_update: DEBUG ? START_TIME : lastUpdate,
        penalties: {
          home: {
            name: homeTeamName,
            flag: homeTeamNameIcon,
            score: 0,
            result: [],
          },
          away: {
            name: awayTeamName,
            flag: awayTeamNameIcon,
            score: 0,
            result: [],
          },
        },
      };

      const officialCountry =
        CountryIcon[match.official.idCountry as CountryName] ?? '';

      // Notify Slack & save data
      await slack.post(
        slack.m('zap', 'matchBetween') + ` ${t.isAboutToStart}!`,
        `_Match Number #${match.matchNumber}_\n\n${homeTeamNameIcon} ${homeTeamName} - ${awayTeamNameIcon} ${awayTeamName}\n\n${CountryIcon[match.stadium.idCountry as CountryName]} ${match.stadium.name} - ${match.stadium.city}\n${officialCountry} Official - ${match.official.name}`,
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
  const endedMatchIds = new Set<string>();
  for (let key = 0; key < db.live_matches.length; key++) {
    const matchId = db.live_matches[key];
    const matchData = db[matchId] as MatchData;
    const homeTeamName = matchData.teamsByHomeAway.home.name;
    const awayTeamName = matchData.teamsByHomeAway.away.name;
    const lastUpdateSeconds = matchData.last_update;

    const events = await getMatchEvents(matchData.stage_id, matchId, db);

    for (const event of events) {
      const eventType = event.type;
      const eventId = event.id;
      const period = event.period;
      const eventTimeSeconds = new Date(event.timestamp).getTime() / 1000;

      const eventInfo = `${period === PERIOD.PENALTY ? 'PK' : event.matchMinute} - ${event.typeDescription} - ${event.description}`;

      if (!INTERESTING_EVENTS.includes(eventType)) {
        // not interesting
        // logger.info(`--X ${eventInfo}`);
        continue;
      }
      logger.info(`--> ${eventInfo}`);

      if (
        eventTimeSeconds > lastUpdateSeconds ||
        !matchData.events.includes(eventId)
      ) {
        const matchTime = event.matchMinute;

        const teamsById = { ...matchData.teamsById };
        let eventTeam = '';
        if (event.idTeam) {
          eventTeam = teamsById[event.idTeam];
          delete teamsById[event.idTeam];
        }

        const eventOtherTeam = Object.values(teamsById)[0];

        const score = `${event.homeGoals} ${homeTeamName}\n${event.awayGoals} ${awayTeamName}`;

        let output: Output = { message: '', details: '' };
        let interestingEvent = true;
        const matchInfo = `${homeTeamName} - ${awayTeamName}`;

        if (PENALTY_RESULT.includes(event.type) && period === PERIOD.PENALTY) {
          matchData.penalties.home.score = event.homePenaltyGoals;
          matchData.penalties.away.score = event.awayPenaltyGoals;

          const result: PenaltyResult =
            eventType === EVENT.PENALTY_GOAL ? 'X' : 'O';

          if (event.idTeam === matchData.teamsByHomeAway.home.id) {
            matchData.penalties.home.result.push(result);
          } else {
            matchData.penalties.away.result.push(result);
          }
        }

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

        let meta = '';

        switch (eventType) {
          // Timekeeping
          case EVENT.PERIOD_START:
            output = parsePeriodStart(period, matchInfo);
            break;

          case EVENT.PERIOD_END:
            output = parsePeriodEnd(info, matchData.penalties);

            break;
          case EVENT.WEATHER_DELAY:
            output = {
              message: slack.m('weather', 'weatherDelay', { meta: matchTime }),
              details: info.score,
            };
            break;
          /**
           * Hydration Break notification
           */
          /*
          case EVENT.HYDRATION_BREAK:
            output = {
              message: slack.m('beers', 'hydrationBreak', { meta: matchTime }),
              details: `_Brought to you by Lenovo and Powerade_`,
            };
            break;
          */
          case EVENT.PENALTY_AWARDED:
            output = {
              message: slack.m('eyes', 'penalty', { meta: matchTime }),
            };
            break;

          // Goals
          case EVENT.PENALTY_GOAL:
          case EVENT.GOAL:
          case EVENT.FREE_KICK_GOAL:
            output = await parsePlayerEvent(player, info, 'soccer', 'goal', {
              includeScore: period !== PERIOD.PENALTY,
              includeExclamation: true,
              includeTime: true,
              meta,
              penaltyPeriod: {
                ...matchData.penalties,
                active: period === PERIOD.PENALTY,
              },
            });

            break;
          case EVENT.GOAL_DISALLOWED:
            output = {
              message: slack.m('no_good', 'goalDisallowed', {
                meta: matchTime,
              }),
              details: info.score,
            };
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
                includeTime: true,
              },
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
                includeTime: true,
                includeExclamation: true,
              },
            );
            break;

          // Penalties
          case EVENT.FOUL_PENALTY:
            output = {
              message: slack.m('exclamation', 'penalty', {
                meta: `${eventOtherTeam}`,
                includeExclamation: true,
              }),
            };
            break;

          case EVENT.PENALTY_MISSED:
          case EVENT.PENALTY_SAVED:
          case EVENT.PENALTY_CROSSBAR:
            output = await parsePlayerEvent(
              player,
              info,
              'no_good',
              'missedPenalty',
              {
                includeExclamation: true,
                includeScore: false,
                includeTime: true,
                meta,
                penaltyPeriod: {
                  ...matchData.penalties,
                  active: period === PERIOD.PENALTY,
                },
              },
            );
            break;
          // case EVENT.SUBSTITUTION:
          //   output = {
          //     message: slack.m('arrow_up_down', 'substitution')
          //   }
          //   break;

          // End of live match, sometimes redundant with EVENT.PERIOD_END or even before
          case EVENT.END_OF_GAME:
            logger.info(
              `End of game event, queuing removal of match ${matchId}`,
            );
            endedMatchIds.add(matchId);
            interestingEvent = false;
            break;

          default:
            interestingEvent = false;
            continue;
        }

        if (interestingEvent) {
          if (!output.message) {
            logger.info(JSON.stringify({ output, player, info }));
            continue;
          }

          await slack.post(output.message, output.details);
          matchData.events.push(eventId);
          matchData.last_update = Date.now() / 1000;
        }
      }
    }
    // cleanup: remove from live if end of game.
    const match = matches.findIndex((m) => m.idMatch === matchId);
    if (match >= 0 && matches[match].matchStatus === MATCH.FINISHED) {
      logger.info(
        `Match ${matchId} finished status (possibly without END_OF_GAME event), queuing removal`,
      );
      endedMatchIds.add(matchId);
    }
  }

  for (const id of endedMatchIds) {
    logger.info(`Removing ended match ${id} from live_matches`);
    db.live_matches = db.live_matches.filter((m) => m !== id);
    delete db[id];
  }

  logger.info(
    `Run complete - ${new Date().toISOString()} (${Date.now() - runStart}ms)`,
  );

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
      logger.error(
        err instanceof Error ? (err.stack ?? err.message) : String(err),
      );
      process.exit(1);
    });
} else {
  async function loop() {
    try {
      await main();
    } catch (err) {
      logger.error(
        err instanceof Error
          ? ((err as Error).stack ?? (err as Error).message)
          : String(err),
      );
    } finally {
      setTimeout(loop, 60 * 1000);
    }
  }

  loop();
}
