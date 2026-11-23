import { frontendQuestions } from './frontendQuestions.js';
import { backendQuestions } from './backendQuestions.js';
import { fullstackQuestions } from './fullstackQuestions.js';
import { devopsQuestions } from './devopsQuestions.js';
import { datascienceQuestions } from './datascienceQuestions.js';
import { behavioralAndHrQuestions } from './behavioralAndHrQuestions.js';
import { codingQuestions } from './codingQuestions.js';

export const allQuestions = [
  ...frontendQuestions,
  ...backendQuestions,
  ...fullstackQuestions,
  ...devopsQuestions,
  ...datascienceQuestions,
  ...behavioralAndHrQuestions,
  ...codingQuestions
];

export default allQuestions;
