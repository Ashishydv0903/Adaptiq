import http from 'http';
import { io as ioClient } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { initSocket } from '../../services/socket.js';
import { env } from '../../config/env.js';

describe('Socket.io Authentication & Role-gated Rooms', () => {
  let server;
  let serverPort;
  let ioServer;

  beforeAll((done) => {
    server = http.createServer();
    ioServer = initSocket(server);
    server.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    ioServer.close();
    server.close(done);
  });

  test('Rejects socket connection when no token is provided', (done) => {
    const client = ioClient(`http://127.0.0.1:${serverPort}`, {
      transports: ['websocket'],
      auth: {}
    });

    client.on('connect_error', (err) => {
      expect(err.message).toMatch(/Authentication error: Missing token/);
      client.close();
      done();
    });

    client.on('connect', () => {
      client.close();
      done(new Error('Should not have connected without token'));
    });
  });

  test('Rejects socket connection when token is invalid or corrupted', (done) => {
    const client = ioClient(`http://127.0.0.1:${serverPort}`, {
      transports: ['websocket'],
      auth: { token: 'invalid.jwt.token' }
    });

    client.on('connect_error', (err) => {
      expect(err.message).toMatch(/Authentication error/);
      client.close();
      done();
    });

    client.on('connect', () => {
      client.close();
      done(new Error('Should not have connected with invalid token'));
    });
  });

  test('Allows socket connection when valid candidate JWT is provided', (done) => {
    const candidateToken = jwt.sign(
      { id: '64b0f0000000000000000001', email: 'candidate@adaptiq.ai', role: 'candidate', name: 'Candidate 1' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const client = ioClient(`http://127.0.0.1:${serverPort}`, {
      transports: ['websocket'],
      auth: { token: candidateToken }
    });

    client.on('connect', () => {
      expect(client.connected).toBe(true);
      client.close();
      done();
    });

    client.on('connect_error', (err) => {
      done(err);
    });
  });

  test('Candidate is rejected when attempting to join recruiter monitor room', (done) => {
    const candidateToken = jwt.sign(
      { id: '64b0f0000000000000000001', email: 'candidate@adaptiq.ai', role: 'candidate', name: 'Candidate 1' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const client = ioClient(`http://127.0.0.1:${serverPort}`, {
      transports: ['websocket'],
      auth: { token: candidateToken }
    });

    client.on('connect', () => {
      client.emit('join_recruiter_monitor');
    });

    client.on('error', (err) => {
      expect(err.message).toMatch(/Recruiter or admin role required/);
      client.close();
      done();
    });
  });

  test('Candidate is rejected when attempting to request WebRTC video feed', (done) => {
    const candidateToken = jwt.sign(
      { id: '64b0f0000000000000000001', email: 'candidate@adaptiq.ai', role: 'candidate', name: 'Candidate 1' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const client = ioClient(`http://127.0.0.1:${serverPort}`, {
      transports: ['websocket'],
      auth: { token: candidateToken }
    });

    client.on('connect', () => {
      client.emit('webrtc:request_feed', { sessionId: 'sess_123' });
    });

    client.on('error', (err) => {
      expect(err.message).toMatch(/Only recruiters and admins can request video feeds/);
      client.close();
      done();
    });
  });

  test('Recruiter can connect and join recruiter monitor room without error', (done) => {
    const recruiterToken = jwt.sign(
      { id: '64b0f0000000000000000002', email: 'recruiter@adaptiq.ai', role: 'recruiter', name: 'Recruiter 1' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const client = ioClient(`http://127.0.0.1:${serverPort}`, {
      transports: ['websocket'],
      auth: { token: recruiterToken }
    });

    client.on('connect', () => {
      client.emit('join_recruiter_monitor');
      // Give a brief window to confirm no error is emitted
      setTimeout(() => {
        expect(client.connected).toBe(true);
        client.close();
        done();
      }, 50);
    });

    client.on('error', (err) => {
      done(new Error('Recruiter should not receive error on join_recruiter_monitor: ' + err.message));
    });
  });
});
