/**
 * @file API Integration Tests for Coding Round & Voice Mode Routes
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { User, Question, AssessmentSession } from '../../models/index.js';
import { env } from '../../config/env.js';

describe('Coding Round & Voice Mode APIs', () => {
  const app = createApp();
  const mockUserId = '64b0f0000000000000000001';
  const token = jwt.sign(
    { id: mockUserId, email: 'candidate@adaptiq.ai', role: 'candidate' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const mockCodingQuestion = {
    _id: 'q_code_123',
    id: 'q_code_123',
    title: 'Two Sum Target',
    prompt: 'Return indices of numbers that add up to target',
    roundType: 'coding',
    track: 'fullstack',
    testCases: [
      { input: '[[2, 7, 11, 15], 9]', expectedOutput: '[0,1]', isHidden: false },
      { input: '[[3, 3], 6]', expectedOutput: '[0,1]', isHidden: true }
    ],
    hints: [
      { level: 1, penaltyPoints: 2, hintText: 'Use hash map' },
      { level: 2, penaltyPoints: 5, hintText: 'Store complements' },
      { level: 3, penaltyPoints: 10, hintText: 'Lookup is O(1)' }
    ]
  };

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

  describe('POST /api/sessions/:id/execute-code', () => {
    test('Executes test cases and returns runtime and memory stats', async () => {
      jest.spyOn(Question, 'findById').mockResolvedValue(mockCodingQuestion);

      const res = await request(app)
        .post('/api/sessions/session_test/execute-code')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: 'q_code_123',
          sourceCode: `
            function solution(nums, target) {
              const map = new Map();
              for (let i = 0; i < nums.length; i++) {
                const comp = target - nums[i];
                if (map.has(comp)) return [map.get(comp), i];
                map.set(nums[i], i);
              }
              return [];
            }
          `,
          language: 'javascript',
          isSubmission: false
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.results.length).toBe(1); // Visible only
      expect(res.body.data.runtimeMs).toBeGreaterThan(0);
      expect(res.body.data.memoryKb).toBeGreaterThan(0);
    });
  });

  describe('POST /api/sessions/:id/review-code', () => {
    test('Returns automated LLM code review with complexity and suggestions', async () => {
      jest.spyOn(Question, 'findById').mockResolvedValue(mockCodingQuestion);

      const res = await request(app)
        .post('/api/sessions/session_test/review-code')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: 'q_code_123',
          sourceCode: 'function solution(nums, target) { return [0, 1]; }',
          language: 'javascript'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.readability).toBeDefined();
      expect(res.body.data.complexity.timeComplexity).toBeDefined();
      expect(res.body.data.overallCodeScore).toBeGreaterThan(50);
    });
  });

  describe('POST /api/sessions/:id/unlock-hint', () => {
    test('Unlocks costed hint level and returns penalty points', async () => {
      jest.spyOn(Question, 'findById').mockResolvedValue(mockCodingQuestion);
      jest.spyOn(AssessmentSession, 'findById').mockResolvedValue({
        _id: 'session_test',
        responses: [{ questionId: 'q_code_123', hintsUnlocked: [] }],
        save: jest.fn().mockResolvedValue(true)
      });

      const res = await request(app)
        .post('/api/sessions/session_test/unlock-hint')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: 'q_code_123',
          hintLevel: 1
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.unlockedHint.level).toBe(1);
      expect(res.body.data.totalPenaltyPoints).toBe(2);
      expect(res.body.data.unlockedHint.hintText).toBe('Use hash map');
    });
  });

  describe('POST /api/sessions/:id/voice-answer', () => {
    test('Transcribes audio, calculates speech metrics (WPM, fillers), and scores response', async () => {
      jest.spyOn(Question, 'findById').mockResolvedValue({
        _id: 'q_voice_123',
        id: 'q_voice_123',
        title: 'System Scaling Strategy',
        prompt: 'How would you scale Redis caching under peak load?',
        roundType: 'voice',
        track: 'backend',
        irtParams: { a: 1.2, b: 0.0, c: 0.1 }
      });

      const mockAudio = Buffer.from('RIFF_WAVE_MOCK_AUDIO_DATA_BYTES');

      const res = await request(app)
        .post('/api/sessions/session_test/voice-answer')
        .set('Authorization', `Bearer ${token}`)
        .field('questionId', 'q_voice_123')
        .field('durationSeconds', '35')
        .attach('audio', mockAudio, 'answer.webm');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transcript).toBeDefined();
      expect(res.body.data.voiceMetrics.wpm).toBeGreaterThan(0);
      expect(res.body.data.voiceMetrics.fillerRatio).toBeDefined();
      expect(res.body.data.rubricScoring).toBeDefined();
    });
  });

  describe('POST /api/sessions/:id/confidence-trend', () => {
    test('Records optional consent-gated MediaPipe confidence data points', async () => {
      jest.spyOn(AssessmentSession, 'findById').mockResolvedValue({
        _id: 'session_test',
        responses: [{ questionId: 'q_voice_123' }],
        save: jest.fn().mockResolvedValue(true)
      });

      const res = await request(app)
        .post('/api/sessions/session_test/confidence-trend')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: 'q_voice_123',
          confidenceScores: [
            { timestamp: 1000, confidence: 85 },
            { timestamp: 2000, confidence: 90 },
            { timestamp: 3000, confidence: 88 }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.dataPointsCount).toBe(3);
      expect(res.body.data.averageConfidence).toBe(88);
    });
  });
});
