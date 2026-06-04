import { z } from 'zod';

export const TeamNameSchema = z
  .object({
    Description: z.string(),
  })
  .transform((d) => ({
    description: d.Description,
  }));

export const MatchTeamSchema = z
  .object({
    IdTeam: z.string(),
    TeamName: z.array(TeamNameSchema),
    Score: z.number(),
  })
  .transform((d) => ({
    idTeam: d.IdTeam,
    teamName: d.TeamName,
    score: d.Score,
  }));

export const MatchSchema = z
  .object({
    IdMatch: z.string(),
    IdStage: z.string(),
    MatchStatus: z.number(),
    Home: MatchTeamSchema,
    Away: MatchTeamSchema,
  })
  .transform((d) => ({
    idMatch: d.IdMatch,
    idStage: d.IdStage,
    matchStatus: d.MatchStatus,
    home: d.Home,
    away: d.Away,
  }));

export const MatchesResponseSchema = z
  .object({
    Results: z.array(MatchSchema),
  })
  .transform((d) => ({
    results: d.Results,
  }));

export const MatchEventSchema = z
  .object({
    Type: z.number(),
    Period: z.number(),
    Timestamp: z.string(),
    MatchMinute: z.string(),
    IdTeam: z.string(),
    IdPlayer: z.string(),
    HomeGoals: z.number(),
    AwayGoals: z.number(),
    HomePenaltyGoals: z.number(),
    AwayPenaltyGoals: z.number(),
  })
  .transform((d) => ({
    type: d.Type,
    period: d.Period,
    timestamp: d.Timestamp,
    matchMinute: d.MatchMinute,
    idTeam: d.IdTeam,
    idPlayer: d.IdPlayer,
    homeGoals: d.HomeGoals,
    awayGoals: d.AwayGoals,
    homePenaltyGoals: d.HomePenaltyGoals,
    awayPenaltyGoals: d.AwayPenaltyGoals,
  }));

export const PlayerResponseSchema = z
  .object({
    Alias: z.array(
      z.object({
        Description: z.string(),
      }),
    ),
  })
  .transform((d) => ({
    alias: d.Alias.map((a) => ({ description: a.Description })),
  }));

export const EventsResponseSchema = z
  .object({
    Event: z.array(MatchEventSchema),
  })
  .transform((d) => ({
    events: d.Event,
  }));
