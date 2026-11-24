/**
 * @file Code Execution API Route & Verification Tests
 * Verifies HTTP 503 EXECUTION_UNAVAILABLE when Judge0 is unreachable,
 * verification of obviously wrong solutions yielding Wrong Answer,
 * and executionUnavailable session flagging.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import nock from 'nock';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { AssessmentSession } from '../../models/AssessmentSession.js';
import { Question } from '../../models/Question.js';
import { User } from '../../models/User.js';
import { ReviewQueueItem } from '../../models/ReviewQueueItem.js';
import { env } from '../../config/env.js';

describe('Phase R2: Code Execution Route & Controller Integration Tests', () => {
  let app;
  const mockUserId = '64b0f0000000000000000001';
  const mockSessionId = '64b0f0000000000000000099';
  const mockQuestionId = '64b0f0000000000000000088';

  const candidateToken = jwt.sign(
    { id: mockUserId, email: 'coder@adaptiq.ai', role: 'candidate' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const JUDGE0_BASE_URL = env.JUDGE0_API_URL || 'http://localhost:2358';

  const mockCodingQuestion = {
    _id: mockQuestionId,
    id: mockQuestionId,
    title: 'Python Palindrome Test Question',
    prompt: 'Return true if s is a palindrome, false otherwise.',
    track: 'backend',
    roundType: 'coding',
    difficultyLevel: 'easy',
    skillSlug: 'python-core',
    language: 'python',
    idealAnswer: 'Filter alphanumeric characters and compare to reversal.',
    testCases: [
      {
        input: '"racecar"',
        expectedOutput: 'true',
        isHidden: false
      },
      {
        input: '"hello"',
        expectedOutput: 'false',
        isHidden: false
      },
      {
        input: '"madam"',
        expectedOutput: 'true',
        isHidden: true
      }
    ]
  };

  let mockSessionState;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    nock.cleanAll();
    env.ALLOW_UNSAFE_LOCAL_EXEC = false;

    mockSessionState = {
      _id: mockSessionId,
      candidateId: mockUserId,
      userId: mockUserId,
      track: 'backend',
      status: 'in_progress',
      abilityTheta: 0.0,
      abilitySem: 0.5,
      percentileScore: 50,
      currentQuestionId: mockQuestionId,
      customQuestions: [mockCodingQuestion],
      responses: [],
      executionUnavailable: false,
      save: jest.fn().mockImplementation(async function () {
        return this;
      })
    };

    jest.spyOn(User, 'findById').mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: mockUserId,
        id: mockUserId,
        email: 'coder@adaptiq.ai',
        role: 'candidate'
      })
    });

    jest.spyOn(Question, 'findById').mockResolvedValue(mockCodingQuestion);
    jest.spyOn(Question, 'find').mockResolvedValue([mockCodingQuestion]);
    jest.spyOn(AssessmentSession, 'findById').mockImplementation(async () => mockSessionState);
    jest.spyOn(ReviewQueueItem, 'create').mockResolvedValue({ _id: 'queue_1' });
  });

  afterEach(() => {
    nock.cleanAll();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    nock.cleanAll();
    nock.restore();
  });

  describe('GET /api/health/judge0', () => {
    it('returns 200 with status UP when Judge0 responds to health probe', async () => {
      nock(JUDGE0_BASE_URL)
        .post('/submissions?base64_encoded=false&wait=true')
        .reply(200, {
          status: { id: 3, description: 'Accepted' },
          stdout: 'HEALTH_OK\n',
          time: '0.012',
          memory: 12000
        });

      const res = await request(app).get('/api/health/judge0');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('UP');
      expect(res.body.data.latencyMs).toBeGreaterThanOrEqual(1);
    });

    it('returns 503 with EXECUTION_UNAVAILABLE when Judge0 is down', async () => {
      nock(JUDGE0_BASE_URL)
        .post('/submissions?base64_encoded=false&wait=true')
        .replyWithError(new Error('connect ECONNREFUSED 127.0.0.1:2358'));

      const res = await request(app).get('/api/health/judge0');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EXECUTION_UNAVAILABLE');
      expect(res.body.data.status).toBe('DOWN');
    });
  });

  describe('POST /api/sessions/:id/execute-code', () => {
    it('VERIFY: submits obviously wrong Python solution, returns Wrong Answer with passed: false', async () => {
      nock(JUDGE0_BASE_URL)
        .persist()
        .post('/submissions?base64_encoded=false&wait=true')
        .reply(200, {
          status: { id: 4, description: 'Wrong Answer' },
          stdout: 'obviously_wrong_output\n',
          stderr: null,
          time: '0.021',
          memory: 14000
        });

      const res = await request(app)
        .post(`/api/sessions/${mockSessionId}/execute-code`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          questionId: mockQuestionId,
          code: 'def solution(s): return "obviously_wrong_output"',
          language: 'python',
          isSubmission: false
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.execution.allPassed).toBe(false);
      expect(res.body.data.execution.results[0].passed).toBe(false);
      expect(res.body.data.execution.results[0].status).toBe('Wrong Answer');
    });

    it('VERIFY: stops Judge0 / unreachable, returns HTTP 503 with EXECUTION_UNAVAILABLE', async () => {
      nock(JUDGE0_BASE_URL)
        .persist()
        .post('/submissions?base64_encoded=false&wait=true')
        .replyWithError(new Error('connect ECONNREFUSED 127.0.0.1:2358'));

      const res = await request(app)
        .post(`/api/sessions/${mockSessionId}/execute-code`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          questionId: mockQuestionId,
          code: 'def solution(s): return True',
          language: 'python',
          isSubmission: false
        });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EXECUTION_UNAVAILABLE');
      expect(res.body.message).toContain('Code execution is unavailable right now. Retry, or continue without running.');
    });
  });

  describe('POST /api/sessions/:id/answer for Coding Question', () => {
    it('when Judge0 is unreachable, returns 503 and flags session as executionUnavailable', async () => {
      nock(JUDGE0_BASE_URL)
        .persist()
        .post('/submissions?base64_encoded=false&wait=true')
        .replyWithError(new Error('connect ECONNREFUSED 127.0.0.1:2358'));

      const res = await request(app)
        .post(`/api/sessions/${mockSessionId}/answer`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          questionId: mockQuestionId,
          answer: 'def solution(s): return True',
          language: 'python'
        });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('EXECUTION_UNAVAILABLE');
      expect(mockSessionState.executionUnavailable).toBe(true);
    });

    it('when candidate chooses to continueWithoutRunning, session is NOT scored as correct', async () => {
      const res = await request(app)
        .post(`/api/sessions/${mockSessionId}/answer`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          questionId: mockQuestionId,
          answer: 'def solution(s): return True',
          language: 'python',
          continueWithoutRunning: true
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.feedback.wasCorrect).toBe(false);
      expect(res.body.data.feedback.score).toBe(0);
      expect(mockSessionState.executionUnavailable).toBe(true);
    });
  });
});
