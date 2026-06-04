import { z } from "zod";
import { EventsResponseSchema, MatchEventSchema, MatchesResponseSchema, MatchSchema, MatchTeamSchema, PlayerResponseSchema, TeamNameSchema } from "./schema";

export type TeamName = z.infer<typeof TeamNameSchema>;
export type MatchTeam = z.infer<typeof MatchTeamSchema>;
export type Match = z.infer<typeof MatchSchema>;
export type MatchesResponse = z.infer<typeof MatchesResponseSchema>;
export type MatchEvent = z.infer<typeof MatchEventSchema>;
export type EventsResponse = z.infer<typeof EventsResponseSchema>;
export type PlayerResponse = z.infer<typeof PlayerResponseSchema>;
