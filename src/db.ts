import * as fs from 'fs';
import { Storage } from '@google-cloud/storage';

const ENVIRONMENT = process.env.ENVIRONMENT ?? 'local';
const GCS_BUCKET = process.env.GCS_BUCKET ?? 'worldcup-bot-state';
const dbFileName = './worldCupDB.json';

const storage = ENVIRONMENT === 'prod' ? new Storage() : null;
const bucket = storage?.bucket(GCS_BUCKET);

export interface MatchData {
  stage_id: string;
  teamsById: Record<string, string>;
  teamsByHomeAway: { home: string; away: string };
  last_update: number;
  score?: string;
}

export interface DB {
  live_matches: string[];
  etag: Record<string, string>;
  [matchId: string]: unknown;
}

export async function loadDb(): Promise<DB> {
  if (ENVIRONMENT === 'prod') {
    const [contents] = await bucket!.file(dbFileName).download();
    return JSON.parse(contents.toString('utf-8'));
  }
  return JSON.parse(fs.readFileSync(dbFileName, 'utf-8'));
}

export async function saveDb(db: DB): Promise<void> {
  if (ENVIRONMENT === 'prod') {
    await bucket!.file(dbFileName).save(JSON.stringify(db), {
      contentType: 'application/json',
    });
  } else {
    fs.writeFileSync(dbFileName, JSON.stringify(db));
  }
}
