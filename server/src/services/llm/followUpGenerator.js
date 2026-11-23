import { z } from 'zod';
import { generateStructuredJson, PROMPT_VERSIONS } from './index.js';
import { env } from '../../config/env.js';

export const FOLLOW_UP_TYPES = [
  'clarify',
  'go_deeper',
  'edge_case',
  'real_world_example',
  'trade_off'
];

export const MAX_FOLLOW_UPS_PER_QUESTION = 2;

export const FollowUpResultSchema = z.object({
  shouldFollowUp: z.boolean(),
  type: z.enum(['clarify', 'go_deeper', 'edge_case', 'real_world_example', 'trade_off']),
  followUpPrompt: z.string().min(5),
  contextRationale: z.string(),
  expectedFocus: z.string()
});

/**
 * Builds the prompt for generating context-aware follow-up questions
 */
function buildFollowUpPrompt({ question, candidateAnswer, previousFollowUps = [] }) {
  const previousTypes = previousFollowUps.map((f) => f.type).join(', ') || 'None';
  const followUpIndex = previousFollowUps.length + 1;

  return `
You are an expert technical interviewer conducting an adaptive engineering assessment on AdaptIQ.
Prompt Version: ${PROMPT_VERSIONS.RUBRIC_SCORER}

QUESTION TITLE:
${question.title || 'Technical Question'}

QUESTION PROMPT:
${question.prompt}

IDEAL BENCHMARK ANSWER & KEY CONCEPTS:
${question.idealAnswer || 'Comprehensive architectural answer'}

CANDIDATE'S SUBMITTED ANSWER:
"${candidateAnswer}"

PREVIOUS FOLLOW-UP TYPES ALREADY ASKED:
${previousTypes}

FOLLOW-UP ATTEMPT:
Question #${followUpIndex} of max ${MAX_FOLLOW_UPS_PER_QUESTION}

TASK:
Analyze the candidate's answer and generate ONE targeted follow-up question. Choose the single most effective category:
1. "clarify": The candidate made an ambiguous, imprecise, or contradictory claim that requires explanation.
2. "go_deeper": The candidate stated high-level concepts (e.g. "use Redis") without explaining underlying mechanics or data structures.
3. "edge_case": Probe how their architecture handles failures, network timeouts, race conditions, concurrent writes, or split-brain.
4. "real_world_example": Ask how they would apply or debug this in a production telemetry / microservices environment.
5. "trade_off": Probe trade-offs (e.g. latency vs consistency, memory vs CPU, eventual vs strong consistency).

REQUIREMENTS:
- Do NOT repeat previously asked follow-up types (${previousTypes}).
- Make the follow-up question sharp, technical, and directly tied to what the candidate actually wrote.
- Return pure valid JSON conforming strictly to the schema.

Return pure JSON matching this schema:
{
  "shouldFollowUp": true,
  "type": "clarify" | "go_deeper" | "edge_case" | "real_world_example" | "trade_off",
  "followUpPrompt": "Direct, engaging technical follow-up question addressed to the candidate",
  "contextRationale": "Why this specific follow-up was selected based on gaps in their response",
  "expectedFocus": "What key engineering principles the candidate should demonstrate in their reply"
}
`;
}

/**
 * Deterministic fallback generator for follow-up questions in test or offline modes
 */
