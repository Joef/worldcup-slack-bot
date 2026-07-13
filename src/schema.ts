import { z } from 'zod';

const languageSchema = z.array(z.object({ Description: z.string() }));

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
    Score: z.number().nullable(),
    Abbreviation: z.string(),
  })
  .transform((d) => ({
    abbreviation: d.Abbreviation,
    idTeam: d.IdTeam,
    teamName: d.TeamName,
    score: d.Score ?? 0,
  }));

export const MatchSchema = z
  .object({
    IdMatch: z.string(),
    IdStage: z.string(),
    MatchStatus: z.number(),
    MatchNumber: z.number(),
    Home: MatchTeamSchema.nullable(),
    Away: MatchTeamSchema.nullable(),
    Stadium: z.object({
      Name: languageSchema,
      CityName: languageSchema,
      IdCountry: z.string(),
    }),
    Officials: z.array(
      z.object({
        IdCountry: z.string(),
        Name: languageSchema,
      }),
    ),
  })
  .transform((d) => ({
    idMatch: d.IdMatch,
    idStage: d.IdStage,
    matchStatus: d.MatchStatus,
    matchNumber: d.MatchNumber,
    home: d.Home,
    away: d.Away,
    official: {
      idCountry: d.Officials[0]?.IdCountry,
      name: d.Officials[0]?.Name[0]?.Description,
    },
    stadium: {
      name: d.Stadium.Name[0]?.Description,
      city: d.Stadium.CityName[0]?.Description,
      idCountry: d.Stadium.IdCountry,
    },
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
    EventId: z.string(),
    EventDescription: languageSchema,
    Type: z.number(),
    TypeLocalized: languageSchema,
    Period: z.number(),
    Timestamp: z.string(),
    MatchMinute: z.string(),
    IdTeam: z.string().optional(),
    IdPlayer: z.string().optional(),
    HomeGoals: z.number(),
    AwayGoals: z.number(),
    HomePenaltyGoals: z.number(),
    AwayPenaltyGoals: z.number(),
  })
  .transform((d) => ({
    id: d.EventId,
    description: d.EventDescription[0]?.Description,
    typeDescription: d.TypeLocalized[0]?.Description,
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
