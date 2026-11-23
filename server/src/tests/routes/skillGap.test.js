/**
 * @file API Integration Tests for Skill Gap Analysis & Roadmap Routes
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { User, Skill, Roadmap } from '../../models/index.js';
import { env } from '../../config/env.js';

describe('Skill Gap Analysis & Roadmap APIs', () => {
  const app = createApp();
  const mockUserId = '64b0f0000000000000000001';
  const token = jwt.sign(
    { id: mockUserId, email: 'candidate@adaptiq.ai', role: 'candidate', name: 'Alex Candidate' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: mockUserId,
        id: mockUserId,
        email: 'candidate@adaptiq.ai',
        role: 'candidate',
        name: 'Alex Candidate',
        profile: { headline: '', resumeUrl: '', skills: [] }
      })
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/skills/graph', () => {
    test('Returns 80+ skill nodes and prerequisite edges formatted for React Flow', async () => {
      const res = await request(app)
        .get('/api/skills/graph')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.nodes.length).toBeGreaterThanOrEqual(80);
      expect(res.body.data.edges.length).toBeGreaterThan(50);
      expect(res.body.data.categories).toContain('Frontend');
      expect(res.body.data.categories).toContain('Backend');
      expect(res.body.data.categories).toContain('Database');
    });
  });

  describe('POST /api/skills/resume-parse', () => {
    test('Extracts claimed skills and builds Claimed-vs-Proven matrix from text', async () => {
      const res = await request(app)
        .post('/api/skills/resume-parse')
        .set('Authorization', `Bearer ${token}`)
        .send({
          resumeText:
            'Alex Candidate - Senior Software Engineer with 5 years in Node.js, React, Express, MongoDB, and Docker containerization. Built distributed microservices.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.extraction).toBeDefined();
      expect(res.body.data.claimedVsProven.length).toBeGreaterThan(0);
      expect(res.body.data.stats).toBeDefined();
    });
  });

  describe('POST /api/skills/jd-analyze', () => {
    test('Computes role-fit score and identifies top-3 gaps with root causes', async () => {
      const res = await request(app)
        .post('/api/skills/jd-analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({
          jdText:
            'We are seeking a Senior Fullstack Engineer proficient in React, Node.js, distributed caching with Redis, and Kubernetes microservices.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jdAnalysis).toBeDefined();
      expect(res.body.data.fitMetrics.roleFitScore).toBeDefined();
      expect(res.body.data.topGaps.length).toBeLessThanOrEqual(3);
    });
  });

  describe('POST /api/skills/roadmap and PATCH /api/skills/roadmap/:id/progress', () => {
    test('Generates topologically ordered learning roadmap', async () => {
      const res = await request(app)
        .post('/api/skills/roadmap')
        .set('Authorization', `Bearer ${token}`)
        .send({
          targetRole: 'Senior Cloud Engineer',
          matchPercentage: 72,
          skillGaps: [
            { slug: 'microservices-architecture', currentMastery: 0.3, requiredMastery: 0.8, gap: 0.5 },
            { slug: 'distributed-caching-redis', currentMastery: 0.3, requiredMastery: 0.8, gap: 0.5 }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.roadmap.milestones.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.roadmap.milestones[0].resources.length).toBeGreaterThan(0);
    });

    test('Updates progress on roadmap resource checkbox', async () => {
      const res = await request(app)
        .patch('/api/skills/roadmap/mock_roadmap_123/progress')
        .set('Authorization', `Bearer ${token}`)
        .send({
          milestoneIndex: 0,
          resourceIndex: 0,
          isCompleted: true
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isCompleted).toBe(true);
      expect(res.body.data.overallProgress).toBeDefined();
    });
  });
});