function getDeterministicFallback({ question, candidateAnswer, previousFollowUps = [] }) {
  const askedTypes = new Set(previousFollowUps.map((f) => f.type));
  const availableTypes = FOLLOW_UP_TYPES.filter((t) => !askedTypes.has(t));
  const selectedType = availableTypes[0] || 'edge_case';

  const fallbacksByType = {
    edge_case: {
      type: 'edge_case',
      followUpPrompt:
        'What failure recovery mechanism or distributed lock would you implement if two concurrent requests with the identical transaction key arrive simultaneously before the first completes?',
      contextRationale: 'Probes concurrency and race condition mitigation under peak distributed load.',
      expectedFocus: 'Distributed locking, mutex/TTL keys in Redis, and atomic database check-and-set operations.'
    },
    go_deeper: {
      type: 'go_deeper',
      followUpPrompt:
        'Could you explain the underlying memory and execution mechanics of your proposed solution when scaled to thousands of operations per second?',
      contextRationale: 'Explores operational internals beneath high-level framework abstractions.',
      expectedFocus: 'Event loop concurrency, indexing algorithms (B-Tree/LSM), and memory buffer management.'
    },
    trade_off: {
      type: 'trade_off',
      followUpPrompt:
        'What are the primary performance, consistency, and maintenance trade-offs of this approach versus an event-driven asynchronous queue (e.g. Kafka or RabbitMQ)?',
      contextRationale: 'Assesses architectural maturity and awareness of design alternatives.',
      expectedFocus: 'Latency vs throughput, eventual consistency models, and operational operational overhead.'
    },
    real_world_example: {
      type: 'real_world_example',
      followUpPrompt:
        'How would you instrument distributed tracing and error alerting (e.g. with OpenTelemetry) to monitor this in a production Kubernetes environment?',
      contextRationale: 'Evaluates production readiness and observability practices.',
      expectedFocus: 'Span propagation, structured telemetry logs, and circuit breaker patterns.'
    },
    clarify: {
      type: 'clarify',
      followUpPrompt:
        'In your response, could you clarify how you guarantee exactly-once processing across downstream third-party webhook integrations?',
      contextRationale: 'Clarifies boundary guarantees when external webhooks retry unreliably.',
      expectedFocus: 'Deduplication windows, idempotency persistence, and idempotent webhook acknowledgment.'
    }
  };

  const choice = fallbacksByType[selectedType] || fallbacksByType.edge_case;

  return {
    shouldFollowUp: true,
    type: choice.type,
    followUpPrompt: choice.followUpPrompt,
    contextRationale: choice.contextRationale,
    expectedFocus: choice.expectedFocus
  };
}

/**
 * Generates an adaptive LLM follow-up question based on candidate's answer
 * Enforces maximum of 2 follow-ups per question.
 *
 * @param {Object} params
 * @param {Object} params.question - Current question record
 * @param {string} params.candidateAnswer - Candidate's previous response
 * @param {Array<Object>} [params.previousFollowUps=[]] - Existing follow-ups for this question
 * @returns {Promise<Object>} Follow-up generation decision and prompt
 */
export async function generateFollowUp({
  question,
  candidateAnswer,
  previousFollowUps = []
}) {
  // Enforce Max 2 follow-ups per question constraint
  if (previousFollowUps && previousFollowUps.length >= MAX_FOLLOW_UPS_PER_QUESTION) {
    return {
      shouldFollowUp: false,
      followUpIndex: previousFollowUps.length,
      maxReached: true,
      reason: `Maximum of ${MAX_FOLLOW_UPS_PER_QUESTION} follow-ups reached for this question.`
    };
  }

  // MCQs do not receive conversational follow-ups
  if (question.roundType === 'mcq') {
    return {
      shouldFollowUp: false,
      reason: 'MCQ questions do not require conversational follow-ups.'
    };
  }

  const model = env.GEMINI_MODEL || 'gemini-1.5-flash';
  const fallback = getDeterministicFallback({ question, candidateAnswer, previousFollowUps });
  const prompt = buildFollowUpPrompt({ question, candidateAnswer, previousFollowUps });

  try {
    const result = await generateStructuredJson(prompt, FollowUpResultSchema, {
      temperature: 0,
      model,
      fallback
    });

    const data = result.data || fallback;

    return {
      shouldFollowUp: data.shouldFollowUp !== false,
      followUpIndex: previousFollowUps.length + 1,
      maxAllowed: MAX_FOLLOW_UPS_PER_QUESTION,
      type: data.type,
      followUpPrompt: data.followUpPrompt,
      contextRationale: data.contextRationale,
      expectedFocus: data.expectedFocus,
      model,
      retries: result.retries || 0
    };
  } catch (err) {
    return {
      shouldFollowUp: true,
      followUpIndex: previousFollowUps.length + 1,
      maxAllowed: MAX_FOLLOW_UPS_PER_QUESTION,
      ...fallback,
      model,
      isFallback: true
    };
  }
}

export default {
  generateFollowUp,
  FOLLOW_UP_TYPES,
  MAX_FOLLOW_UPS_PER_QUESTION,
  FollowUpResultSchema
};
