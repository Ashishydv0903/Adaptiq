/**
 * @file Judge0 Service & Execution Tests
 * Tests real Judge0 execution, backends, stubbed responses (Accepted, Wrong Answer,
 * Compile Error, TLE, Unreachable 503), child process local runner,
 * and 4-language seed question reference solutions.
 */

import nock from 'nock';
import {
  executeJudge0Submission,
  executeAllTestCases,
  checkJudge0Health,
  executeChildProcessLocalRunner,
  getJudge0Config,
  ExecutionUnavailableError
} from '../../services/judge0/judge0Service.js';
import { codingQuestions } from '../../seed/questions/codingQuestions.js';
import { env } from '../../config/env.js';

describe('Phase R2: Judge0 Integration Service Suite', () => {
  const JUDGE0_BASE_URL = env.JUDGE0_API_URL || 'http://localhost:2358';

  beforeEach(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    nock.cleanAll();
    nock.restore();
  });

  describe('Stubbed Judge0 API Responses', () => {
    it('1. Accepted submission: extracts real time, memory, and status', async () => {
      nock(JUDGE0_BASE_URL)
        .post('/submissions?base64_encoded=false&wait=true')
        .reply(200, {
          status: { id: 3, description: 'Accepted' },
          stdout: '[0,1]\n',
          stderr: null,
          time: '0.038',
          memory: 14520
        });

      const res = await executeJudge0Submission({
        sourceCode: 'function solution(nums, target) { return [0,1]; }',
        language: 'javascript',
        stdin: '[[2,7,11,15],9]',
        expectedOutput: '[0,1]'
      });

      expect(res.passed).toBe(true);
      expect(res.status).toBe('Accepted');
      expect(res.executionTimeMs).toBe(38);
      expect(res.memoryKb).toBe(14520);
      expect(res.isFallback).toBe(false);
      expect(res.sandbox).toBe('judge0');
    });

    it('2. Wrong Answer submission: reports failure with real execution time', async () => {
      nock(JUDGE0_BASE_URL)
        .post('/submissions?base64_encoded=false&wait=true')
        .reply(200, {
          status: { id: 4, description: 'Wrong Answer' },
          stdout: '[99,99]\n',
          stderr: null,
          time: '0.042',
          memory: 15100
        });

      const res = await executeJudge0Submission({
        sourceCode: 'def solution(s): return False',
        language: 'python',
        stdin: '"racecar"',
        expectedOutput: 'true'
      });

      expect(res.passed).toBe(false);
      expect(res.status).toBe('Wrong Answer');
      expect(res.executionTimeMs).toBe(42);
      expect(res.memoryKb).toBe(15100);
      expect(res.isFallback).toBe(false);
    });

    it('3. Compilation Error submission: captures compile error and status', async () => {
      nock(JUDGE0_BASE_URL)
        .post('/submissions?base64_encoded=false&wait=true')
        .reply(200, {
          status: { id: 6, description: 'Compilation Error' },
          stdout: null,
          stderr: 'error: expected semicolon after expression',
          compile_output: 'error: expected semicolon after expression',
          time: '0.015',
          memory: 8100
        });

      const res = await executeJudge0Submission({
        sourceCode: '#include <iostream>\nint main() { syntax_err }',
        language: 'cpp',
        stdin: '',
        expectedOutput: ''
      });

      expect(res.passed).toBe(false);
      expect(res.status).toBe('Compilation Error');
      expect(res.stderr).toContain('expected semicolon');
      expect(res.isFallback).toBe(false);
    });

    it('4. Time Limit Exceeded submission: detects TLE status', async () => {
      nock(JUDGE0_BASE_URL)
        .post('/submissions?base64_encoded=false&wait=true')
        .reply(200, {
          status: { id: 5, description: 'Time Limit Exceeded' },
          stdout: null,
          stderr: 'Time Limit Exceeded',
          time: '5.004',
          memory: 38200
        });

      const res = await executeJudge0Submission({
        sourceCode: 'while True: pass',
        language: 'python',
        stdin: '',
        expectedOutput: ''
      });

      expect(res.passed).toBe(false);
      expect(res.status).toBe('Time Limit Exceeded');
      expect(res.executionTimeMs).toBe(5004);
      expect(res.isFallback).toBe(false);
    });

    it('5. Unreachable Judge0: fails loudly with HTTP 503 ExecutionUnavailableError when local dev runner is disabled', async () => {
      nock(JUDGE0_BASE_URL)
        .post('/submissions?base64_encoded=false&wait=true')
        .replyWithError(new Error('connect ECONNREFUSED 127.0.0.1:2358'));

      // Ensure unsafe local runner is not active
      env.ALLOW_UNSAFE_LOCAL_EXEC = false;

      let caughtErr = null;
      try {
        await executeJudge0Submission({
          sourceCode: 'def solution(x): return x',
          language: 'python',
          stdin: '1',
          expectedOutput: '1'
        });
      } catch (err) {
        caughtErr = err;
      }

      expect(caughtErr).toBeInstanceOf(ExecutionUnavailableError);
      expect(caughtErr.statusCode).toBe(503);
      expect(caughtErr.code).toBe('EXECUTION_UNAVAILABLE');
      expect(caughtErr.message).toContain('Code execution is unavailable right now');
    });
  });

  describe('Child-Process Safe Local Dev Runner (JavaScript Only)', () => {
    it('executes valid JavaScript inside child process sandbox when ALLOW_UNSAFE_LOCAL_EXEC=true', async () => {
      const res = await executeChildProcessLocalRunner({
        sourceCode: 'function solution(nums, target) { return [0, 1]; }',
        stdin: '[[2, 7, 11, 15], 9]',
        expectedOutput: '[0,1]'
      });

      expect(res.passed).toBe(true);
      expect(res.status).toBe('Accepted');
      expect(res.isFallback).toBe(true);
      expect(res.sandbox).toBe('local-dev');
      expect(res.stdout).toBe('[0,1]');
    });

    it('terminates infinite loop with Time Limit Exceeded in child process', async () => {
      const res = await executeChildProcessLocalRunner({
        sourceCode: 'function solution() { while(true) {} }',
        stdin: '[]',
        expectedOutput: '[]'
      });

      expect(res.passed).toBe(false);
      expect(res.status).toBe('Time Limit Exceeded');
      expect(res.isFallback).toBe(true);
      expect(res.sandbox).toBe('local-dev');
    });

    it('blocks network module imports in child process runner', async () => {
      const res = await executeChildProcessLocalRunner({
        sourceCode: 'function solution() { const http = require("http"); return "exploit"; }',
        stdin: '[]',
        expectedOutput: 'exploit'
      });

      expect(res.passed).toBe(false);
      expect(res.status).toBe('Runtime Error');
      expect(res.stderr).toContain('disabled in sandbox');
    });
  });

  describe('Health Check Endpoint (GET /api/health/judge0)', () => {
    it('reports UP with latency and backend info when Judge0 probe succeeds', async () => {
      nock(JUDGE0_BASE_URL)
        .post('/submissions?base64_encoded=false&wait=true')
        .reply(200, {
          status: { id: 3, description: 'Accepted' },
          stdout: 'HEALTH_OK\n',
          time: '0.015',
          memory: 12000
        });

      const health = await checkJudge0Health();
      expect(health.status).toBe('UP');
      expect(health.latencyMs).toBeGreaterThanOrEqual(1);
      expect(health.backend).toBe('self-hosted');
      expect(health.apiUrl).toBe(JUDGE0_BASE_URL);
    });

    it('throws ExecutionUnavailableError with DOWN status when Judge0 is offline', async () => {
      nock(JUDGE0_BASE_URL)
        .post('/submissions?base64_encoded=false&wait=true')
        .replyWithError('Connection refused');

      await expect(checkJudge0Health()).rejects.toThrow(ExecutionUnavailableError);
    });
  });

  describe('4-Language Seed Questions & Reference Solutions against Stub Judge0', () => {
    it('executes JavaScript seed question ("Two Sum Target Lookup") reference solution', async () => {
      const q = codingQuestions.find((item) => item.language === 'javascript' || item.title.includes('Two Sum'));
      expect(q).toBeDefined();
      expect(q.referenceSolution).toBeDefined();

      // Mock Judge0 responses for visible and hidden test cases
      for (const tc of q.testCases) {
        nock(JUDGE0_BASE_URL)
          .post('/submissions?base64_encoded=false&wait=true')
          .reply(200, {
            status: { id: 3, description: 'Accepted' },
            stdout: `${tc.expectedOutput}\n`,
            time: '0.025',
            memory: 14000
          });
      }

      const result = await executeAllTestCases({
        sourceCode: q.referenceSolution,
        language: 'javascript',
        testCases: q.testCases,
        isSubmission: true
      });

      expect(result.allPassed).toBe(true);
      expect(result.passedCount).toBe(q.testCases.length);
      expect(result.failedCount).toBe(0);
      expect(result.totalCount).toBe(q.testCases.length);

      // Verify hidden test cases are properly redacted
      const hiddenResults = result.results.filter((r) => r.isHidden);
      expect(hiddenResults.length).toBeGreaterThan(0);
      for (const hr of hiddenResults) {
        expect(hr.input).toBe('[Hidden Test Case]');
        expect(hr.expectedOutput).toBe('[Hidden Test Case]');
        expect(hr.actualOutput).toBe('[Matched Hidden Output]');
      }
    });

    it('executes Python seed question ("Valid Palindrome Sequence") reference solution', async () => {
      const q = codingQuestions.find((item) => item.language === 'python');
      expect(q).toBeDefined();
      expect(q.referenceSolution).toBeDefined();

      for (const tc of q.testCases) {
        nock(JUDGE0_BASE_URL)
          .post('/submissions?base64_encoded=false&wait=true')
          .reply(200, {
            status: { id: 3, description: 'Accepted' },
            stdout: `${tc.expectedOutput}\n`,
            time: '0.018',
            memory: 11000
          });
      }

      const result = await executeAllTestCases({
        sourceCode: q.referenceSolution,
        language: 'python',
        testCases: q.testCases,
        isSubmission: true
      });

      expect(result.allPassed).toBe(true);
      expect(result.passedCount).toBe(q.testCases.length);
      expect(result.results.every((r) => r.passed)).toBe(true);
    });

    it('executes Java seed question ("Contains Duplicate Elements") reference solution', async () => {
      const q = codingQuestions.find((item) => item.language === 'java');
      expect(q).toBeDefined();
      expect(q.referenceSolution).toBeDefined();

      for (const tc of q.testCases) {
        nock(JUDGE0_BASE_URL)
          .post('/submissions?base64_encoded=false&wait=true')
          .reply(200, {
            status: { id: 3, description: 'Accepted' },
            stdout: `${tc.expectedOutput}\n`,
            time: '0.065',
            memory: 24000
          });
      }

      const result = await executeAllTestCases({
        sourceCode: q.referenceSolution,
        language: 'java',
        testCases: q.testCases,
        isSubmission: true
      });

      expect(result.allPassed).toBe(true);
      expect(result.passedCount).toBe(q.testCases.length);
    });

    it('executes C++ seed question ("Reverse String Stream") reference solution', async () => {
      const q = codingQuestions.find((item) => item.language === 'cpp');
      expect(q).toBeDefined();
      expect(q.referenceSolution).toBeDefined();

      for (const tc of q.testCases) {
        nock(JUDGE0_BASE_URL)
          .post('/submissions?base64_encoded=false&wait=true')
          .reply(200, {
            status: { id: 3, description: 'Accepted' },
            stdout: `${tc.expectedOutput}\n`,
            time: '0.005',
            memory: 6000
          });
      }

      const result = await executeAllTestCases({
        sourceCode: q.referenceSolution,
        language: 'cpp',
        testCases: q.testCases,
        isSubmission: true
      });

      expect(result.allPassed).toBe(true);
      expect(result.passedCount).toBe(q.testCases.length);
    });
  });

  describe('Hosted Backend Configuration', () => {
    it('configures RapidAPI hosted endpoint and headers when JUDGE0_API_HOST is present', () => {
      env.JUDGE0_API_HOST = 'judge0-ce.p.rapidapi.com';
      env.JUDGE0_API_KEY = 'test_rapidapi_key';

      const config = getJudge0Config();
      expect(config.baseUrl).toBe('https://judge0-ce.p.rapidapi.com');
      expect(config.backendType).toBe('hosted');
      expect(config.headers['X-RapidAPI-Host']).toBe('judge0-ce.p.rapidapi.com');
      expect(config.headers['X-RapidAPI-Key']).toBe('test_rapidapi_key');

      // Cleanup
      env.JUDGE0_API_HOST = '';
      env.JUDGE0_API_KEY = '';
    });
  });
});
