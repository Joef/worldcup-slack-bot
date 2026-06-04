export enum LOCALE {
  FR = 'fr-FR',
  EN = 'en-GB',
  ES = 'es-ES',
}

export interface Translations {
  matchBetween: string;
  isAboutToStart: string;
  yellowCard: string;
  redCard: string;
  ownGoal: string;
  penalty: string;
  goal: string;
  missedPenalty: string;
  hasStarted: string;
  halfTime: string;
  fullTime: string;
  hasResumed: string;
  endOf1stET: string;
  endOf2ndET: string;
  endOfPenaltyShootout: string;
}

export const language: Record<LOCALE, Translations> = {
  [LOCALE.FR]: {
    matchBetween: "Le match",
    isAboutToStart: "est sur le point de commencer",
    yellowCard: "Carton jaune",
    redCard: "Carton rouge",
    ownGoal: "But contre son camp",
    penalty: "Pénalty",
    goal: "BUUUUUT",
    missedPenalty: "Pénalty manqué",
    hasStarted: "commence",
    halfTime: "Mi-temps",
    fullTime: "Fin de la 2e période",
    hasResumed: "a repris",
    endOf1stET: "Mi-temps de la prolongation",
    endOf2ndET: "Fin de la prolongation",
    endOfPenaltyShootout: "Fin de la séance de tirs au but",
  },
  [LOCALE.EN]: {
    matchBetween: "The match between",
    isAboutToStart: "is about to start",
    yellowCard: "Yellow card",
    redCard: "Red card",
    ownGoal: "Own goal",
    penalty: "Penalty",
    goal: "GOOOOAL",
    missedPenalty: "Missed penalty",
    hasStarted: "has started",
    halfTime: "HALF TIME",
    fullTime: "FULL TIME",
    hasResumed: "has resumed",
    endOf1stET: "END OF 1ST ET",
    endOf2ndET: "END OF 2ND ET",
    endOfPenaltyShootout: "END OF PENALTY SHOOTOUT",
  },
  [LOCALE.ES]: {
    matchBetween: "El partido entre",
    isAboutToStart: "está a punto de comenzar",
    yellowCard: "Tarjeta amarilla",
    redCard: "Tarjeta roja",
    ownGoal: "Gol en propia puerta",
    penalty: "Penalti",
    goal: "GOOOOOOOL",
    missedPenalty: "Penalti fallado",
    hasStarted: "ha comenzado",
    halfTime: "DESCANSO",
    fullTime: "TIEMPO REGLAMENTARIO",
    hasResumed: "ha reanudado",
    endOf1stET: "FIN DE LA PRÓRROGA 1",
    endOf2ndET: "FIN DE LA PRÓRROGA 2",
    endOfPenaltyShootout: "FIN DE LA TANDA DE PENALTIS",
  },
};
