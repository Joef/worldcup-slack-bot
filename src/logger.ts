const IS_PROD = process.env.ENVIRONMENT === 'prod';

type Level = 'info' | 'warn' | 'error';

const SEVERITY: Record<Level, string> = {
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
};

function log(level: Level, message: string): void {
  if (IS_PROD) {
    process.stdout.write(
      JSON.stringify({ severity: SEVERITY[level], message }) + '\n',
    );
  } else {
    const ts = new Date().toISOString();
    const line = `[${SEVERITY[level]}] ${ts} ${message}`;
    level === 'error' ? console.error(line) : console.log(line);
  }
}

export const logger = {
  info: (msg: string) => log('info', msg),
  warn: (msg: string) => log('warn', msg),
  error: (msg: string) => log('error', msg),
};
