import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { User, Question, AssessmentSession } from '../../models/index.js';
import { env } from '../../config/env.js';

describe('Adaptive Interview Session APIs', () => {
  const app = createApp();
  const mockUserId = '64b0f0000000000000000001';
  const token = jwt.sign(
    { id: mockUserId, email: 'candidate@adaptiq.ai', role: 'candidate' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: mockUserId,
        id: mockUserId,
        email: 'candidate@adaptiq.ai',
        role: 'candidate'
      })
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/sessions/start', () => {
    test('Starts session, initializes theta=0.0 and returns first question', async () => {
      const mockQuestions = [
        {
          _id: 'q1_id',
          title: 'Event Loop Question',
          track: 'frontend',
          roundType: 'mcq',
          irtParams: { a: 1.2, b: 0.0, c: 0.25 },
          options: [{ text: 'Option A', isCorrect: true }, { text: 'Option B', isCorrect: false }],
          toObject: () => ({
            _id: 'q1_id',
            title: 'Event Loop Question',
            track: 'frontend',
            roundType: 'mcq',
            options: [{ text: 'Option A', isCorrect: true }, { text: 'Option B', isCorrect: false }]
          })
        }
      ];

      jest.spyOn(Question, 'find').mockResolvedValueOnce(mockQuestions);
      jest.spyOn(AssessmentSession, 'create').mockResolvedValueOnce({
        _id: 'session_123',
        track: 'frontend',
        status: 'in_progress',
        abilityTheta: 0.0,
        abilitySem: 1.0,
        percentileScore: 50.0,
        responses: []
      });

      const res = await request(app)
        .post('/api/sessions/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ track: 'frontend' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.session.abilityTheta).toBe(0.0);
      expect(res.body.data.currentQuestion).toBeDefined();
      expect(res.body.data.currentQuestion.title).toBe('Event Loop Question');
      // Ideal answer must be sanitized
      expect(res.body.data.currentQuestion.idealAnswer).toBeUndefined();
    });
  });

  describe('POST /api/sessions/:id/answer', () => {
    test('Answers question, recalibrates theta upwards on correct answer', async () => {
      const mockSession = {
        _id: 'session_123',
        track: 'frontend',
        status: 'in_progress',
        abilityTheta: 0.0,
        abilitySem: 1.0,
        percentileScore: 50.0,
        responses: [],
        currentQuestionIndex: 0,
        save: jest.fn().mockResolvedValue(true)
      };

      const mockQuestion = {
        _id: 'q1_id',
        title: 'Event Loop',
        roundType: 'mcq',
        irtParams: { a: 1.5, b: 0.0, c: 0.0 },
        options: [{ text: 'Microtasks first', isCorrect: true }, { text: 'Macrotasks first', isCorrect: false }]
      };

      const mockNextQuestion = {
        _id: 'q2_id',
        title: 'Next Question',
        roundType: 'mcq',
        irtParams: { a: 1.5, b: 0.5, c: 0.0 },
        options: [{ text: 'A', isCorrect: true }],
        toObject: () => ({ _id: 'q2_id', title: 'Next Question', options: [{ text: 'A' }] })
      };

      jest.spyOn(AssessmentSession, 'findById').mockResolvedValueOnce(mockSession);
      jest.spyOn(Question, 'findById').mockResolvedValueOnce(mockQuestion);
      jest.spyOn(Question, 'find').mockResolvedValue([mockQuestion, mockNextQuestion]);

      const res = await request(app)
        .post('/api/sessions/session_123/answer')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: 'q1_id',
          answer: 'Microtasks first',
          durationSeconds: 25
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Theta must rise after correct answer
      expect(res.body.data.theta).toBeGreaterThan(0.0);
      expect(res.body.data.feedback.wasCorrect).toBe(true);
      expect(res.body.data.nextQuestion).toBeDefined();
    });
  });

  describe('Pause & Resume Flow', () => {
    test('POST /api/sessions/:id/pause pauses session and returns remaining timer', async () => {
      const mockSession = {
        _id: 'session_123',
        candidateId: mockUserId,
        status: 'in_progress',
        currentQuestionAllowedSeconds: 90,
        currentQuestionStartedAt: new Date(Date.now() - 30000), // 30s elapsed
        totalPausedSeconds: 0,
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(AssessmentSession, 'findById').mockResolvedValue(mockSession);

      const res = await request(app)
        .post('/api/sessions/session_123/pause')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('paused');
      expect(res.body.data.remainingSeconds).toBeLessThanOrEqual(60);
      expect(res.body.data.pausedAt).toBeDefined();
    });

    test('POST /api/sessions/:id/resume resumes session from pause', async () => {
      const mockQuestion = {
        _id: 'q1_id',
        title: 'Active Question',
        roundType: 'technical',
        options: []
      };

      const mockSession = {
        _id: 'session_123',
        track: 'fullstack',
        status: 'paused',
        pausedAt: new Date(Date.now() - 10000), // paused 10s ago
        currentQuestionAllowedSeconds: 180,
        currentQuestionStartedAt: new Date(Date.now() - 40000),
        totalPausedSeconds: 0,
        currentQuestionId: mockQuestion,
        responses: [],
        abilityTheta: 0.5,
        abilitySem: 0.8,
        percentileScore: 65,
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(AssessmentSession, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockSession)
      });

      const res = await request(app)
        .post('/api/sessions/session_123/resume')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.session.status).toBe('in_progress');
      expect(res.body.data.session.timer.remainingSeconds).toBeGreaterThan(0);
    });
  });

  describe('Follow-Up & STAR Endpoints', () => {
    test('POST /api/sessions/:id/follow-up generates targeted follow-up question', async () => {
      const mockQuestion = {
        _id: 'q1_id',
        title: 'Idempotency Design',
        prompt: 'Design an idempotent payment API',
        roundType: 'technical',
        idealAnswer: 'Use idempotency key, atomic locks'
      };

      const mockSession = {
        _id: 'session_123',
        responses: [
          {
            questionId: 'q1_id',
            followUps: []
          }
        ],
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Question, 'findById').mockResolvedValueOnce(mockQuestion);
      jest.spyOn(AssessmentSession, 'findById').mockResolvedValueOnce(mockSession);

      const res = await request(app)
        .post('/api/sessions/session_123/follow-up')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: 'q1_id',
          candidateAnswer: 'I store an idempotency-key in Redis with a 24-hour TTL.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shouldFollowUp).toBe(true);
      expect(res.body.data.followUpPrompt).toBeDefined();
    });

    test('POST /api/sessions/:id/evaluate-star evaluates behavioral STAR response', async () => {
      const mockQuestion = {
        _id: 'q_star_id',
        title: 'Incident Response STAR',
        prompt: 'Tell me about an incident you triaged.',
        roundType: 'behavioral'
      };

      jest.spyOn(Question, 'findById').mockResolvedValueOnce(mockQuestion);

      const res = await request(app)
        .post('/api/sessions/session_123/evaluate-star')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: 'q_star_id',
          candidateAnswer:
            'Situation: Servers crashed under high traffic. Task: I was on call to restore service. Action: I deployed pgbouncer and increased database connections. Result: Uptime returned to 99.9% in 10 minutes.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.evaluation.overallScore).toBeGreaterThan(60);
      expect(res.body.data.evaluation.missingComponents).toBeDefined();
    });
  });
});
