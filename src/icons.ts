export type IconName =
  | 'collision'
  | 'exclamation'
  | 'face_palm'
  | 'large_yellow_square'
  | 'large_red_square'
  | 'no_good'
  | 'runner'
  | 'soccer'
  | 'stopwatch'
  | 'toilet'
  | 'zap';

const Icon: Record<IconName, string> = {
  collision: ':collision:',
  exclamation: ':exclamation:',
  face_palm: ':face_palm:',
  large_yellow_square: ':large_yellow_square',
  large_red_square: ':large_red_square',
  no_good: ':no_good:',
  runner: ':runner:',
  soccer: ':soccer:',
  stopwatch: ':stopwatch:',
  toilet: ':toilet:',
  zap: ':zap:',
};

export default Icon;
