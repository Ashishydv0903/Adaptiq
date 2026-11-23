import { z } from 'zod';
import { generateStructuredJson, PROMPT_VERSIONS } from '../llm/index.js';
import { verifyQuoteInAnswer } from './rubricScorer.js';
import { env } from '../../config/env.js';

export const STAR_COMPONENTS = ['Situation', 'Task', 'Action', 'Result'];

export const StarComponentSchema = z.object({
  present: z.boolean(),
  score: z.number().min(0).max(10),
  evidenceQuote: z.string().default(''),
  feedback: z.string()
});

export const StarEvaluationSchema = z.object({
  situation: StarComponentSchema,
  task: StarComponentSchema,
  action: StarComponentSchema,
  result: StarComponentSchema,
  overallScore: z.number().min(0).max(100),
  missingComponents: z.array(z.enum(['Situation', 'Task', 'Action', 'Result'])),
  coachingTip: z.string()
});

/**
 * Builds prompt for the behavioral STAR framework evaluator
 */
function buildStarPrompt({ question, candidateAnswer }) {
  return `
You are a senior hiring bar raiser evaluating a candidate's behavioral interview response using the structured STAR framework.
Prompt Version: ${PROMPT_VERSIONS.RUBRIC_SCORER}

BEHAVIORAL QUESTION:
${question.title || 'Behavioral Question'}
${question.prompt}

CANDIDATE'S SUBMITTED RESPONSE:
"${candidateAnswer}"

EVALUATION TASK:
Analyze the response across the four pillars of the STAR framework:
1. Situation: Did the candidate set up the background context, company/team setting, and specific challenge?
2. Task: Did the candidate define their personal role, specific ownership, and what objective they were tasked with?
3. Action: Did the candidate articulate the concrete, personal engineering or collaborative actions THEY took (using 'I' rather than just 'we')?
4. Result: Did the candidate quantify or articulate the final outcome, business impact, metrics, or retrospective lessons learned?

REQUIREMENTS:
- For each component, provide:
  - present: true if clearly articulated, false if missing or severely deficient
  - score: 0.0 to 10.0 scale reflecting quality
  - evidenceQuote: verbatim substring from the candidate's answer supporting your judgment (or "" if missing)
  - feedback: concise 1-2 sentence assessment
- missingComponents: list which of ['Situation', 'Task', 'Action', 'Result'] are either missing or scored below 5.0.
- coachingTip: 1 actionable coaching recommendation on how to strengthen their STAR delivery.

Return pure JSON matching this schema:
{
  "situation": { "present": boolean, "score": number, "evidenceQuote": string, "feedback": string },
  "task": { "present": boolean, "score": number, "evidenceQuote": string, "feedback": string },
  "action": { "present": boolean, "score": number, "evidenceQuote": string, "feedback": string },
  "result": { "present": boolean, "score": number, "evidenceQuote": string, "feedback": string },
  "overallScore": number,
  "missingComponents": ["Situation" | "Task" | "Action" | "Result"],
  "coachingTip": string
}
`;
}

/**
 * Heuristic/deterministic fallback evaluator for behavioral responses in offline/test mode
 */
