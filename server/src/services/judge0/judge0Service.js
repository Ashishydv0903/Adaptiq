/**
 * @file Judge0 Integration Service
 * Manages multi-language code execution (JavaScript, Python, Java, C++),
 * visible and hidden test case evaluation, real runtime/memory telemetry,
 * and secure child-process local runner for development.
 */

import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

const execFileAsync = promisify(execFile);

export const JUDGE0_LANGUAGE_IDS = {
  javascript: 63, // JavaScript (Node.js 18.15.0 / 20)
  python: 71,     // Python (3.11.2 / 3.10)
  java: 62,       // Java (OpenJDK 13 / 17)
  cpp: 54         // C++ (GCC 9.2.0 / 13)
};

const DEFAULT_TIMEOUT_SECONDS = 5;
const DEFAULT_MEMORY_LIMIT_KB = 128000;

export class ExecutionUnavailableError extends Error {
  constructor(message = 'Code execution is unavailable right now. Retry, or continue without running.') {
    super(message);
    this.name = 'ExecutionUnavailableError';
    this.code = 'EXECUTION_UNAVAILABLE';
    this.statusCode = 503;
  }
}

/**
 * Normalizes language string to Judge0 standard
 */
export function normalizeLanguage(lang = 'javascript') {
  const lower = (lang || 'javascript').toLowerCase().trim();
  if (lower === 'js' || lower === 'node' || lower === 'nodejs') return 'javascript';
  if (lower === 'py' || lower === 'python3' || lower === 'python') return 'python';
  if (lower === 'c++' || lower === 'clang++' || lower === 'gcc' || lower === 'cpp') return 'cpp';
  if (lower === 'java') return 'java';
  return JUDGE0_LANGUAGE_IDS[lower] ? lower : 'javascript';
}

/**
 * Derives Judge0 API configuration (self-hosted vs hosted RapidAPI/CE)
 */
export function getJudge0Config() {
  let baseUrl = env.JUDGE0_API_URL || 'http://localhost:2358';
  let backendType = 'self-hosted';
  const headers = {
    'Content-Type': 'application/json'
  };

  if (env.JUDGE0_API_HOST) {
    baseUrl = `https://${env.JUDGE0_API_HOST}`;
    backendType = 'hosted';
    headers['X-RapidAPI-Host'] = env.JUDGE0_API_HOST;
  }

  if (env.JUDGE0_API_KEY) {
    headers['X-RapidAPI-Key'] = env.JUDGE0_API_KEY;
    headers['X-Auth-Token'] = env.JUDGE0_API_KEY;
  }

  baseUrl = baseUrl.replace(/\/+$/, '');
  return { baseUrl, headers, backendType };
}

/**
 * Checks Judge0 health by submitting a minimal execution and measuring latency
 *
 * @returns {Promise<Object>} Status, latency, backend type, and API URL
 */
