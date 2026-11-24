import * as helpers from './helpers.js';
import * as start from './start.js';
import * as answer from './answer.js';
import * as evaluation from './evaluation.js';
import * as followUp from './followUp.js';
import * as coding from './coding.js';
import * as voice from './voice.js';
import * as report from './report.js';
import * as practice from './practice.js';

export * from './helpers.js';
export * from './start.js';
export * from './answer.js';
export * from './evaluation.js';
export * from './followUp.js';
export * from './coding.js';
export * from './voice.js';
export * from './report.js';
export * from './practice.js';

const sessionController = {
  ...helpers,
  ...start,
  ...answer,
  ...evaluation,
  ...followUp,
  ...coding,
  ...voice,
  ...report,
  ...practice
};

export default sessionController;
