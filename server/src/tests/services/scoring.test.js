import { z } from 'zod';
import {
  extractJsonFromText,
  generateStructuredJson,
  computeLocalDeterministicEmbedding,
  PROMPT_VERSIONS
} from '../../services/llm/index.js';
import {
  verifyQuoteInAnswer,
  calculateMedianAndVariance,
  evaluateRubric,
  RUBRIC_PROMPT_VERSION
} from '../../services/scoring/rubricScorer.js';
import { detectConceptCoverage } from '../../services/scoring/conceptCoverage.js';
import { generateConceptCounterfactuals } from '../../services/scoring/counterfactual.js';
import { executeScoringPipeline, generateModelAnswerDiff } from '../../services/scoring/index.js';

describe('Scoring Pipeline & Explainable AI (XAI) Services', () => {
  describe('LLM Adapter & Strict-JSON Helper', () => {
    test('extractJsonFromText strips markdown code fences and whitespace cleanly', () => {
      const fenced = '```json\n{"correctness": 8.5, "depth": 7.0}\n```';
      expect(extractJsonFromText(fenced)).toBe('{"correctness": 8.5, "depth": 7.0}');

      const preamble = 'Here is the response:\n{"score": 90}\nHope this helps!';
      expect(extractJsonFromText(preamble)).toBe('{"score": 90}');
    });

    test('generateStructuredJson validates against Zod schema and returns structured data', async () => {
      const testSchema = z.object({
        status: z.string(),
        fallback: z.boolean().optional()
      });

      const result = await generateStructuredJson('Generate status JSON', testSchema, {
        temperature: 0,
        fallback: { status: 'ok', fallback: true }
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBeDefined();
    });

    test('computeLocalDeterministicEmbedding produces normalized unit vectors (norm = 1.0)', () => {
      const text = 'Idempotent Payment Endpoint Design in Express and MongoDB';
      const vec = computeLocalDeterministicEmbedding(text, 64);

      expect(vec.length).toBe(64);
      let normSq = 0;
      for (const val of vec) normSq += val * val;
      expect(Math.sqrt(normSq)).toBeCloseTo(1.0, 2);
    });
  });

  describe('Rubric Scorer & Quote Verification', () => {
    const candidateAnswer =
      'To prevent double charges, we require a unique Idempotency-Key UUID header from the client. In Express middleware, we atomically insert status=PROCESSING into MongoDB with a TTL lock. If network retries happen, we return 409 Conflict.';

    test('verifyQuoteInAnswer correctly identifies verbatim and normalized phrases', () => {
      expect(verifyQuoteInAnswer('unique Idempotency-Key UUID header', candidateAnswer)).toBe(true);
      expect(verifyQuoteInAnswer('atomically insert status=PROCESSING', candidateAnswer)).toBe(true);
      expect(verifyQuoteInAnswer('return 409 Conflict', candidateAnswer)).toBe(true);
    });

    test('verifyQuoteInAnswer rejects fabricated or hallucinated quotes', () => {
      expect(verifyQuoteInAnswer('we use Redis distributed Redlock algorithm', candidateAnswer)).toBe(false);
      expect(verifyQuoteInAnswer('Kafka message queue consumer', candidateAnswer)).toBe(false);
      expect(verifyQuoteInAnswer('', candidateAnswer)).toBe(false);
    });

    test('calculateMedianAndVariance accurately computes statistics across runs', () => {
      // 3 runs with identical scores (temperature 0)
      const identicalStats = calculateMedianAndVariance([8.0, 8.0, 8.0]);
      expect(identicalStats.median).toBe(8.0);
      expect(identicalStats.variance).toBe(0.0);

      // Divergent scores: [7.0, 8.0, 9.0] -> median 8.0, mean 8.0, variance 1.0
      const divergentStats = calculateMedianAndVariance([7.0, 8.0, 9.0]);
      expect(divergentStats.median).toBe(8.0);
      expect(divergentStats.variance).toBe(1.0);
    });

    test('evaluateRubric executes multi-run consensus and includes promptVersion and model', async () => {
      const question = {
        title: 'Idempotent Payment Endpoint',
        prompt: 'How to build an idempotent payment endpoint?',
        idealAnswer: 'Use Idempotency-Key, distributed locking, atomic status transitions.'
      };

      const result = await evaluateRubric({
        question,
        candidateAnswer,
        runCount: 3
      });

      expect(result.runCount).toBe(3);
      expect(result.promptVersion).toBe(RUBRIC_PROMPT_VERSION);
      expect(result.model).toBeDefined();
      expect(result.rubricScores.correctness).toBeGreaterThan(0);
      expect(result.rubricScores.depth).toBeGreaterThan(0);
      expect(result.rubricScores.clarity).toBeGreaterThan(0);
      expect(result.rubricScores.completeness).toBeGreaterThan(0);
      expect(result.rubricScores.relevance).toBeGreaterThan(0);
      expect(typeof result.averageVariance).toBe('number');
    });
  });

  describe('Concept Coverage Detection & Counterfactuals', () => {
    const question = {
      title: 'Idempotent Payment Endpoint Design',
      prompt: 'How would you architect an idempotent payment processing endpoint?',
      keyConcepts: ['Idempotency-Key', 'Distributed Locking', 'Double Charge Prevention', 'Atomic Transactions'],
      idealAnswer: '1) Require client Idempotency-Key header. 2) Check unique index in Mongo. 3) Prevent double charge. 4) Use atomic transactions.'
    };

    const candidateAnswer =
      'We require client Idempotency-Key header to achieve Double Charge Prevention. If duplicate arrives, we reject.';

    test('detectConceptCoverage flags covered vs missing concepts and computes coverageRatio', async () => {
      const result = await detectConceptCoverage({ question, candidateAnswer });

      expect(result.concepts.length).toBe(4);
      expect(result.totalConcepts).toBe(4);
      expect(result.coverageRatio).toBeGreaterThan(0);
      expect(result.coverageRatio).toBeLessThanOrEqual(1.0);
      expect(result.promptVersion).toBeDefined();
      expect(result.semanticSimilarity).toBeGreaterThan(0);
    });

    test('generateConceptCounterfactuals simulates missing concepts with positive potential gain', () => {
      const conceptCoverage = {
        totalConcepts: 4,
        concepts: [
          { concept: 'Idempotency-Key', status: 'covered' },
          { concept: 'Distributed Locking', status: 'missing', explanation: 'No locking mechanism described' },
          { concept: 'Atomic Transactions', status: 'missing', explanation: 'Omitted database transactions' }
        ]
      };

      const currentFeatures = {
        correctness: 7.0,
        depth: 6.0,
        clarity: 8.0,
        completeness: 5.0,
        relevance: 8.0,
        conceptCoverage: 3.3, // 1 of 3 covered
        semanticSimilarity: 6.0
      };

      const currentScore = 60.0;

      const counterfactuals = generateConceptCounterfactuals({
        conceptCoverage,
        currentFeatures,
        currentScore
      });

      expect(counterfactuals.length).toBe(2);
      expect(counterfactuals[0].potentialGain).toBeGreaterThan(0);
      expect(counterfactuals[0].simulatedScore).toBeGreaterThan(currentScore);
      expect(counterfactuals[0].recommendation).toMatch(/gain around \+\d+ points/i);
    });
  });

  describe('Complete Scoring Pipeline Execution', () => {
    test('executeScoringPipeline produces end-to-end explainable evaluation', async () => {
      const question = {
        title: 'SSR Hydration Mismatch',
        prompt: 'What causes a React hydration mismatch error and how do you fix it?',
        keyConcepts: ['SSR Hydration', 'DOM Mismatch', 'Isomorphic Code', 'useEffect Deferral'],
        idealAnswer: 'Hydration mismatches happen when initial client render tree differs from server HTML (e.g. window references or Date.now()). Fixed by deferring browser-only values to useEffect.'
      };

      const candidateAnswer =
        'Hydration mismatches occur when server-rendered HTML differs from client initial DOM tree. For example, accessing window or browser dates. We resolve it by deferring browser logic inside useEffect.';

      const pipelineOutput = await executeScoringPipeline({
        question,
        candidateAnswer,
        telemetry: { tabSwitches: 1, durationSeconds: 45 }
      });

      expect(pipelineOutput.score).toBeGreaterThan(0);
      expect(pipelineOutput.score).toBeLessThanOrEqual(100);
      expect(pipelineOutput.promptVersion).toBe(PROMPT_VERSIONS.RUBRIC_SCORER);
      expect(pipelineOutput.model).toBeDefined();

      // Rubric
      expect(pipelineOutput.rubric.scores.correctness).toBeDefined();
      expect(pipelineOutput.rubric.details.correctness.justification).toBeDefined();
      expect(typeof pipelineOutput.rubric.variance).toBe('number');

      // Concept Coverage
      expect(pipelineOutput.conceptCoverage.concepts.length).toBe(4);
      expect(pipelineOutput.conceptCoverage.coverageRatio).toBeGreaterThan(0.3);

      // SHAP attributions
      expect(pipelineOutput.shap.attributions).toBeDefined();
      expect(pipelineOutput.shap.waterfall.length).toBeGreaterThan(1);
      expect(pipelineOutput.shap.efficiencyCheck.isBalanced).toBe(true);

      // Counterfactuals
      expect(Array.isArray(pipelineOutput.counterfactuals)).toBe(true);

      // Model answer diff
      expect(pipelineOutput.modelAnswerDiff.summary).toBeDefined();
    });
  });
});
