import {
  RELEVANCE_THRESHOLD,
  INSUFFICIENT_EVIDENCE_TEXT,
  GATE_FALLBACK_MESSAGE,
  detectKeyboardMashing,
  detectGibberish,
  calculateRelevance,
  evaluateAnswerQualityChecks,
  extractAnswerEvidence,
  buildConfidenceSkillEvaluations,
  buildCandidateFriendlySummary
} from '../services/scoring/answerRelevanceGate.js';

describe('Answer Relevance Gate & Quality Scoring System', () => {
  const sampleQuestion = {
    title: 'Database Query Optimization',
    prompt: 'How would you optimize a slow PostgreSQL database query in a high-traffic production service?',
    topic: 'Databases & Performance',
    keyConcepts: ['index', 'explain analyze', 'caching', 'redis', 'connection pooling']
  };

  describe('Keyboard Mashing Detection', () => {
    test('detects repeated characters', () => {
      expect(detectKeyboardMashing('aaaaaaaaaa').isMash).toBe(true);
      expect(detectKeyboardMashing('zzzzzzzz').isMash).toBe(true);
      expect(detectKeyboardMashing('.......').isMash).toBe(true);
    });

    test('detects repeated keyboard walk patterns', () => {
      expect(detectKeyboardMashing('asdfasdfasdf').isMash).toBe(true);
      expect(detectKeyboardMashing('qwerqwerqwer').isMash).toBe(true);
    });

    test('detects abnormally long single tokens without punctuation', () => {
      expect(detectKeyboardMashing('supercalifragilisticexpialidociouslongtokenwithoutspaces').isMash).toBe(true);
    });

    test('passes legitimate technical sentences', () => {
      const legit = 'I would run EXPLAIN ANALYZE to identify sequential scans and add B-Tree indexes on filtered columns.';
      expect(detectKeyboardMashing(legit).isMash).toBe(false);
    });
  });

  describe('Gibberish Detection', () => {
    test('detects random strings of non-dictionary letters', () => {
      const gibberish = 'xrplk jhvnm tzqwp blkfd';
      expect(detectGibberish(gibberish).isGibberish).toBe(true);
    });

    test('passes structured English responses', () => {
      const valid = 'We should implement Redis caching for frequent read queries.';
      expect(detectGibberish(valid).isGibberish).toBe(false);
    });
  });

  describe('calculateRelevance', () => {
    test('flags empty and null responses', () => {
      const res = calculateRelevance(sampleQuestion, '');
      expect(res.passedGate).toBe(false);
      expect(res.score).toBe(0);
      expect(res.gateReason).toBe('EMPTY_RESPONSE');
    });

    test('flags extremely short non-answers', () => {
      const res1 = calculateRelevance(sampleQuestion, 'ok');
      expect(res1.passedGate).toBe(false);
      expect(res1.gateReason).toBe('EXTREMELY_SHORT');

      const res2 = calculateRelevance(sampleQuestion, "i don't know");
      expect(res2.passedGate).toBe(false);
    });

    test('flags keyboard mashing as failed gate', () => {
      const res = calculateRelevance(sampleQuestion, 'asdfasdfasdfasdfasdf');
      expect(res.passedGate).toBe(false);
      expect(res.gateReason).toBe('KEYBOARD_MASH');
    });

    test('flags completely off-topic answers', () => {
      const offTopic = 'Baking sourdough bread requires flour, water, salt, and fermentation over twelve hours.';
      const res = calculateRelevance(sampleQuestion, offTopic);
      expect(res.passedGate).toBe(false);
      expect(res.gateReason).toBe('OFF_TOPIC');
    });

    test('passes relevant engineering answers above threshold', () => {
      const answer = 'First, I would use EXPLAIN ANALYZE on PostgreSQL to check query execution time and index coverage. Next, I would add a compound index and set up Redis caching.';
      const res = calculateRelevance(sampleQuestion, answer);
      expect(res.passedGate).toBe(true);
      expect(res.score).toBeGreaterThanOrEqual(RELEVANCE_THRESHOLD);
    });
  });

  describe('evaluateAnswerQualityChecks (4 Scores)', () => {
    test('returns Insufficient Evidence for completeness, clarity, depth when gated', () => {
      const result = evaluateAnswerQualityChecks(sampleQuestion, 'asdfasdf');
      expect(result.passedGate).toBe(false);
      expect(result.message).toBe(GATE_FALLBACK_MESSAGE);
      expect(result.qualityScores.completeness.display).toBe(INSUFFICIENT_EVIDENCE_TEXT);
      expect(result.qualityScores.completeness.score).toBeNull();
      expect(result.qualityScores.clarity.display).toBe(INSUFFICIENT_EVIDENCE_TEXT);
      expect(result.qualityScores.clarity.score).toBeNull();
      expect(result.qualityScores.technicalDepth.display).toBe(INSUFFICIENT_EVIDENCE_TEXT);
      expect(result.qualityScores.technicalDepth.score).toBeNull();
    });

    test('returns 4 numeric assessed scores for valid responses', () => {
      const answer = 'First, I would inspect the query plan with EXPLAIN ANALYZE to identify sequential table scans. I would create an index on the foreign key columns to reduce latency from O(n) to O(log n). Furthermore, we can cache hot results in Redis to avoid repeated database hits.';
      const result = evaluateAnswerQualityChecks(sampleQuestion, answer);

      expect(result.passedGate).toBe(true);
      expect(result.qualityScores.relevance.score).toBeGreaterThan(50);
      expect(result.qualityScores.completeness.score).toBeGreaterThan(40);
      expect(result.qualityScores.clarity.score).toBeGreaterThan(50);
      expect(result.qualityScores.technicalDepth.score).toBeGreaterThan(50);
    });
  });

  describe('extractAnswerEvidence', () => {
    test('returns Insufficient Evidence when answer is too short or empty', () => {
      expect(extractAnswerEvidence('')).toBe(INSUFFICIENT_EVIDENCE_TEXT);
      expect(extractAnswerEvidence('ok')).toBe(INSUFFICIENT_EVIDENCE_TEXT);
    });

    test('extracts sentence matching preferred technical keywords', () => {
      const answer = 'We noticed severe latency during peak traffic. First I would optimize the database queries by adding a Redis cache. This reduced response time significantly.';
      const evidence = extractAnswerEvidence(answer, ['redis', 'cache']);
      expect(evidence).toContain('First I would optimize the database queries by adding a Redis cache.');
    });
  });

  describe('buildConfidenceSkillEvaluations', () => {
    test('assigns Low confidence and Insufficient Evidence when gated', () => {
      const qualityChecks = evaluateAnswerQualityChecks(sampleQuestion, 'random word mash');
      const evaluations = buildConfidenceSkillEvaluations({
        question: sampleQuestion,
        candidateAnswer: 'random word mash',
        qualityChecks
      });

      expect(evaluations.length).toBeGreaterThanOrEqual(3);
      for (const ev of evaluations) {
        expect(ev.confidence).toBe('Low');
        expect(ev.evidence).toBe(INSUFFICIENT_EVIDENCE_TEXT);
      }
    });

    test('never provides high confidence when quality is low', () => {
      const poorQualityChecks = {
        passedGate: true,
        qualityScores: {
          relevance: { score: 38 },
          completeness: { score: 40 },
          clarity: { score: 45 },
          technicalDepth: { score: 35 }
        }
      };

      const evaluations = buildConfidenceSkillEvaluations({
        question: sampleQuestion,
        candidateAnswer: 'I would look at the database and try to make it faster somehow.',
        qualityChecks: poorQualityChecks
      });

      const highConf = evaluations.filter((e) => e.confidence === 'High');
      expect(highConf.length).toBe(0);
    });

    test('provides High confidence with evidence when answer is strong', () => {
      const answer = 'First I would run EXPLAIN ANALYZE on the slow database query because that reveals sequential table scans. Then I would add an index on user_id and cache frequently accessed records in Redis.';
      const qualityChecks = evaluateAnswerQualityChecks(sampleQuestion, answer);

      const evaluations = buildConfidenceSkillEvaluations({
        question: sampleQuestion,
        candidateAnswer: answer,
        qualityChecks
      });

      expect(evaluations.some((e) => e.confidence === 'High')).toBe(true);
      const commSkill = evaluations.find((e) => e.name === 'Communication');
      expect(commSkill.reason).toBeDefined();
      expect(commSkill.evidence).not.toBe(INSUFFICIENT_EVIDENCE_TEXT);
    });
  });

  describe('buildCandidateFriendlySummary (Candidate Dashboard)', () => {
    test('handles completely gated sessions gracefully without inventing feedback', () => {
      const session = { id: 'sess_123' };
      const responses = [
        { answer: 'asdfasdfasdf', score: 0.1 },
        { answer: 'ok', score: 0.1 }
      ];
      const summary = buildCandidateFriendlySummary({ session, responses, questionDetails: [sampleQuestion, sampleQuestion] });

      expect(summary.isAllGated).toBe(true);
      expect(summary.finalScore).toBeNull();
      expect(summary.verdict).toBe('Assessment Inconclusive');
      expect(summary.summaryText).toBe(GATE_FALLBACK_MESSAGE);
      expect(summary.strengths.length).toBe(0);
      expect(summary.finalCandidateSummary.strongestSkill).toBe(INSUFFICIENT_EVIDENCE_TEXT);
      expect(summary.qualityChecksOverall.completeness.display).toBe(INSUFFICIENT_EVIDENCE_TEXT);
    });

    test('builds 30-second candidate summary with Strengths, Needs Improvement, What To Do Next', () => {
      const session = { id: 'sess_456' };
      const responses = [
        {
          answer: 'First I would identify the bottleneck using EXPLAIN ANALYZE and optimize database queries by adding a Redis cache.',
          score: 85,
          roundType: 'technical'
        },
        {
          answer: 'To handle concurrency, we applied optimistic locking and connection pooling to avoid deadlocks in high throughput.',
          score: 80,
          roundType: 'coding'
        }
      ];

      const summary = buildCandidateFriendlySummary({ session, responses, questionDetails: [sampleQuestion, sampleQuestion] });

      expect(summary.isAllGated).toBe(false);
      expect(summary.finalScore).toBeGreaterThanOrEqual(75);

      // 30-Second Summary Check
      expect(summary.finalCandidateSummary.interviewScore).toBe(summary.finalScore);
      expect(summary.finalCandidateSummary.strongestSkill).toBeDefined();
      expect(summary.finalCandidateSummary.biggestImprovementArea).toBeDefined();
      expect(summary.finalCandidateSummary.topRecommendations.length).toBe(3);

      // Strengths with Evidence
      expect(summary.strengths.length).toBeGreaterThanOrEqual(1);
      expect(summary.strengths[0].point).toBeDefined();
      expect(summary.strengths[0].evidence).toBeDefined();

      // Needs Improvement with Evidence
      expect(summary.needsImprovement.length).toBeGreaterThanOrEqual(1);

      // What to do next
      expect(summary.whatToDoNext.length).toBeGreaterThanOrEqual(3);
    });
  });
});
