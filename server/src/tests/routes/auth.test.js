import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { User } from '../../models/User.js';
import { env } from '../../config/env.js';

describe('Auth & Role Authorization API', () => {
  const app = createApp();

  describe('POST /api/auth/register', () => {
    test('Fails with 400 when Zod validation fails (invalid email, short password)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'A',
          email: 'not-an-email',
          password: '123'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation Error');
      expect(res.body.details.length).toBeGreaterThan(0);
    });

    test('Successfully registers a new candidate user', async () => {
      const mockUser = {
        _id: '64b0f0000000000000000001',
        name: 'John Doe',
        email: 'john.new@adaptiq.ai',
        role: 'candidate',
        refreshTokens: [],
        save: jest.fn().mockResolvedValue(true),
        generateAccessToken: () =>
          jwt.sign(
            { id: '64b0f0000000000000000001', email: 'john.new@adaptiq.ai', role: 'candidate', name: 'John Doe' },
            env.JWT_SECRET,
            { expiresIn: '1h' }
          ),
        generateRefreshToken: () =>
          jwt.sign({ id: '64b0f0000000000000000001', type: 'refresh' }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' })
      };

      jest.spyOn(User, 'findOne').mockResolvedValueOnce(null);
      jest.spyOn(User, 'create').mockResolvedValueOnce(mockUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'John Doe',
          email: 'john.new@adaptiq.ai',
          password: 'Password123!',
          role: 'candidate'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('john.new@adaptiq.ai');
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    test('Fails with 401 when email is not registered', async () => {
      jest.spyOn(User, 'findOne').mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(null)
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unknown@adaptiq.ai',
          password: 'Password123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid email or password/);
    });

    test('Fails with 401 when password does not match', async () => {
      const mockUser = {
        _id: '64b0f0000000000000000001',
        email: 'candidate@adaptiq.ai',
        comparePassword: jest.fn().mockResolvedValueOnce(false)
      };

      jest.spyOn(User, 'findOne').mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(mockUser)
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'candidate@adaptiq.ai',
          password: 'WrongPassword'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid email or password/);
    });

    test('Succeeds with 200 and returns JWT tokens on correct password', async () => {
      const mockUser = {
        _id: '64b0f0000000000000000001',
        name: 'Alan Turing',
        email: 'candidate@adaptiq.ai',
        role: 'candidate',
        refreshTokens: [],
        comparePassword: jest.fn().mockResolvedValueOnce(true),
        save: jest.fn().mockResolvedValue(true),
        generateAccessToken: () =>
          jwt.sign(
            { id: '64b0f0000000000000000001', email: 'candidate@adaptiq.ai', role: 'candidate', name: 'Alan Turing' },
            env.JWT_SECRET,
            { expiresIn: '1h' }
          ),
        generateRefreshToken: () =>
          jwt.sign({ id: '64b0f0000000000000000001', type: 'refresh' }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' })
      };

      jest.spyOn(User, 'findOne').mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce(mockUser)
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'candidate@adaptiq.ai',
          password: 'Candidate@123456'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.role).toBe('candidate');
    });
  });

  describe('Role-based Middleware Authorization', () => {
    test('Denies access (401) to protected route when no token is provided', async () => {
      const res = await request(app).get('/api/users/candidate-area');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('Denies access (403) when candidate attempts to access recruiter portal', async () => {
      const candidateToken = jwt.sign(
        { id: '64b0f0000000000000000001', role: 'candidate' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      jest.spyOn(User, 'findById').mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce({
          _id: '64b0f0000000000000000001',
          role: 'candidate'
        })
      });

      const res = await request(app)
        .get('/api/users/recruiter-area')
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/);
    });

    test('Grants access (200) when recruiter accesses recruiter portal', async () => {
      const recruiterToken = jwt.sign(
        { id: '64b0f0000000000000000002', role: 'recruiter' },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      jest.spyOn(User, 'findById').mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce({
          _id: '64b0f0000000000000000002',
          role: 'recruiter'
        })
      });

      const res = await request(app)
        .get('/api/users/recruiter-area')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/Welcome to the Recruiter Portal/);
    });
  });
});
