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

async function main(): Promise<void> {
  logger.info('Bot run started');
  const db: DB = await loadDb();

  const t = language[locale];

  // Clean etag once in a while
  if (db.etag && Object.keys(db.etag).length > 5) {
    db.etag = {};
  }

  // Retrieve all matches
  const matches = await getMatches(db);
  logger.info(`Fetched ${matches.length} matches`);

  // Find live matches and update score
  let dbDirty = false;
  for (const match of matches) {
    if (
      match.matchStatus === MATCH.LIVE
      &&
      !db.live_matches.includes(match.idMatch)
    ) {
      // Yay new match!
      const home = match.home!;
      const away = match.away!;

      logger.info(
        `New live match: ${home.teamName[0].description} vs ${away.teamName[0].description} (${match.idMatch})`,
      );
      db.live_matches.push(match.idMatch);

      (db[match.idMatch] as MatchData) = {
        stage_id: match.idStage,
        teamsById: {
          [home.idTeam]: home.teamName[0].description,
          [away.idTeam]: away.teamName[0].description,
        },
        teamsByHomeAway: {
          home: home.teamName[0].description,
          away: away.teamName[0].description,
        },
        last_update: Date.now() / 1000,
      };

      // Notify Slack & save data
      await slack.post(
        slack.m(
          'zap',
          'matchBetween',
          `${home.teamName[0].description} / ${away.teamName[0].description} ${t.isAboutToStart}!`,
        ),
      );
      dbDirty = true;
    }

    if (db.live_matches.includes(match.idMatch)) {
      const home = match.home!;
      const away = match.away!;
      const matchData = db[match.idMatch] as MatchData;
      const newScore = `${home.teamName[0].description} ${home.score} - ${away.score} ${away.teamName[0].description}`;
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
        const eventTeam = teamsById[event.idTeam];
        delete teamsById[event.idTeam];

        const eventOtherTeam = Object.values(teamsById)[0];

        const score = `${homeTeamName} ${event.homeGoals} - ${event.awayGoals} ${awayTeamName}`;

        let output: Output = { message: '', details: '' };
        let interestingEvent = true;
        const matchInfo = `${homeTeamName} / ${awayTeamName}`;

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

          // Goals
          case EVENT.GOAL:
          case EVENT.FREE_KICK_GOAL:
          case EVENT.PENALTY_GOAL:
            output = await parsePlayerEvent(player, info, 'soccer', 'goal', {
              includeScore: true,
              includeExclamation: true,
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
            );
            break;

          case EVENT.SECOND_YELLOW_CARD_RED:
          case EVENT.STRAIGHT_RED:
            output = await parsePlayerEvent(
              player,
              info,
              'large_red_square',
              'redCard',
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
          await slack.post(output.message, output.details);
          matchData.last_update = Date.now() / 1000;
        }
      }
    }
  }

  logger.info('Bot run complete');

  // Record state for next run
  await saveDb(db);
  process.exit(0);
}

main().catch((err) => {
  logger.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
