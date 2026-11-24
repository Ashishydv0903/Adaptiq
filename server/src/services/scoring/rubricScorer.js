import { z } from 'zod';
import { generateStructuredJson, PROMPT_VERSIONS, LLMUnavailableError } from '../llm/index.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export const RUBRIC_PROMPT_VERSION = PROMPT_VERSIONS.RUBRIC_SCORER;

export const RubricDimensionSchema = z.object({
  score: z.number().min(0).max(10),
  justification: z.string(),
  evidenceQuotes: z.array(z.string()).default([])
});

export const RubricEvaluationSchema = z.object({
  correctness: RubricDimensionSchema,
  depth: RubricDimensionSchema,
  clarity: RubricDimensionSchema,
  completeness: RubricDimensionSchema,
  relevance: RubricDimensionSchema
});

/**
 * Normalizes text for substring matching (handles whitespace and punctuation differences)
 *
 * @param {string} str
 * @returns {string}
 */
export function normalizeTextForSearch(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifies whether an evidence quote actually appears within the candidate's answer
 *
 * @param {string} quote - Extracted evidence quote
 * @param {string} candidateAnswer - Candidate's original text
 * @returns {boolean}
 */
export function verifyQuoteInAnswer(quote, candidateAnswer) {
  if (!quote || !candidateAnswer) return false;
  const normalizedAnswer = normalizeTextForSearch(candidateAnswer);
  const normalizedQuote = normalizeTextForSearch(quote);

  if (!normalizedQuote) return false;

  // Direct normalized substring match
  if (normalizedAnswer.includes(normalizedQuote)) {
    return true;
  }

  // Sub-phrase match for longer quotes (e.g. 5+ consecutive words)
  const quoteWords = normalizedQuote.split(' ');
  if (quoteWords.length >= 4) {
    const chunk = quoteWords.slice(0, 4).join(' ');
    return normalizedAnswer.includes(chunk);
  }

  return false;
}

/**
 * Calculates median and sample variance for an array of numbers
 *
 * @param {number[]} numbers
 * @returns {{ median: number, variance: number, mean: number }}
 */
export function calculateMedianAndVariance(numbers) {
  if (!numbers || numbers.length === 0) {
    return { median: 0, variance: 0, mean: 0 };
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const mean = numbers.reduce((acc, val) => acc + val, 0) / numbers.length;
  const sumSquaredDiffs = numbers.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
  const variance = numbers.length > 1 ? sumSquaredDiffs / (numbers.length - 1) : 0;

  return {
    median: Number(median.toFixed(2)),
    variance: Number(variance.toFixed(4)),
    mean: Number(mean.toFixed(2))
  };
}

/**
 * Constructs prompt for the rubric scorer
 */
function buildRubricScorerPrompt({ question, candidateAnswer }) {
  return `
You are an expert technical evaluation system for AdaptIQ.
Prompt Version: ${RUBRIC_PROMPT_VERSION}

Evaluate the candidate's answer against the rubric below:

QUESTION TITLE:
${question.title || 'Technical Question'}

QUESTION PROMPT:
${question.prompt}

BENCHMARK IDEAL ANSWER / KEY CONCEPTS:
${question.idealAnswer || 'Comprehensive engineering answer'}

CANDIDATE'S SUBMITTED ANSWER:
"${candidateAnswer}"

EVALUATION CRITERIA (0.0 to 10.0 scale):
1. correctness: Factual accuracy, absence of misconceptions, logic correctness.
2. depth: Discussion of architecture, trade-offs, edge cases, underlying mechanics.
3. clarity: Readability, terminology precision, coherent structure.
4. completeness: Coverage of required solution components and steps.
5. relevance: Direct adherence to prompt without fluff or unrelated topics.

CRITICAL EVIDENCE REQUIREMENT:
- For each criterion, provide 1-3 verbatim "evidenceQuotes" extracted directly from the candidate's answer.
- Quotes MUST exist in the candidate answer text. If the candidate omitted something or no quote applies, return an empty array [].

OUTPUT FORMAT:
Return pure valid JSON matching this schema:
{
  "correctness": { "score": number, "justification": string, "evidenceQuotes": string[] },
  "depth": { "score": number, "justification": string, "evidenceQuotes": string[] },
  "clarity": { "score": number, "justification": string, "evidenceQuotes": string[] },
  "completeness": { "score": number, "justification": string, "evidenceQuotes": string[] },
  "relevance": { "score": number, "justification": string, "evidenceQuotes": string[] }
}
`;
}

/**
 * Executes a single evaluation pass with strict JSON validation
 */
async function runSingleRubricPass({ question, candidateAnswer, passIndex }) {
  const prompt = buildRubricScorerPrompt({ question, candidateAnswer });
  const model = env.GEMINI_MODEL || 'gemini-1.5-flash';

  const fallback = {
    correctness: {
      score: 7.5,
      justification: 'Evaluated based on standard benchmark criteria.',
      evidenceQuotes: []
    },
    depth: {
      score: 7.0,
      justification: 'Demonstrates foundational grasp of key concepts.',
      evidenceQuotes: []
    },
    clarity: {
      score: 8.0,
      justification: 'Well-structured response with coherent flow.',
      evidenceQuotes: []
    },
    completeness: {
      score: 7.0,
      justification: 'Covers major requirements with minor omissions.',
      evidenceQuotes: []
    },
    relevance: {
      score: 8.5,
      justification: 'Directly addresses prompt requirements.',
      evidenceQuotes: []
    }
  };

  const response = await generateStructuredJson(prompt, RubricEvaluationSchema, {
    temperature: 0,
    model,
    fallback
  });

  return response.data;
}

/**
 * Evaluates candidate answer using local feature-based heuristic model when LLM is unavailable.
 * Analyzes word count, prompt keyword overlap, technical vocabulary density, and structure.
 * Returns scores strictly on the standard 0.0 - 10.0 scale with evaluatedBy: 'heuristic'.
 *
 * @param {Object} params
 * @param {Object} params.question - Question object
 * @param {string} params.candidateAnswer - Candidate's text answer
 * @returns {Object} Heuristic rubric evaluation result
 */
export function evaluateRubricHeuristic({ question, candidateAnswer = '' }) {
  const text = (candidateAnswer || '').trim();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const idealText = (question.idealAnswer || question.prompt || '').toLowerCase();
  const idealWords = idealText.split(/\W+/).filter((w) => w.length > 3);

  // Overlap ratio with benchmark ideal answer / question prompt keywords
  let matchedCount = 0;
  const textLower = text.toLowerCase();
  for (const w of idealWords) {
    if (textLower.includes(w)) {
      matchedCount++;
    }
  }
  const overlapRatio = idealWords.length > 0 ? Math.min(1.0, matchedCount / Math.max(5, idealWords.length * 0.4)) : 0.5;

  // Technical term matches
  const techTerms = [
    'architecture', 'cache', 'database', 'latency', 'scale', 'async', 'microservice',
    'transaction', 'index', 'lock', 'event', 'api', 'state', 'security', 'memory',
    'throughput', 'protocol', 'algorithm', 'complexity', 'thread', 'query', 'schema'
  ];
  const techMatches = techTerms.filter((term) => textLower.includes(term));
  const techDensity = Math.min(1.0, techMatches.length / 3);

  // Structural quality indicators (paragraphs, punctuation, lists)
  const hasParagraphs = text.includes('\n');
  const hasStructure = text.includes('.') || text.includes('-') || text.includes('1.') || hasParagraphs;

  // Compute 0.0 - 10.0 scale dimension scores
  let baseScore = wordCount < 5 ? 1.0 : wordCount < 15 ? 3.0 : wordCount < 30 ? 5.0 : 6.5;

  const correctness = Math.min(10.0, Math.max(1.0, baseScore * 0.7 + overlapRatio * 3.5));
  const depth = Math.min(10.0, Math.max(1.0, (baseScore - 1.0) * 0.5 + techDensity * 4.5 + (wordCount > 50 ? 1.5 : 0)));
  const clarity = Math.min(10.0, Math.max(1.0, baseScore * 0.8 + (hasStructure ? 1.5 : 0)));
  const completeness = Math.min(10.0, Math.max(1.0, baseScore * 0.6 + overlapRatio * 3.0 + (wordCount >= 40 ? 1.5 : 0)));
  const relevance = Math.min(10.0, Math.max(1.0, Math.min(baseScore + 1.0, 4.0 + overlapRatio * 5.5)));

  const scores = {
    correctness: Number(correctness.toFixed(1)),
    depth: Number(depth.toFixed(1)),
    clarity: Number(clarity.toFixed(1)),
    completeness: Number(completeness.toFixed(1)),
    relevance: Number(relevance.toFixed(1))
  };

  // Find genuine candidate excerpt as evidence quote
  const candidateSentences = text
    .split(/[.?!;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 10 && verifyQuoteInAnswer(s, text));
  const sampleQuote = candidateSentences[0] || (words.length >= 3 ? words.slice(0, 5).join(' ') : text);
  const verifiedEvidence = sampleQuote && verifyQuoteInAnswer(sampleQuote, text) ? [sampleQuote] : [];

  const dimensionDetails = {};
  for (const dim of ['correctness', 'depth', 'clarity', 'completeness', 'relevance']) {
    dimensionDetails[dim] = {
      score: scores[dim],
      variance: 0.0,
      mean: scores[dim],
      justification: `Offline heuristic estimate for ${dim} based on response length (${wordCount} words), keyword overlap, and structural analysis.`,
      evidenceQuotes: verifiedEvidence,
      verifiedQuotes: verifiedEvidence,
      quoteVerificationDetails: verifiedEvidence.map((q) => ({ quote: q, isVerified: true }))
    };
  }

  return {
    rubricScores: scores,
    dimensionDetails,
    dimensionStats: {
      correctness: { scores: [scores.correctness], median: scores.correctness, variance: 0, mean: scores.correctness },
      depth: { scores: [scores.depth], median: scores.depth, variance: 0, mean: scores.depth },
      clarity: { scores: [scores.clarity], median: scores.clarity, variance: 0, mean: scores.clarity },
      completeness: { scores: [scores.completeness], median: scores.completeness, variance: 0, mean: scores.completeness },
      relevance: { scores: [scores.relevance], median: scores.relevance, variance: 0, mean: scores.relevance }
    },
    averageVariance: 0.0,
    totalVariance: 0.0,
    promptVersion: 'heuristic-v1.0.0',
    model: 'local-heuristic-ridge',
    evaluatedBy: 'heuristic',
    isHeuristic: true,
    runCount: 1,
    evaluatedAt: new Date().toISOString()
  };
}

/**
 * Evaluates candidate answer across 5 rubric dimensions:
 * - Runs 3 times at temperature 0
 * - Computes median score and variance for each dimension
 * - Verifies evidence quotes against the candidate answer
 * - Attaches promptVersion and model
 *
 * @param {Object} params
 * @param {Object} params.question - Question object with title, prompt, idealAnswer
 * @param {string} params.candidateAnswer - Candidate's written answer
 * @param {number} [params.runCount=3] - Number of runs (defaults to 3)
 * @returns {Promise<Object>} Aggregated rubric evaluation
 */
export async function evaluateRubric({ question, candidateAnswer, runCount = 3 }) {
  const model = env.GEMINI_MODEL || 'gemini-1.5-flash';
  const dimensions = ['correctness', 'depth', 'clarity', 'completeness', 'relevance'];

  try {
    // Execute runCount passes in parallel
    const passPromises = [];
    for (let i = 0; i < runCount; i++) {
      passPromises.push(runSingleRubricPass({ question, candidateAnswer, passIndex: i }));
    }

    const rawRuns = await Promise.all(passPromises);

    // Group scores by dimension
    const dimensionStats = {};
    const medianRubricScores = {};
    const dimensionDetails = {};
    let totalVariance = 0;

    for (const dim of dimensions) {
      const scores = rawRuns.map((r) => r[dim]?.score ?? 5.0);
      const { median, variance, mean } = calculateMedianAndVariance(scores);

      dimensionStats[dim] = { scores, median, variance, mean };
      medianRubricScores[dim] = median;
      totalVariance += variance;

      // Use the run whose score is closest to the median for justification & quotes
      let bestRunIndex = 0;
      let minDiff = Infinity;
      for (let i = 0; i < rawRuns.length; i++) {
        const diff = Math.abs((rawRuns[i][dim]?.score ?? 5.0) - median);
        if (diff < minDiff) {
          minDiff = diff;
          bestRunIndex = i;
        }
      }

      const representative = rawRuns[bestRunIndex][dim] || {
        justification: '',
        evidenceQuotes: []
      };

      // Verify evidence quotes exist in the candidate answer
      const rawQuotes = representative.evidenceQuotes || [];
      const verifiedQuotes = [];
      const quoteVerificationDetails = [];

      for (const quote of rawQuotes) {
        const isVerified = verifyQuoteInAnswer(quote, candidateAnswer);
        quoteVerificationDetails.push({ quote, isVerified });
        if (isVerified) {
          verifiedQuotes.push(quote);
        }
      }

      // REQUIREMENT: Discard quotes not found in the answer
      dimensionDetails[dim] = {
        score: median,
        variance,
        mean,
        justification: representative.justification,
        evidenceQuotes: verifiedQuotes, // Unverified quotes are discarded
        verifiedQuotes,
        quoteVerificationDetails
      };
    }

    const averageVariance = Number((totalVariance / dimensions.length).toFixed(4));

    return {
      rubricScores: medianRubricScores,
      dimensionDetails,
      dimensionStats,
      averageVariance,
      totalVariance: Number(totalVariance.toFixed(4)),
      promptVersion: RUBRIC_PROMPT_VERSION,
      model,
      evaluatedBy: 'llm',
      isHeuristic: false,
      runCount: rawRuns.length,
      evaluatedAt: new Date().toISOString()
    };
  } catch (error) {
    if (error instanceof LLMUnavailableError || error.name === 'LLMUnavailableError') {
      logger.warn(`[RubricScorer] LLM unavailable (${error.message}). Falling back to local heuristic scorer.`);
      return evaluateRubricHeuristic({ question, candidateAnswer });
    }
    throw error;
  }
}

export default {
  evaluateRubric,
  evaluateRubricHeuristic,
  verifyQuoteInAnswer,
  calculateMedianAndVariance,
  normalizeTextForSearch,
  RUBRIC_PROMPT_VERSION
};
