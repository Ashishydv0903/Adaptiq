import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { User } from '../../models/User.js';
import { AssessmentSession } from '../../models/AssessmentSession.js';
import { Evidence } from '../../models/index.js';
import { Roadmap } from '../../models/Roadmap.js';
import { env } from '../../config/env.js';

describe('Route Ownership & Authorization Security Checks', () => {
  const app = createApp();

  const candidateAId = '64b0f0000000000000000001';
  const candidateBId = '64b0f0000000000000000002';
  const recruiterId = '64b0f0000000000000000003';

  const candidateAToken = jwt.sign(
    { id: candidateAId, email: 'candidateA@adaptiq.ai', role: 'candidate', name: 'Candidate A' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const candidateBToken = jwt.sign(
    { id: candidateBId, email: 'candidateB@adaptiq.ai', role: 'candidate', name: 'Candidate B' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const recruiterToken = jwt.sign(
    { id: recruiterId, email: 'recruiter@adaptiq.ai', role: 'recruiter', name: 'Recruiter' },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const mockCandidateA = { _id: candidateAId, id: candidateAId, role: 'candidate', name: 'Candidate A' };
  const mockCandidateB = { _id: candidateBId, id: candidateBId, role: 'candidate', name: 'Candidate B' };
  const mockRecruiter = { _id: recruiterId, id: recruiterId, role: 'recruiter', name: 'Recruiter' };

  const makeMockQuery = (data) => {
    const p = Promise.resolve(data);
    p.select = jest.fn().mockReturnValue(p);
    p.populate = jest.fn().mockReturnValue(p);
    p.lean = jest.fn().mockResolvedValue(data);
    return p;
  };

  const sessionBId = '64b0f0000000000000000020';
  const mockSessionB = {
    _id: sessionBId,
    userId: candidateBId,
    candidateId: candidateBId,
    track: 'fullstack',
    status: 'in_progress',
    currentQuestionId: {
      _id: '64b0f0000000000000000099',
      title: 'Database Query Optimization',
      prompt: 'Explain query indexing',
      roundType: 'conceptual'
    },
    responses: []
  };

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('Session Routes Ownership (/api/sessions/:id)', () => {
    test('Candidate A cannot access Candidate B session (GET /api/sessions/:id -> 403)', async () => {
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCandidateA)
      });

      jest.spyOn(AssessmentSession, 'findById').mockImplementation(() => makeMockQuery(mockSessionB));

      const res = await request(app)
        .get(`/api/sessions/${sessionBId}`)
        .set('Authorization', `Bearer ${candidateAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/);
    });

    test('Candidate A cannot submit an answer to Candidate B session (POST /api/sessions/:id/answer -> 403)', async () => {
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCandidateA)
      });

      jest.spyOn(AssessmentSession, 'findById').mockImplementation(() => makeMockQuery(mockSessionB));

      const res = await request(app)
        .post(`/api/sessions/${sessionBId}/answer`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          questionId: 'q1',
          answer: 'Hacked answer'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/);
    });

    test('Recruiter CAN access Candidate B session (GET /api/sessions/:id -> 200)', async () => {
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockRecruiter)
      });

      jest.spyOn(AssessmentSession, 'findById').mockImplementation(() => makeMockQuery(mockSessionB));

      const res = await request(app)
        .get(`/api/sessions/${sessionBId}`)
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Proctor Routes Ownership (/api/proctor/...)', () => {
    const evidenceBId = '64b0f0000000000000000030';

    test('Candidate A cannot access Candidate B proctoring status (GET /api/proctor/session/:sessionId/status -> 403)', async () => {
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCandidateA)
      });

      jest.spyOn(AssessmentSession, 'findById').mockImplementation(() => makeMockQuery(mockSessionB));

      const res = await request(app)
        .get(`/api/proctor/session/${sessionBId}/status`)
        .set('Authorization', `Bearer ${candidateAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/);
    });

    test('Candidate A cannot stream evidence belonging to Candidate B (GET /api/proctor/evidence/:id -> 403)', async () => {
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCandidateA)
      });

      jest.spyOn(Evidence, 'findById').mockImplementation(() =>
        makeMockQuery({
          _id: evidenceBId,
          sessionId: sessionBId
        })
      );

      jest.spyOn(AssessmentSession, 'findById').mockImplementation(() => makeMockQuery(mockSessionB));

      const res = await request(app)
        .get(`/api/proctor/evidence/${evidenceBId}`)
        .set('Authorization', `Bearer ${candidateAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/);
    });

    test('Candidate cannot trigger recruiter session actions (POST /api/proctor/session/:sessionId/action -> 403)', async () => {
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCandidateA)
      });

      jest.spyOn(AssessmentSession, 'findById').mockImplementation(() => makeMockQuery(mockSessionB));

      const res = await request(app)
        .post(`/api/proctor/session/${sessionBId}/action`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({ action: 'terminate' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/);
    });
  });

  describe('Skill Gap & Roadmap Ownership (/api/skills/roadmap/:id/progress)', () => {
    const roadmapBId = '64b0f0000000000000000040';
    const mockRoadmapB = {
      _id: roadmapBId,
      candidateId: candidateBId,
      milestones: [
        {
          title: 'Core React',
          resources: [{ title: 'Hooks Guide', isCompleted: false }],
          isCompleted: false
        }
      ],
      save: jest.fn().mockResolvedValue(true)
    };

    test('Candidate A cannot modify Candidate B roadmap progress (PATCH /api/skills/roadmap/:id/progress -> 403)', async () => {
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCandidateA)
      });

      jest.spyOn(Roadmap, 'findById').mockImplementation(() => makeMockQuery(mockRoadmapB));

      const res = await request(app)
        .patch(`/api/skills/roadmap/${roadmapBId}/progress`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          milestoneIndex: 0,
          resourceIndex: 0,
          isCompleted: true
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/);
    });

    test('Candidate B CAN modify their own roadmap progress (PATCH /api/skills/roadmap/:id/progress -> 200)', async () => {
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCandidateB)
      });

      jest.spyOn(Roadmap, 'findById').mockImplementation(() => makeMockQuery(mockRoadmapB));

      const res = await request(app)
        .patch(`/api/skills/roadmap/${roadmapBId}/progress`)
        .set('Authorization', `Bearer ${candidateBToken}`)
        .send({
          milestoneIndex: 0,
          resourceIndex: 0,
          isCompleted: true
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
