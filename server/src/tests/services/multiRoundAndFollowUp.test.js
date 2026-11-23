import {
  generateFollowUp,
  FOLLOW_UP_TYPES,
  MAX_FOLLOW_UPS_PER_QUESTION
} from '../../services/llm/followUpGenerator.js';
import {
  evaluateStarResponse,
  STAR_COMPONENTS
} from '../../services/scoring/starEvaluator.js';
import {
  getTrackRounds,
  TRACK_ROUNDS,
  DEFAULT_ROUND_TIMERS,
  TIMER_GRACE_PERIOD_SECONDS
} from '../../config/tracks.js';

describe('Multi-Round Flow, Follow-Up Engine & STAR Evaluator', () => {
  describe('LLM Follow-Up Generator', () => {
    const question = {
      title: 'Idempotent Payment Endpoint Design',
      prompt: 'How would you architect an idempotent payment processing endpoint?',
      idealAnswer: 'Require client Idempotency-Key UUID, atomic Redis/Mongo lock, check existing transactions.',
      roundType: 'technical'
    };

    const candidateAnswer =
      'We use an Idempotency-Key header and store it in Redis with an expiration TTL.';

    test('Generates structured follow-up matching one of the 5 allowed types', async () => {
      const result = await generateFollowUp({
        question,
        candidateAnswer,
        previousFollowUps: []
      });

      expect(result.shouldFollowUp).toBe(true);
      expect(FOLLOW_UP_TYPES).toContain(result.type);
      expect(result.followUpPrompt).toBeDefined();
      expect(result.followUpPrompt.length).toBeGreaterThan(10);
      expect(result.contextRationale).toBeDefined();
      expect(result.expectedFocus).toBeDefined();
      expect(result.followUpIndex).toBe(1);
    });

    test('Avoids repeating previously asked follow-up types', async () => {
      const prev = [
        { type: 'edge_case', followUpPrompt: 'What happens if Redis fails?' }
      ];

      const result = await generateFollowUp({
        question,
        candidateAnswer,
        previousFollowUps: prev
      });

      expect(result.shouldFollowUp).toBe(true);
      expect(result.type).not.toBe('edge_case');
      expect(result.followUpIndex).toBe(2);
    });

    test('Enforces maximum of 2 follow-ups per question', async () => {
      const prev = [
        { type: 'edge_case', followUpPrompt: 'Prompt 1' },
        { type: 'go_deeper', followUpPrompt: 'Prompt 2' }
      ];

      const result = await generateFollowUp({
        question,
        candidateAnswer,
        previousFollowUps: prev
      });

      expect(result.shouldFollowUp).toBe(false);
      expect(result.maxReached).toBe(true);
      expect(result.reason).toMatch(/Maximum of 2 follow-ups/);
    });

    test('MCQs do not generate conversational follow-ups', async () => {
      const mcqQuestion = { ...question, roundType: 'mcq' };
      const result = await generateFollowUp({
        question: mcqQuestion,
        candidateAnswer: 'Option B'
      });

      expect(result.shouldFollowUp).toBe(false);
    });
  });

  describe('STAR Behavioral Evaluator', () => {
    const behavioralQuestion = {
      title: 'Production Outage Under High Traffic',
      prompt: 'Describe a time when a critical bug hit production during high traffic. What did you do?',
      roundType: 'behavioral'
    };

    test('Evaluates complete STAR response and awards high score with no missing components', async () => {
      const completeAnswer =
        'Situation: At my previous company, a database connection leak occurred during a Black Friday traffic surge. Task: I was responsible as lead on-call engineer to stabilize the API and prevent checkout downtime. Action: I immediately analyzed the active Postgres locks, configured a pgbouncer connection pool with a maximum client limit, and pushed a hotfix to release idle connections. Result: The outage was mitigated in 8 minutes, zero payment transactions were dropped, and latency improved by 40%.';

      const result = await evaluateStarResponse({
        question: behavioralQuestion,
        candidateAnswer: completeAnswer
      });

      expect(result.overallScore).toBeGreaterThanOrEqual(70);
      expect(result.situation.present).toBe(true);
      expect(result.task.present).toBe(true);
      expect(result.action.present).toBe(true);
      expect(result.result.present).toBe(true);
      expect(result.missingComponents.length).toBe(0);
      expect(result.coachingTip).toBeDefined();
    });

    test('Flags missing Result component when candidate omits business impact and metrics', async () => {
      const incompleteAnswer =
        'Situation: During a high traffic peak our servers were crashing. Task: I was tasked with investigating the logs. Action: I looked at the Express traces and restarted the Node cluster with more workers.';

      const result = await evaluateStarResponse({
        question: behavioralQuestion,
        candidateAnswer: incompleteAnswer
      });

      expect(result.missingComponents).toContain('Result');
      expect(result.result.present).toBe(false);
      expect(result.coachingTip).toMatch(/Result/i);
    });

    test('Flags missing Task and Situation when candidate only describes isolated actions', async () => {
      const actionOnlyAnswer =
        'I configured Redis caching and refactored the SQL queries with an index.';

      const result = await evaluateStarResponse({
        question: behavioralQuestion,
        candidateAnswer: actionOnlyAnswer
      });

      expect(result.missingComponents.length).toBeGreaterThan(1);
      expect(result.overallScore).toBeLessThan(65);
    });
  });

  describe('Multi-Round Track Configuration & Timer Validation', () => {
    test('Configures sequential rounds across all 5 career tracks', () => {
      const fullstackRounds = getTrackRounds('fullstack');
      expect(fullstackRounds.length).toBe(6);
      expect(fullstackRounds[0].roundType).toBe('mcq');
      expect(fullstackRounds[0].status).toBe('in_progress');
      expect(fullstackRounds[1].status).toBe('pending');

      const devopsRounds = getTrackRounds('devops');
      expect(devopsRounds.some((r) => r.roundType === 'system_design')).toBe(true);
      expect(devopsRounds.some((r) => r.roundType === 'behavioral')).toBe(true);
    });

    test('Enforces per-round default timers', () => {
      expect(DEFAULT_ROUND_TIMERS.mcq).toBe(90);
      expect(DEFAULT_ROUND_TIMERS.technical).toBe(180);
      expect(DEFAULT_ROUND_TIMERS.coding).toBe(600);
      expect(DEFAULT_ROUND_TIMERS.behavioral).toBe(240);
      expect(TIMER_GRACE_PERIOD_SECONDS).toBe(15);
    });
  });
});