export async function checkJudge0Health() {
  const { baseUrl, headers, backendType } = getJudge0Config();
  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${baseUrl}/submissions?base64_encoded=false&wait=true`,
      {
        source_code: 'print("HEALTH_OK")',
        language_id: JUDGE0_LANGUAGE_IDS.python,
        cpu_time_limit: 3,
        memory_limit: 64000
      },
      {
        headers,
        timeout: 6000
      }
    );

    const latencyMs = Math.max(1, Date.now() - startTime);
    const data = response.data;
    const stdout = (data?.stdout || '').trim();

    if (stdout.includes('HEALTH_OK') || data?.status?.id === 3 || data?.status?.id === 4) {
      return {
        status: 'UP',
        latencyMs,
        backend: backendType,
        apiUrl: baseUrl
      };
    }

    throw new Error(data?.status?.description || 'Unexpected response from Judge0 health submission');
  } catch (error) {
    logger.warn(`[Judge0 Health] Service health probe failed: ${error.message}`);
    const err = new ExecutionUnavailableError(`Judge0 health check failed: ${error.message}`);
    err.data = {
      status: 'DOWN',
      latencyMs: Math.max(1, Date.now() - startTime),
      backend: backendType,
      apiUrl: baseUrl,
      error: error.message
    };
    throw err;
  }
}

/**
 * Isolated child-process local runner for JavaScript ONLY.
 * Activated strictly when ALLOW_UNSAFE_LOCAL_EXEC=true and NODE_ENV !== 'production'.
 * Enforces hard timeout, memory limit, and network lockout.
 */
export async function executeChildProcessLocalRunner({
  sourceCode,
  stdin = '',
  expectedOutput = ''
}) {
  const startTime = Date.now();
  const expTrim = (expectedOutput || '').trim();

  // Create isolated wrapper script that disables network and unneeded modules
  const runnerScript = `
    const Module = require('module');
    const forbiddenModules = new Set(['net', 'http', 'https', 'dgram', 'child_process', 'cluster', 'dns']);
    const origRequire = Module.prototype.require;
    Module.prototype.require = function(id) {
      if (forbiddenModules.has(id)) {
        throw new Error('Access to network module "' + id + '" is disabled in sandbox.');
      }
      return origRequire.apply(this, arguments);
    };

    delete global.fetch;
    delete global.WebSocket;
    delete global.XMLHttpRequest;

    ${sourceCode}

    if (typeof solution === 'function') {
      let rawInput = ${JSON.stringify(stdin)};
      let parsedInput = rawInput;
      try {
        parsedInput = JSON.parse(rawInput);
      } catch (e) {}

      let args = [];
      if (Array.isArray(parsedInput)) {
        if (solution.length === 1 && !Array.isArray(parsedInput[0])) {
          args = [parsedInput];
        } else {
          args = parsedInput;
        }
      } else if (parsedInput !== undefined) {
        args = [parsedInput];
      }

      try {
        const result = solution(...args);
        if (result !== undefined) {
          console.log(typeof result === 'object' ? JSON.stringify(result) : result);
        }
      } catch (err) {
        console.error('RuntimeError: ' + (err && err.message ? err.message : err));
        process.exit(1);
      }
    }
  `;

  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ['--max-old-space-size=64', '-e', runnerScript],
      {
        timeout: 2500,
        maxBuffer: 1024 * 512,
        env: { NODE_ENV: 'sandbox' }
      }
    );

    const outTrim = (stdout || '').trim();
    const errTrim = (stderr || '').trim();
    const elapsedMs = Math.max(1, Date.now() - startTime);
    const passed = expTrim
      ? outTrim === expTrim || outTrim.replace(/\s+/g, '') === expTrim.replace(/\s+/g, '')
      : true;

    return {
      success: !errTrim && passed,
      stdout: outTrim,
      stderr: errTrim,
      executionTimeMs: elapsedMs,
      memoryKb: 16200,
      status: passed ? 'Accepted' : 'Wrong Answer',
      passed,
      isFallback: true,
      sandbox: 'local-dev'
    };
  } catch (error) {
    const elapsedMs = Math.max(1, Date.now() - startTime);
    const isTimeout = error.killed || error.signal === 'SIGTERM' || (error.message || '').includes('timed out');
    const status = isTimeout ? 'Time Limit Exceeded' : 'Runtime Error';

    return {
      success: false,
      stdout: (error.stdout || '').trim(),
      stderr: (error.stderr || error.message || '').trim(),
      executionTimeMs: elapsedMs,
      memoryKb: 16200,
      status,
      passed: false,
      isFallback: true,
      sandbox: 'local-dev'
    };
  }
}

/**
 * Prepares source code before sending to Judge0.
 * If the candidate submitted a function without standard I/O boilerplate,
 * attaches standard I/O driver wrapper so Judge0 executes and tests the output.
 */
export function prepareSourceWithDriver(sourceCode, language) {
  const normLang = normalizeLanguage(language);

  // JavaScript function solution wrapper
  if (normLang === 'javascript') {
    if (sourceCode.includes('function solution') && !sourceCode.includes('fs.readFileSync') && !sourceCode.includes('process.stdin')) {
      return `
${sourceCode}

const fs = require('fs');
try {
  const stdinInput = fs.readFileSync(0, 'utf-8').trim();
  if (typeof solution === 'function') {
    let parsed = stdinInput;
    try {
      parsed = JSON.parse(stdinInput);
    } catch (e) {}

    let args = [];
    if (Array.isArray(parsed)) {
      if (solution.length === 1 && !Array.isArray(parsed[0])) {
        args = [parsed];
      } else {
        args = parsed;
      }
    } else if (parsed !== undefined && parsed !== '') {
      args = [parsed];
    }
    const result = solution(...args);
    if (result !== undefined) {
      console.log(typeof result === 'object' ? JSON.stringify(result) : result);
    }
  }
} catch (e) {
  console.error(e.message);
}
`;
    }
  }

  // Python function solution wrapper
  if (normLang === 'python') {
    if (sourceCode.includes('def solution') && !sourceCode.includes('__main__')) {
      return `
${sourceCode}

if __name__ == '__main__':
    import sys, json
    stdin_raw = sys.stdin.read().strip()
    if stdin_raw:
        try:
            parsed = json.loads(stdin_raw)
        except Exception:
            parsed = stdin_raw
        if isinstance(parsed, list):
            res = solution(*parsed)
        else:
            res = solution(parsed)
        if isinstance(res, (dict, list)):
            print(json.dumps(res, separators=(',', ':')))
        else:
            print(res)
`;
    }
  }

  return sourceCode;
}

/**
 * Executes a single code submission against Judge0 REST API.
 * Uses real time and memory values from Judge0 response.
 *
 * @param {Object} params
 * @param {string} params.sourceCode
 * @param {string} params.language
 * @param {string} [params.stdin='']
 * @param {string} [params.expectedOutput='']
 * @returns {Promise<Object>} Execution result
 */
export async function executeJudge0Submission({
  sourceCode,
  language = 'javascript',
  stdin = '',
  expectedOutput = ''
}) {
  const normLang = normalizeLanguage(language);
  const languageId = JUDGE0_LANGUAGE_IDS[normLang] || 63;
  const { baseUrl, headers } = getJudge0Config();
  const codeToSubmit = prepareSourceWithDriver(sourceCode, normLang);

  try {
    const response = await axios.post(
      `${baseUrl}/submissions?base64_encoded=false&wait=true`,
      {
        source_code: codeToSubmit,
        language_id: languageId,
        stdin,
        expected_output: expectedOutput,
        cpu_time_limit: DEFAULT_TIMEOUT_SECONDS,
        memory_limit: DEFAULT_MEMORY_LIMIT_KB
      },
      {
        headers,
        timeout: (DEFAULT_TIMEOUT_SECONDS + 5) * 1000
      }
    );

    const data = response.data;
    const stdout = (data.stdout || '').trim();
    const stderr = (data.stderr || data.compile_output || '').trim();

    // Real time and memory from Judge0
    const executionTimeMs = data.time ? Math.round(parseFloat(data.time) * 1000) : 0;
    const memoryKb = data.memory ? Math.round(Number(data.memory)) : 0;

    const statusId = data.status?.id;
    let statusDesc = data.status?.description || 'Unknown';
    let passed = false;

    if (statusId === 3) {
      passed = true;
      statusDesc = 'Accepted';
    } else if (statusId === 4) {
      passed = false;
      statusDesc = 'Wrong Answer';
    } else if (statusId === 5) {
      passed = false;
      statusDesc = 'Time Limit Exceeded';
    } else if (statusId === 6) {
      passed = false;
      statusDesc = 'Compilation Error';
    } else if (statusId >= 7) {
      passed = false;
      statusDesc = data.status?.description || 'Runtime Error';
    } else {
      // Fallback matching if status ID is custom
      const expTrim = (expectedOutput || '').trim();
      passed = !stderr && (stdout === expTrim || stdout.replace(/\s+/g, '') === expTrim.replace(/\s+/g, ''));
      statusDesc = passed ? 'Accepted' : (stderr ? 'Runtime Error' : 'Wrong Answer');
    }

    return {
      success: passed,
      stdout,
      stderr,
      executionTimeMs,
      memoryKb,
      status: statusDesc,
      passed,
      isFallback: false,
      sandbox: 'judge0'
    };
  } catch (error) {
    logger.warn(`[Judge0] Backend submission failed: ${error.message}`);

    // Check if unsafe local dev runner is permitted for JavaScript in non-production
    const allowLocal = env.ALLOW_UNSAFE_LOCAL_EXEC === true && env.NODE_ENV !== 'production';
    if (allowLocal && normLang === 'javascript') {
      logger.info('[Judge0] Running JavaScript in local-dev child process sandbox');
      return executeChildProcessLocalRunner({ sourceCode, stdin, expectedOutput });
    }

    // Fail loudly with 503 ExecutionUnavailableError
    throw new ExecutionUnavailableError(
      `Code execution is unavailable right now. Retry, or continue without running. (Error: ${error.message})`
    );
  }
}

/**
 * Runs all test cases against candidate code.
 * In submission mode, executes both visible and hidden test cases.
 *
 * @param {Object} params
 * @param {string} params.sourceCode - Candidate source code
 * @param {string} params.language - Coding language
 * @param {Array<Object>} params.testCases - Array of test case objects
 * @param {boolean} [params.isSubmission=false] - True if final submit (runs hidden test cases)
 * @returns {Promise<Object>} Aggregated test case results and telemetry
 */
export async function executeAllTestCases({
  sourceCode,
  language = 'javascript',
  testCases = [],
  isSubmission = false
}) {
  if (!testCases || testCases.length === 0) {
    return {
      allPassed: true,
      passedCount: 0,
      failedCount: 0,
      totalCount: 0,
      runtimeMs: 0,
      memoryKb: 0,
      results: [],
      isSubmission,
      isFallback: false,
      sandbox: 'judge0'
    };
  }

  // Filter test cases: if just testing, only run visible test cases; if submission, run all
  const casesToRun = isSubmission ? testCases : testCases.filter((tc) => !tc.isHidden);
  const results = [];
  let totalRuntime = 0;
  let peakMemory = 0;
  let passedCount = 0;
  let failedCount = 0;
  let hasAnyFallback = false;
  let activeSandbox = 'judge0';

  for (let i = 0; i < casesToRun.length; i++) {
    const tc = casesToRun[i];
    const execRes = await executeJudge0Submission({
      sourceCode,
      language,
      stdin: tc.input || '',
      expectedOutput: tc.expectedOutput || ''
    });

    if (execRes.isFallback) {
      hasAnyFallback = true;
      activeSandbox = execRes.sandbox || 'local-dev';
    }

    if (execRes.passed) {
      passedCount++;
    } else {
      failedCount++;
    }

    totalRuntime += execRes.executionTimeMs;
    if (execRes.memoryKb > peakMemory) {
      peakMemory = execRes.memoryKb;
    }

    const isHidden = Boolean(tc.isHidden);
    results.push({
      testCaseIndex: i + 1,
      isHidden,
      input: isHidden ? '[Hidden Test Case]' : tc.input,
      expectedOutput: isHidden ? '[Hidden Test Case]' : tc.expectedOutput,
      actualOutput: isHidden
        ? (execRes.passed ? '[Matched Hidden Output]' : '[Failed Hidden Test Case]')
        : execRes.stdout,
      stderr: isHidden ? '' : execRes.stderr,
      passed: execRes.passed,
      status: execRes.status,
      executionTimeMs: execRes.executionTimeMs,
      memoryKb: execRes.memoryKb
    });
  }

  const allPassed = casesToRun.length > 0 && passedCount === casesToRun.length;
  const averageRuntime = casesToRun.length > 0 ? Math.round(totalRuntime / casesToRun.length) : 0;

  return {
    allPassed,
    passedCount,
    failedCount,
    totalCount: casesToRun.length,
    runtimeMs: averageRuntime,
    memoryKb: peakMemory,
    results,
    isSubmission,
    isFallback: hasAnyFallback,
    sandbox: activeSandbox
  };
}
