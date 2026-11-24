/**
 * @file Phase R3: Honest AI Layer, Scale Consistency & Model Configuration Tests
 * Verifies:
 * 1. Typed LLMUnavailableError thrown when LLM is down / key unconfigured
 * 2. Rubric scorer heuristic fallback with evaluatedBy: 'heuristic' & confidence capped at 0.4
 * 3. Valid LLM evaluation returning evaluatedBy: 'llm'
 * 4. Discarding of hallucinated / unverified quotes not in candidate text
 * 5. Scale consistency across rubric prompt, Zod schema, SHAP baseline, and weights (0-10)
 * 6. Model metadata tracking on embeddings & cosine similarity mismatch warning
 * 7. AI Health check endpoint GET /api/health/ai
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../app.js';
import {
  generateText,
  generateEmbedding,
  generateEmbeddingWithMetadata,
  checkAIHealth,
  LLMUnavailableError
} from '../../services/llm/index.js';
import {
  evaluateRubric,
  evaluateRubricHeuristic,
  verifyQuoteInAnswer,
  RubricDimensionSchema,
  RUBRIC_PROMPT_VERSION
} from '../../services/scoring/rubricScorer.js';
import { executeScoringPipeline } from '../../services/scoring/index.js';
import { calculateEvaluationConfidence } from '../../services/scoring/confidenceScorer.js';
import {
  calculateCosineSimilarity,
  DEFAULT_RIDGE_WEIGHTS,
  DEFAULT_RIDGE_BASELINE
} from '../../ml/scoringModel.js';
import { reembedAllDocuments } from '../../scripts/reembed.js';
import { Question } from '../../models/Question.js';
import { Skill } from '../../models/Skill.js';
import { env } from '../../config/env.js';

describe('Phase R3: Honest AI Layer & Scale Consistency Suite', () => {
  const sampleQuestion = {
    title: 'Distributed Mutex & Distributed Caching',
    prompt: 'How do you design a distributed locking mechanism with Redis?',
    idealAnswer:
      'Acquire a lock using SET resource_name my_random_value NX PX 30000. Release the lock via Lua script verifying random token.'
  };

  const sampleAnswer =
    'We use Redis SET NX PX with a unique UUID token to guarantee mutual exclusion across instances. When unlocking, we execute a Lua script ensuring atomic check-and-delete.';

  describe('1. Typed LLMUnavailableError & No Silent Fake Scores', () => {
    test('generateText throws typed LLMUnavailableError when simulateUnavailable is set', async () => {
      await expect(
        generateText('Test prompt', { simulateUnavailable: true })
      ).rejects.toThrow(LLMUnavailableError);

      try {
        await generateText('Test prompt', { simulateUnavailable: true });
      } catch (err) {
        expect(err).toBeInstanceOf(LLMUnavailableError);
        expect(err.name).toBe('LLMUnavailableError');
        expect(err.code).toBe('LLM_UNAVAILABLE');
        expect(err.statusCode).toBe(503);
      }
    });

    test('Rubric Scorer catches LLM down and falls back to local heuristic model', async () => {
      process.env.SIMULATE_LLM_DOWN = 'true';

      try {
        const result = await evaluateRubric({
          question: sampleQuestion,
          candidateAnswer: sampleAnswer,
          runCount: 1
        });

        expect(result.evaluatedBy).toBe('heuristic');
        expect(result.isHeuristic).toBe(true);
        expect(result.model).toBe('local-heuristic-ridge');
        expect(result.rubricScores.correctness).toBeGreaterThan(0);
        expect(result.rubricScores.correctness).toBeLessThanOrEqual(10.0);
        expect(result.averageVariance).toBe(0);
      } finally {
        delete process.env.SIMULATE_LLM_DOWN;
      }
    });

    test('Confidence is capped at 0.40 and flagged for human review when evaluatedBy is heuristic', () => {
      const conf = calculateEvaluationConfidence({
        rubricVariance: 0,
        conceptCoverageRatio: 0.9,
        wordCount: 50,
        semanticSimilarity: 0.85,
        integrityScore: 100,
        evaluatedBy: 'heuristic'
      });

      expect(conf.evaluatedBy).toBe('heuristic');
      expect(conf.confidenceScore).toBeLessThanOrEqual(0.40);
      expect(conf.confidenceLevel).toBe('LOW');
      expect(conf.shouldFlagForHumanReview).toBe(true);
      expect(conf.flagReason).toMatch(/heuristic estimate/i);
    });

    test('Real LLM evaluation yields evaluatedBy: "llm" with uncapped confidence', async () => {
      const result = await evaluateRubric({
        question: sampleQuestion,
        candidateAnswer: sampleAnswer,
        runCount: 1
      });

      expect(result.evaluatedBy).toBe('llm');
      expect(result.isHeuristic).toBe(false);

      const conf = calculateEvaluationConfidence({
        rubricVariance: 0.1,
        conceptCoverageRatio: 0.8,
        wordCount: 40,
        semanticSimilarity: 0.8,
        integrityScore: 100,
        evaluatedBy: 'llm'
      });

      expect(conf.evaluatedBy).toBe('llm');
      expect(conf.confidenceScore).toBeGreaterThan(0.40);
      expect(conf.confidenceLevel).toBe('HIGH');
    });

    test('Complete pipeline reflects evaluatedBy: "heuristic" when LLM is unavailable', async () => {
      process.env.SIMULATE_LLM_DOWN = 'true';
      try {
        const pipelineOutput = await executeScoringPipeline({
          question: sampleQuestion,
          candidateAnswer: sampleAnswer
        });

        expect(pipelineOutput.evaluatedBy).toBe('heuristic');
        expect(pipelineOutput.isHeuristic).toBe(true);
        expect(pipelineOutput.model).toBe('local-heuristic-ridge');
      } finally {
        delete process.env.SIMULATE_LLM_DOWN;
      }
    });
  });

  describe('2. Discarding Unverified Quotes Not in Candidate Answer', () => {
    test('verifyQuoteInAnswer accepts real substring excerpts from answer', () => {
      expect(verifyQuoteInAnswer('Redis SET NX PX with a unique UUID', sampleAnswer)).toBe(true);
      expect(verifyQuoteInAnswer('atomic check-and-delete', sampleAnswer)).toBe(true);
    });

    test('discard unverified / fabricated quote not found in answer text', () => {
      const fabricatedQuote = 'we use Zookeeper distributed lock leader election';
      expect(verifyQuoteInAnswer(fabricatedQuote, sampleAnswer)).toBe(false);

      // Heuristic evaluation discards any fabricated quote
      const heuristicResult = evaluateRubricHeuristic({
        question: sampleQuestion,
        candidateAnswer: sampleAnswer
      });

      for (const dim of ['correctness', 'depth', 'clarity', 'completeness', 'relevance']) {
        const quotes = heuristicResult.dimensionDetails[dim].evidenceQuotes;
        for (const q of quotes) {
          expect(verifyQuoteInAnswer(q, sampleAnswer)).toBe(true);
        }
      }
    });
  });

  describe('3. Scale Consistency (0-10 Scale Everywhere)', () => {
    test('RubricDimensionSchema validates scores strictly within [0, 10]', () => {
      expect(() => RubricDimensionSchema.parse({ score: 8.5, justification: 'Good' })).not.toThrow();
      expect(() => RubricDimensionSchema.parse({ score: 0.0, justification: 'Poor' })).not.toThrow();
      expect(() => RubricDimensionSchema.parse({ score: 10.0, justification: 'Perfect' })).not.toThrow();

      // Negative or >10 must fail
      expect(() => RubricDimensionSchema.parse({ score: -1, justification: 'Bad' })).toThrow();
      expect(() => RubricDimensionSchema.parse({ score: 11, justification: 'Too high' })).toThrow();
    });

    test('SHAP baseline benchmarks are all calibrated to 5.0 (out of 10.0)', () => {
      for (const [key, val] of Object.entries(DEFAULT_RIDGE_BASELINE)) {
        expect(val).toBe(5.0);
      }
    });

    test('Ridge regression weights sum to 10.0, scaling [0, 10] features to [0, 100]', () => {
      const sumWeights = Object.values(DEFAULT_RIDGE_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(Number(sumWeights.toFixed(2))).toBe(10.0);
    });

    test('Heuristic scorer produces all 5 dimension scores within [1.0, 10.0]', () => {
      const result = evaluateRubricHeuristic({
        question: sampleQuestion,
        candidateAnswer: sampleAnswer
      });

      for (const [dim, score] of Object.entries(result.rubricScores)) {
        expect(score).toBeGreaterThanOrEqual(1.0);
        expect(score).toBeLessThanOrEqual(10.0);
      }
    });
  });

  describe('4. Embedding Model Metadata & Mismatch Warning', () => {
    test('generateEmbedding produces vector with model and dimension properties', async () => {
      const vec = await generateEmbedding('Redis Cache Architecture');
      expect(Array.isArray(vec)).toBe(true);
      expect(vec.length).toBeGreaterThan(0);
      expect(vec.model).toBeDefined();
      expect(vec.dimension).toBe(vec.length);
    });

    test('generateEmbeddingWithMetadata produces full wrapper object', async () => {
      const emb = await generateEmbeddingWithMetadata('Database Indexing B-Tree');
      expect(Array.isArray(emb.vector)).toBe(true);
      expect(emb.model).toBeDefined();
      expect(emb.dimension).toBe(emb.vector.length);
      expect(emb.updatedAt).toBeInstanceOf(Date);
    });

    test('calculateCosineSimilarity warns and returns 0 when models mismatch', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const vecA = [0.6, 0.8];
      const vecB = [0.6, 0.8];

      // Incompatible models
      const sim = calculateCosineSimilarity(
        vecA,
        vecB,
        { model: 'gemini-embedding-001' },
        { model: 'local-deterministic-64' }
      );

      expect(sim).toBe(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('EMBEDDING MISMATCH')
      );

      warnSpy.mockRestore();
    });

    test('calculateCosineSimilarity warns and returns 0 when dimensions mismatch', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const vecA = [0.6, 0.8];
      const vecB = [0.6, 0.8, 0.0];

      const sim = calculateCosineSimilarity(vecA, vecB, { model: 'm1' }, { model: 'm1' });
      expect(sim).toBe(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('EMBEDDING DIMENSION MISMATCH')
      );

      warnSpy.mockRestore();
    });

    test('reembedAllDocuments updates questions and skills with current model and dimension', async () => {
      jest.spyOn(Question, 'find').mockResolvedValue([
        {
          title: 'Test Q',
          prompt: 'Test prompt',
          idealAnswer: 'Ideal',
          save: jest.fn().mockResolvedValue(true)
        }
      ]);
      jest.spyOn(Skill, 'find').mockResolvedValue([
        {
          name: 'Redis',
          description: 'Caching',
          category: 'Backend',
          save: jest.fn().mockResolvedValue(true)
        }
      ]);

      const result = await reembedAllDocuments();
      expect(result.questionCount).toBe(1);
      expect(result.skillCount).toBe(1);
      expect(result.embeddingModel).toBeDefined();

      jest.restoreAllMocks();
    });
  });

  describe('5. GET /api/health/ai Health Check Endpoint', () => {
    test('checkAIHealth reports UP or DEGRADED status with latency and model info', async () => {
      const health = await checkAIHealth();
      expect(health.provider).toBe('gemini');
      expect(health.model).toBeDefined();
      expect(health.embeddingModel).toBeDefined();
      expect(typeof health.latencyMs).toBe('number');
      expect(['UP', 'DEGRADED', 'DOWN']).toContain(health.status);
    });

    test('GET /api/health/ai route handler returns HTTP 200 with health details', async () => {
      const app = createApp();
      const routeLayer = app._router.stack.find(
        (layer) => layer.route && layer.route.path === '/api/health/ai'
      );
      expect(routeLayer).toBeDefined();
      expect(routeLayer.route.methods.get).toBe(true);

      const req = {};
      const res = {
        statusCode: 200,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json: jest.fn()
      };

      await routeLayer.route.stack[0].handle(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.json).toHaveBeenCalled();
      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(true);
      expect(body.data.provider).toBe('gemini');
      expect(body.data.model).toBeDefined();
      expect(body.data.embeddingModel).toBeDefined();
    });
  });
});
