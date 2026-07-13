export enum LOCALE {
  FR = 'fr-FR',
  EN = 'en-GB',
  ES = 'es-ES',
}

export const locale = (process.env.LOCALE ?? LOCALE.EN) as LOCALE;
export interface Translations {
  matchBetween: string;
  isAboutToStart: string;
  yellowCard: string;
  redCard: string;
  ownGoal: string;
  hydrationBreak: string;
  hydrationResume: string;
  penalty: string;
  goal: string;
  goalDisallowed: string;
  missedPenalty: string;
  hasStarted: string;
  halfTime: string;
  fullTime: string;
  hasResumed: string;
  endOf1stET: string;
  endOf2ndET: string;
  endOfPenaltyShootout: string;
  penaltyPeriod: string;
  substitution: string;
  weatherDelay: string;
}

export type TranslationKey = keyof Translations;

export const language: Record<LOCALE, Translations> = {
  [LOCALE.FR]: {
    matchBetween: 'Le match',
    isAboutToStart: 'est sur le point de commencer',
    yellowCard: 'Carton jaune',
    redCard: 'Carton rouge',
    ownGoal: 'But contre son camp',
    penalty: 'Pénalty',
    goal: 'BUUUUUT',
    goalDisallowed: '',
    hydrationBreak: '',
    hydrationResume: '',
    missedPenalty: 'Pénalty manqué',
    hasStarted: 'commence',
    halfTime: 'Mi-temps',
    fullTime: 'Fin de la 2e période',
    hasResumed: 'a repris',
    endOf1stET: 'Mi-temps de la prolongation',
    endOf2ndET: 'Fin de la prolongation',
    endOfPenaltyShootout: 'Fin de la séance de tirs au but',
    penaltyPeriod: '',
    substitution: '',
    weatherDelay: '',
  },
  [LOCALE.EN]: {
    matchBetween: 'The match',
    isAboutToStart: 'is about to start',
    yellowCard: 'Yellow card',
    redCard: 'RED CARD',
    ownGoal: 'OWN GOAL',
    penalty: 'PENALTY',
    goal: 'GOOOOAL',
    goalDisallowed: 'Goal Disallowed',
    hydrationBreak: 'Hydration Break',
    hydrationResume: 'Get back here, American!',
    missedPenalty: 'Missed penalty',
    hasStarted: 'has started',
    halfTime: 'HALF TIME',
    fullTime: 'FULL TIME',
    hasResumed: 'has resumed',
    endOf1stET: 'END OF 1ST ET',
    endOf2ndET: 'END OF 2ND ET',
    endOfPenaltyShootout: 'PENALTY SHOOTOUT',
    penaltyPeriod: 'has started the penalty shootout!!!',
    substitution: 'Substitution',
    weatherDelay: 'Weather delay',
  },
  [LOCALE.ES]: {
    matchBetween: 'El partido',
    isAboutToStart: 'está a punto de comenzar',
    yellowCard: 'Tarjeta amarilla',
    redCard: 'Tarjeta roja',
    ownGoal: 'Gol en propia puerta',
    penalty: 'Penalti',
    goal: 'GOOOOOOOL',
    goalDisallowed: '',
    missedPenalty: 'Penalti fallado',
    hasStarted: 'ha comenzado',
    halfTime: 'DESCANSO',
    hydrationBreak: '',
    hydrationResume: '',
    fullTime: 'TIEMPO REGLAMENTARIO',
    hasResumed: 'ha reanudado',
    endOf1stET: 'FIN DE LA PRÓRROGA 1',
    endOf2ndET: 'FIN DE LA PRÓRROGA 2',
    endOfPenaltyShootout: 'LA TANDA DE PENALTIS',
    penaltyPeriod: '',
    substitution: '',
    weatherDelay: '',
  },
};