function getDeterministicStarFallback(candidateAnswer) {
  const text = candidateAnswer.toLowerCase();

  const hasSituation =
    text.includes('when') ||
    text.includes('at my') ||
    text.includes('project') ||
    text.includes('situation') ||
    text.includes('production') ||
    text.includes('team');

  const hasTask =
    text.includes('task') ||
    text.includes('responsible') ||
    text.includes('my role') ||
    text.includes('needed to') ||
    text.includes('goal');

  const hasAction =
    text.includes('i implemented') ||
    text.includes('i built') ||
    text.includes('i led') ||
    text.includes('i created') ||
    text.includes('i analyzed') ||
    text.includes('action') ||
    text.includes('i configured');

  const hasResult =
    text.includes('result') ||
    text.includes('percent') ||
    text.includes('%') ||
    text.includes('reduced') ||
    text.includes('increased') ||
    text.includes('outcome') ||
    text.includes('saved');

  const missing = [];
  if (!hasSituation) missing.push('Situation');
  if (!hasTask) missing.push('Task');
  if (!hasAction) missing.push('Action');
  if (!hasResult) missing.push('Result');

  const words = candidateAnswer.split(/\s+/).filter(Boolean);
  const sampleQuote = words.slice(0, 5).join(' ');

  const situationScore = hasSituation ? 8.0 : 3.5;
  const taskScore = hasTask ? 7.5 : 4.0;
  const actionScore = hasAction ? 8.5 : 4.5;
  const resultScore = hasResult ? 8.0 : 3.0;

  // Weighted composite score (Situation: 20%, Task: 20%, Action: 35%, Result: 25%)
  const overall = Math.round(
    situationScore * 2.0 + taskScore * 2.0 + actionScore * 3.5 + resultScore * 2.5
  );

  return {
    situation: {
      present: hasSituation,
      score: situationScore,
      evidenceQuote: hasSituation ? sampleQuote : '',
      feedback: hasSituation
        ? 'Context and problem context established clearly.'
        : 'Missing background details regarding the initial setting and scope.'
    },
    task: {
      present: hasTask,
      score: taskScore,
      evidenceQuote: hasTask ? sampleQuote : '',
      feedback: hasTask
        ? 'Defined role and objective effectively.'
        : 'Did not specify personal ownership versus overall team mandate.'
    },
    action: {
      present: hasAction,
      score: actionScore,
      evidenceQuote: hasAction ? sampleQuote : '',
      feedback: hasAction
        ? 'Detailed specific technical steps and decisions executed.'
        : 'Action steps lacked specificity on personal contributions.'
    },
    result: {
      present: hasResult,
      score: resultScore,
      evidenceQuote: hasResult ? sampleQuote : '',
      feedback: hasResult
        ? 'Articulated impact and technical outcome.'
        : 'Omitted quantified metrics and post-resolution business outcome.'
    },
    overallScore: Math.min(100, Math.max(0, overall)),
    missingComponents: missing,
    coachingTip:
      missing.length > 0
        ? `Strengthen your response by explicitly detailing the ${missing.join(
            ' and '
          )} dimension, particularly focusing on quantified impact metrics.`
        : 'Great structured delivery! Consider framing the result with long-term architectural benefits.'
  };
}

/**
 * Evaluates candidate behavioral response using the STAR framework
 *
 * @param {Object} params
 * @param {Object} params.question - Behavioral question record
 * @param {string} params.candidateAnswer - Candidate's text response
 * @returns {Promise<Object>} Structured STAR evaluation
 */
export async function evaluateStarResponse({ question, candidateAnswer }) {
  const model = env.GEMINI_MODEL || 'gemini-1.5-flash';
  const fallback = getDeterministicStarFallback(candidateAnswer);
  const prompt = buildStarPrompt({ question, candidateAnswer });

  let starData = fallback;

  try {
    const result = await generateStructuredJson(prompt, StarEvaluationSchema, {
      temperature: 0,
      model,
      fallback
    });
    starData = result.data || fallback;
  } catch (err) {
    starData = fallback;
  }

  // Quote verification on evidence quotes
  const components = ['situation', 'task', 'action', 'result'];
  for (const comp of components) {
    if (starData[comp]?.evidenceQuote) {
      starData[comp].isQuoteVerified = verifyQuoteInAnswer(
        starData[comp].evidenceQuote,
        candidateAnswer
      );
    }
  }

  return {
    ...starData,
    model,
    promptVersion: PROMPT_VERSIONS.RUBRIC_SCORER,
    evaluatedAt: new Date().toISOString()
  };
}

export default {
  evaluateStarResponse,
  STAR_COMPONENTS,
  StarEvaluationSchema
};
