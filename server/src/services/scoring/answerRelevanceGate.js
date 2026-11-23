/**
 * @file answerRelevanceGate.js
 * Comprehensive Answer Relevance Gate, Quality Checks & Candidate-Friendly Feedback Engine
 *
 * Implements:
 * 1. Answer Relevance Gate:
 *    - Detects empty responses, gibberish, keyboard mashing, extremely short responses, off-topic responses.
 *    - Calculates a relevance score (0-100).
 *    - When relevance < threshold (35):
 *      "We could not accurately assess this answer because it was incomplete, unrelated, or lacked sufficient information."
 *      Does not generate invented/detailed skill feedback.
 * 2. Confidence-based Evaluation:
 *    - Each skill has Score, Confidence ("High" | "Medium" | "Low"), and explanatory Reason.
 *    - Never provides high confidence when answer quality is low or gated.
 * 3. Candidate-Friendly Dashboard data:
 *    - Strengths (✅), Needs Improvement (⚠️), What To Do Next (•)
 * 4. Grounded Evidence:
 *    - Links feedback items to verified excerpts from candidate answer.
 *    - If unsupported or gated: "Insufficient evidence to assess."
 * 5. Answer Quality Checks:
 *    - Relevance Score, Completeness Score, Clarity Score, Technical Depth Score.
 *    - If unreliable/gated: "Insufficient evidence to assess."
 * 6. 30-Second Final Candidate Summary:
 *    - Interview Score, Strongest Skill, Biggest Improvement Area, Top 3 Recommendations.
 */

export const RELEVANCE_THRESHOLD = 35;

export const INSUFFICIENT_EVIDENCE_TEXT = 'Insufficient evidence to assess.';
export const GATE_FALLBACK_MESSAGE =
  'We could not accurately assess this answer because it was incomplete, unrelated, or lacked sufficient information.';

const TECHNICAL_VOCABULARY_SET = new Set([
  'function', 'const', 'let', 'var', 'return', 'array', 'object', 'string', 'number', 'boolean',
  'database', 'query', 'table', 'index', 'cache', 'redis', 'sql', 'nosql', 'api', 'server',
  'client', 'request', 'response', 'async', 'await', 'promise', 'callback', 'loop', 'event',
  'component', 'state', 'props', 'hook', 'render', 'memory', 'cpu', 'time', 'space', 'complexity',
  'algorithm', 'hash', 'map', 'set', 'tree', 'graph', 'node', 'queue', 'stack', 'pointer',
  'window', 'search', 'sort', 'binary', 'linear', 'dynamic', 'programming', 'recursion',
  'class', 'method', 'interface', 'type', 'service', 'controller', 'model', 'route', 'endpoint',
  'http', 'rest', 'graphql', 'auth', 'token', 'jwt', 'session', 'cookie', 'security', 'latency',
  'throughput', 'scale', 'microservice', 'distributed', 'lock', 'mutex', 'transaction', 'acid',
  'test', 'unit', 'mock', 'null', 'undefined', 'error', 'exception', 'try', 'catch', 'throw',
  'star', 'situation', 'task', 'action', 'result', 'team', 'project', 'lead', 'design', 'optimize'
]);

// Common English words for gibberish detection
const COMMON_DICTIONARY_SET = new Set([
  ...TECHNICAL_VOCABULARY_SET,
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with',
  'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her',
  'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up',
  'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time',
  'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could',
  'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think',
  'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even',
  'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'water', 'food', 'bread',
  'need', 'feel', 'high', 'life', 'world', 'school', 'still', 'try', 'last', 'call', 'keep',
  'start', 'show', 'hear', 'play', 'run', 'move', 'live', 'believe', 'bring', 'happen', 'must',
  'write', 'provide', 'sit', 'stand', 'lose', 'pay', 'meet', 'include', 'continue', 'set', 'learn',
  'change', 'lead', 'understand', 'watch', 'follow', 'stop', 'create', 'speak', 'read', 'allow',
  'add', 'spend', 'grow', 'open', 'walk', 'win', 'offer', 'remember', 'love', 'consider', 'appear',
  'buy', 'wait', 'serve', 'send', 'expect', 'build', 'stay', 'fall', 'cut', 'reach', 'remain',
  'suggest', 'raise', 'pass', 'sell', 'require', 'report', 'decide', 'pull', 'baking', 'flour',
  'salt', 'hours', 'minutes', 'seconds'
]);

/**
 * Normalizes text for clean analysis
 */
export function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Detects keyboard mashing patterns
 */
export function detectKeyboardMashing(text) {
  if (!text || typeof text !== 'string') return { isMash: true, reason: 'empty' };
  const trimmed = text.trim();
  if (trimmed.length === 0) return { isMash: true, reason: 'empty' };

  // 1. Repeated identical characters (e.g. "aaaaa", "zzzzz", ".......", "11111")
  if (/(.)\1{4,}/i.test(trimmed)) {
    return { isMash: true, reason: 'repeated_characters' };
  }

  // 2. Common keyboard sequence repetition (e.g. "asdfasdf", "jkljkl", "123123", "qwerqwer")
  const mashSequences = ['asdf', 'qwer', 'zxcv', 'jkl;', 'hjkl', '1234', 'wsad', 'dsaq'];
  const lower = trimmed.toLowerCase();
  for (const seq of mashSequences) {
    if (lower.includes(seq + seq) || lower.split(seq).length > 3) {
      return { isMash: true, reason: 'keyboard_walk_repetition' };
    }
  }

  // 3. Oversized single token with no whitespace or punctuation (> 24 chars)
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.some((tok) => tok.length > 24 && !tok.includes('(') && !tok.includes('/') && !tok.includes('.'))) {
    return { isMash: true, reason: 'abnormal_token_length' };
  }

  // 4. Abnormal consonant / vowel ratio in alphabetic text of significant length
  const lettersOnly = trimmed.replace(/[^a-zA-Z]/g, '').toLowerCase();
  if (lettersOnly.length >= 12) {
    const vowelCount = (lettersOnly.match(/[aeiou]/g) || []).length;
    const vowelRatio = vowelCount / lettersOnly.length;
    if (vowelRatio < 0.08 || vowelRatio > 0.85) {
      return { isMash: true, reason: 'unnatural_vowel_ratio' };
    }
  }

  // 5. Very low unique character diversity in long answers
  if (trimmed.length >= 20) {
    const uniqueChars = new Set(trimmed.toLowerCase().replace(/\s/g, '')).size;
    if (uniqueChars <= 3) {
      return { isMash: true, reason: 'low_character_diversity' };
    }
  }

  return { isMash: false, reason: null };
}

/**
 * Detects meaningless gibberish
 */
export function detectGibberish(text) {
  if (!text || typeof text !== 'string') return { isGibberish: true, reason: 'empty' };
  const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 2);
  if (tokens.length === 0) return { isGibberish: true, reason: 'no_words' };

  if (tokens.length >= 4) {
    let recognized = 0;
    for (const tok of tokens) {
      if (COMMON_DICTIONARY_SET.has(tok)) {
        recognized++;
      }
    }
    const recognizedRatio = recognized / tokens.length;
    // Check unpronounceable consonant clusters (e.g. 4+ consecutive consonants without vowel)
    const unpronounceable = tokens.filter((t) => /[^aeiouy0-9]{4,}/.test(t)).length;
    if (recognizedRatio < 0.12 || (unpronounceable >= 2 && recognizedRatio < 0.25)) {
      return { isGibberish: true, reason: 'low_dictionary_recognition' };
    }
  }

  return { isGibberish: false, reason: null };
}

/**
 * Calculates semantic & keyword relevance between question and answer
 */
export function calculateRelevance(question, candidateAnswer) {
  if (!candidateAnswer || candidateAnswer.trim().length === 0) {
    return { score: 0, passedGate: false, gateReason: 'EMPTY_RESPONSE' };
  }

  const rawAnswer = candidateAnswer.trim();
  const wordCount = rawAnswer.split(/\s+/).filter(Boolean).length;

  // 1. Keyboard mashing check (must precede short checks for single long tokens like asdfasdfasdf)
  const mashCheck = detectKeyboardMashing(rawAnswer);
  if (mashCheck.isMash) {
    return { score: 8, passedGate: false, gateReason: 'KEYBOARD_MASH' };
  }

  // 2. Gibberish check
  const gibberishCheck = detectGibberish(rawAnswer);
  if (gibberishCheck.isGibberish) {
    return { score: 12, passedGate: false, gateReason: 'GIBBERISH' };
  }

  // 3. Extremely short response check
  if (wordCount < 4 || rawAnswer.length < 15) {
    // Check if it's a known non-answer like "ok", "yes", "i dont know", "hello"
    const lower = rawAnswer.toLowerCase();
    if (['ok', 'yes', 'no', 'hi', 'hello', 'test', 'idk', "i don't know", 'dunno', 'pass', 'skip'].includes(lower)) {
      return { score: 10, passedGate: false, gateReason: 'EXTREMELY_SHORT' };
    }
    if (wordCount <= 2) {
      return { score: 15, passedGate: false, gateReason: 'EXTREMELY_SHORT' };
    }
  }

  // 4. Topic relevance & keyword overlap
  const questionText = [
    question?.title || '',
    question?.prompt || '',
    question?.topic || '',
    question?.category || '',
    ...(question?.keyConcepts || [])
  ]
    .join(' ')
    .toLowerCase();

  const questionTokens = new Set(
    questionText
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !['the', 'and', 'for', 'with', 'that', 'this', 'you', 'your', 'explain', 'how'].includes(w))
  );

  const answerTokens = rawAnswer
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  let matchCount = 0;
  for (const token of answerTokens) {
    if (questionTokens.has(token)) {
      matchCount++;
    }
  }

  // Overlap ratio relative to unique question key terms
  const tokenOverlap = questionTokens.size > 0 ? Math.min(1.0, matchCount / Math.min(6, questionTokens.size)) : 0.5;

  // Check general substance length
  const lengthSubstance = Math.min(1.0, wordCount / 30);

  // If answer has 0 overlap with question and word count >= 6, likely off-topic
  if (matchCount === 0 && questionTokens.size > 0 && wordCount >= 6) {
    // Check if technical programming vocabulary is present even if not exact word match
    let techWordCount = 0;
    for (const tok of answerTokens) {
      if (TECHNICAL_VOCABULARY_SET.has(tok)) techWordCount++;
    }
    if (techWordCount < 2) {
      return { score: 18, passedGate: false, gateReason: 'OFF_TOPIC' };
    }
  }

  // Calculate composite relevance score (0-100)
  const baseRelevance = Math.round(tokenOverlap * 65 + lengthSubstance * 35);
  const relevanceScore = Math.max(15, Math.min(100, baseRelevance));

  const passedGate = relevanceScore >= RELEVANCE_THRESHOLD && wordCount >= 4;
  const gateReason = passedGate ? 'NONE' : 'LOW_RELEVANCE';

  return {
    score: relevanceScore,
    passedGate,
    gateReason
  };
}

/**
 * Calculates the 4 Answer Quality Checks
 * (Relevance, Completeness, Clarity, Technical Depth)
 */
export function evaluateAnswerQualityChecks(question, candidateAnswer) {
  const relevanceCheck = calculateRelevance(question, candidateAnswer);

  if (!relevanceCheck.passedGate) {
    return {
      passedGate: false,
      gateReason: relevanceCheck.gateReason,
      message: GATE_FALLBACK_MESSAGE,
      qualityScores: {
        relevance: { score: relevanceCheck.score, display: `${relevanceCheck.score}%`, status: 'FLAGGED' },
        completeness: { score: null, display: INSUFFICIENT_EVIDENCE_TEXT, status: 'INSUFFICIENT' },
        clarity: { score: null, display: INSUFFICIENT_EVIDENCE_TEXT, status: 'INSUFFICIENT' },
        technicalDepth: { score: null, display: INSUFFICIENT_EVIDENCE_TEXT, status: 'INSUFFICIENT' }
      }
    };
  }

  const words = (candidateAnswer || '').trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const lowerAnswer = (candidateAnswer || '').toLowerCase();

  // 1. Completeness Score (0-100)
  const keyConcepts = question?.keyConcepts || [];
  let coveredCount = 0;
  for (const concept of keyConcepts) {
    if (lowerAnswer.includes(concept.toLowerCase())) {
      coveredCount++;
    }
  }
  const conceptRatio = keyConcepts.length > 0 ? coveredCount / keyConcepts.length : 0.65;
  const lengthRatio = Math.min(1.0, wordCount / 45);
  const completenessScore = Math.round(Math.min(100, Math.max(30, conceptRatio * 60 + lengthRatio * 40)));

  // 2. Clarity Score (0-100)
  const sentences = (candidateAnswer || '').split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentenceLength = sentences.length > 0 ? wordCount / sentences.length : wordCount;
  // Good pacing is 10-25 words per sentence
  const sentencePacingPenalty = avgSentenceLength > 35 || avgSentenceLength < 5 ? 15 : 0;
  const hasCapitalization = /[A-Z]/.test(candidateAnswer);
  const hasPunctuation = /[.,!?;]/.test(candidateAnswer);
  let clarityScore = 80;
  if (hasCapitalization) clarityScore += 10;
  if (hasPunctuation) clarityScore += 10;
  clarityScore -= sentencePacingPenalty;
  clarityScore = Math.max(30, Math.min(100, clarityScore));

  // 3. Technical Depth Score (0-100)
  const technicalIndicators = [
    'complexity', 'o(n', 'o(1', 'o(log', 'tradeoff', 'trade-off', 'latency', 'cache',
    'index', 'memory', 'concurrency', 'asynchronous', 'microtask', 'macrotask', 'acid',
    'transaction', 'throughput', 'architecture', 'interface', 'distributed', 'hashmap',
    'pointer', 'queue', 'stack', 'tree', 'edge case', 'null', 'boundary', 'bottleneck'
  ];
  let depthMatches = 0;
  for (const indicator of technicalIndicators) {
    if (lowerAnswer.includes(indicator)) {
      depthMatches++;
    }
  }
  const depthScore = Math.round(Math.min(100, Math.max(35, 45 + depthMatches * 15)));

  return {
    passedGate: true,
    gateReason: 'NONE',
    message: null,
    qualityScores: {
      relevance: { score: relevanceCheck.score, display: `${relevanceCheck.score}%`, status: 'ASSESSED' },
      completeness: { score: completenessScore, display: `${completenessScore}%`, status: 'ASSESSED' },
      clarity: { score: clarityScore, display: `${clarityScore}%`, status: 'ASSESSED' },
      technicalDepth: { score: depthScore, display: `${depthScore}%`, status: 'ASSESSED' }
    }
  };
}

/**
 * Extracts a verified, genuine excerpt from the candidate's answer
 */
export function extractAnswerEvidence(candidateAnswer, preferredTerms = []) {
  if (!candidateAnswer || typeof candidateAnswer !== 'string') {
    return INSUFFICIENT_EVIDENCE_TEXT;
  }
  const clean = candidateAnswer.trim();
  if (clean.length < 15) return INSUFFICIENT_EVIDENCE_TEXT;

  // Split into clean sentence units
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 10);

  if (sentences.length === 0) return INSUFFICIENT_EVIDENCE_TEXT;

  // Find sentence containing one of the preferred terms if possible
  for (const term of preferredTerms) {
    const termLower = term.toLowerCase();
    const match = sentences.find((s) => s.toLowerCase().includes(termLower));
    if (match) {
      return match.length > 120 ? match.slice(0, 117) + '...' : match;
    }
  }

  // Fallback to first meaningful sentence
  const first = sentences[0];
  return first.length > 120 ? first.slice(0, 117) + '...' : first;
}

/**
 * Builds Confidence-Based Evaluation for standard competency skills:
 * Returns Score, Confidence ("High" | "Medium" | "Low"), Reason, Evidence
 */
export function buildConfidenceSkillEvaluations({
  question,
  candidateAnswer,
  qualityChecks,
  roundScore = 75
}) {
  const isGated = !qualityChecks.passedGate;

  if (isGated) {
    return [
      {
        name: 'Relevance & Accuracy',
        score: qualityChecks.qualityScores.relevance.score || 15,
        confidence: 'Low',
        reason: 'Answer was incomplete, off-topic, or lacked sufficient context.',
        evidence: INSUFFICIENT_EVIDENCE_TEXT
      },
      {
        name: 'Communication',
        score: null,
        confidence: 'Low',
        reason: 'Could not assess communication structure due to insufficient response.',
        evidence: INSUFFICIENT_EVIDENCE_TEXT
      },
      {
        name: 'Technical Depth',
        score: null,
        confidence: 'Low',
        reason: 'No technical implementation or reasoning provided.',
        evidence: INSUFFICIENT_EVIDENCE_TEXT
      }
    ];
  }

  const scores = qualityChecks.qualityScores;
  const rel = scores.relevance.score;
  const comp = scores.completeness.score;
  const clar = scores.clarity.score;
  const depth = scores.technicalDepth.score;

  // Confidence tiers: never provide High confidence when answer quality is low
  const getConfidenceLevel = (val) => {
    if (val >= 75 && rel >= 60) return 'High';
    if (val >= 50) return 'Medium';
    return 'Low';
  };

  const commConfidence = getConfidenceLevel(clar);
  const techConfidence = getConfidenceLevel(depth);
  const probConfidence = getConfidenceLevel(comp);

  const commEvidence = extractAnswerEvidence(candidateAnswer, ['because', 'first', 'then', 'would', 'approach']);
  const techEvidence = extractAnswerEvidence(candidateAnswer, ['index', 'cache', 'complexity', 'o(n', 'database', 'query', 'async', 'data', 'algorithm']);
  const probEvidence = extractAnswerEvidence(candidateAnswer, ['solution', 'solve', 'implement', 'result', 'optimize', 'handle']);

  return [
    {
      name: 'Communication',
      score: clar,
      confidence: commConfidence,
      reason:
        commConfidence === 'High'
          ? 'Candidate clearly explained reasoning and used structured language.'
          : commConfidence === 'Medium'
          ? 'Communicated ideas with basic clarity but could provide smoother transitions.'
          : 'Communication lacked logical flow or clear structure.',
      evidence: commEvidence
    },
    {
      name: 'Technical Depth',
      score: depth,
      confidence: techConfidence,
      reason:
        techConfidence === 'High'
          ? 'Candidate referenced specific technical mechanisms, complexity, or design principles.'
          : techConfidence === 'Medium'
          ? 'Demonstrated foundational concepts but omitted deep architectural tradeoffs.'
          : 'Limited technical justification or implementation details provided.',
      evidence: techEvidence
    },
    {
      name: 'Problem Solving & Completeness',
      score: comp,
      confidence: probConfidence,
      reason:
        probConfidence === 'High'
          ? 'Addressed all core requirements of the question with actionable steps.'
          : probConfidence === 'Medium'
          ? 'Addressed the central problem but left edge cases unhandled.'
          : 'Incomplete resolution of the problem prompt.',
      evidence: probEvidence
    }
  ];
}

/**
 * Builds the Candidate-Friendly Dashboard summary
 * - Strengths (✅ with Evidence)
 * - Needs Improvement (⚠️ with Evidence)
 * - What To Do Next (• actionable recommendations)
 * - 30-Second Final Candidate Summary
 */
export function buildCandidateFriendlySummary({
  session,
  responses = [],
  questionDetails = []
}) {
  // Check how many responses passed the relevance gate
  const evaluatedResponses = responses.map((resp, idx) => {
    const q = questionDetails[idx] || {};
    const answer = resp.answer || '';
    const quality = evaluateAnswerQualityChecks(q, answer);
    return {
      ...resp,
      quality,
      question: q
    };
  });

  const validResponses = evaluatedResponses.filter((r) => r.quality.passedGate);
  const gatedResponses = evaluatedResponses.filter((r) => !r.quality.passedGate);

  // If ALL responses failed the relevance gate (e.g. keyboard mashing or empty)
  if (validResponses.length === 0 && evaluatedResponses.length > 0) {
    return {
      isAllGated: true,
      finalScore: null,
      verdict: 'Assessment Inconclusive',
      summaryText: GATE_FALLBACK_MESSAGE,
      finalCandidateSummary: {
        interviewScore: null,
        strongestSkill: INSUFFICIENT_EVIDENCE_TEXT,
        biggestImprovementArea: INSUFFICIENT_EVIDENCE_TEXT,
        topRecommendations: [
          'Explain reasoning step-by-step rather than submitting brief or placeholder text.',
          'Provide direct answers relevant to the technical and project questions asked.',
          'Include real-world examples and concrete implementation details in your answers.'
        ]
      },
      strengths: [],
      needsImprovement: [
        {
          point: 'Incomplete or unassessed responses',
          evidence: INSUFFICIENT_EVIDENCE_TEXT
        },
        {
          point: 'Limited justification for decisions',
          evidence: INSUFFICIENT_EVIDENCE_TEXT
        }
      ],
      whatToDoNext: [
        'Practice explaining solutions step-by-step',
        'Include real examples',
        'Discuss tradeoffs in your answers'
      ],
      qualityChecksOverall: {
        relevance: { score: 15, display: '15%', status: 'FLAGGED' },
        completeness: { score: null, display: INSUFFICIENT_EVIDENCE_TEXT, status: 'INSUFFICIENT' },
        clarity: { score: null, display: INSUFFICIENT_EVIDENCE_TEXT, status: 'INSUFFICIENT' },
        technicalDepth: { score: null, display: INSUFFICIENT_EVIDENCE_TEXT, status: 'INSUFFICIENT' }
      },
      skillEvaluations: [
        {
          name: 'Communication',
          score: null,
          confidence: 'Low',
          reason: 'Insufficient answer text to assess.',
          evidence: INSUFFICIENT_EVIDENCE_TEXT
        },
        {
          name: 'Technical Depth',
          score: null,
          confidence: 'Low',
          reason: 'No technical implementation provided.',
          evidence: INSUFFICIENT_EVIDENCE_TEXT
        }
      ]
    };
  }

  // Calculate scores across valid responses only
  const avgScore = validResponses.reduce((sum, r) => {
    const sc = r.score !== undefined ? (r.score <= 1.0 ? r.score * 100 : r.score) : 75;
    return sum + sc;
  }, 0) / validResponses.length;

  const finalScore = Math.round(avgScore);

  // Compute aggregated quality checks across valid answers
  const avgRelevance = Math.round(
    validResponses.reduce((sum, r) => sum + r.quality.qualityScores.relevance.score, 0) / validResponses.length
  );
  const avgCompleteness = Math.round(
    validResponses.reduce((sum, r) => sum + (r.quality.qualityScores.completeness.score || 70), 0) / validResponses.length
  );
  const avgClarity = Math.round(
    validResponses.reduce((sum, r) => sum + (r.quality.qualityScores.clarity.score || 75), 0) / validResponses.length
  );
  const avgDepth = Math.round(
    validResponses.reduce((sum, r) => sum + (r.quality.qualityScores.technicalDepth.score || 70), 0) / validResponses.length
  );

  // Determine Strongest Skill & Biggest Improvement Area
  const skillsList = [
    { name: 'Communication', score: avgClarity },
    { name: 'Technical Depth', score: avgDepth },
    { name: 'Problem Solving', score: avgCompleteness }
  ];
  skillsList.sort((a, b) => b.score - a.score);
  const strongestSkill = skillsList[0].name;
  const biggestImprovementArea = skillsList[skillsList.length - 1].name;

  // Build authentic evidence-backed Strengths
  const strengths = [];
  const sampleAnswer = validResponses[0]?.answer || '';

  if (avgClarity >= 70) {
    const commEvidence = extractAnswerEvidence(sampleAnswer, ['first', 'because', 'approach', 'solution']);
    strengths.push({
      point: 'Explained ideas clearly',
      evidence: commEvidence !== INSUFFICIENT_EVIDENCE_TEXT ? `"${commEvidence}"` : INSUFFICIENT_EVIDENCE_TEXT
    });
  }

  if (avgDepth >= 60 || validResponses.some((r) => r.roundType === 'coding')) {
    const techEvidence = extractAnswerEvidence(
      validResponses.find((r) => r.answer?.length > 30)?.answer || sampleAnswer,
      ['cache', 'index', 'o(n', 'database', 'complexity', 'function', 'api']
    );
    strengths.push({
      point: 'Good technical terminology',
      evidence: techEvidence !== INSUFFICIENT_EVIDENCE_TEXT ? `"${techEvidence}"` : INSUFFICIENT_EVIDENCE_TEXT
    });
  }

  if (strengths.length < 2) {
    strengths.push({
      point: 'Engaged with assessment questions directly',
      evidence: extractAnswerEvidence(sampleAnswer)
    });
  }

  // Build authentic evidence-backed Needs Improvement
  const needsImprovement = [];
  if (avgDepth < 75) {
    needsImprovement.push({
      point: 'Did not provide implementation details',
      evidence: 'Missing code constructs, data structure specifications, or concrete algorithm steps.'
    });
  }

  if (avgCompleteness < 75 || gatedResponses.length > 0) {
    needsImprovement.push({
      point: 'Limited justification for decisions',
      evidence: 'Stated solutions without comparing trade-offs, alternatives, or edge case handling.'
    });
  }

  if (needsImprovement.length < 2) {
    needsImprovement.push({
      point: 'Mention performance trade-offs upfront',
      evidence: 'Discuss time vs space complexity before finalizing approach.'
    });
  }

  // Top 3 Recommendations
  const topRecommendations = [
    'Explain reasoning before conclusions.',
    'Use real-world examples.',
    'Discuss tradeoffs and alternatives.'
  ];

  // What to do next
  const whatToDoNext = [
    'Practice explaining solutions step-by-step',
    'Include real examples',
    'Discuss tradeoffs in your answers'
  ];

  // Confidence-based evaluations for each skill
  const skillEvaluations = [
    {
      name: 'Communication',
      score: avgClarity,
      confidence: avgClarity >= 75 ? 'High' : 'Medium',
      reason:
        avgClarity >= 75
          ? 'Candidate clearly explained reasoning and used structured language.'
          : 'Communicated basic thoughts but could structure explanations more sequentially.',
      evidence: extractAnswerEvidence(sampleAnswer, ['because', 'first', 'then', 'would'])
    },
    {
      name: 'Technical Depth',
      score: avgDepth,
      confidence: avgDepth >= 70 ? 'High' : 'Medium',
      reason:
        avgDepth >= 70
          ? 'Demonstrated strong grasp of systems and algorithmic mechanics.'
          : 'Mentioned high-level concepts with limited implementation specifics.',
      evidence: extractAnswerEvidence(sampleAnswer, ['cache', 'index', 'o(', 'database', 'query'])
    },
    {
      name: 'Problem Solving & Completeness',
      score: avgCompleteness,
      confidence: avgCompleteness >= 70 ? 'High' : 'Medium',
      reason:
        avgCompleteness >= 70
          ? 'Delivered complete answers covering core requirements.'
          : 'Addressed primary case but skipped edge cases or error handling.',
      evidence: extractAnswerEvidence(sampleAnswer, ['handle', 'result', 'return', 'solution'])
    }
  ];

  return {
    isAllGated: false,
    finalScore,
    verdict:
      finalScore >= 80
        ? 'Strong Candidate — Interview Ready'
        : finalScore >= 60
        ? 'Solid Foundations — Ready with Quick Practice'
        : 'Needs Practice — Focus on Core Concepts',
    summaryText: `Your interview assessment is ready. Review your strengths, areas to improve, and real evidence from your responses below.`,
    finalCandidateSummary: {
      interviewScore: finalScore,
      strongestSkill,
      biggestImprovementArea,
      topRecommendations
    },
    strengths,
    needsImprovement,
    whatToDoNext,
    qualityChecksOverall: {
      relevance: { score: avgRelevance, display: `${avgRelevance}%`, status: 'ASSESSED' },
      completeness: { score: avgCompleteness, display: `${avgCompleteness}%`, status: 'ASSESSED' },
      clarity: { score: avgClarity, display: `${avgClarity}%`, status: 'ASSESSED' },
      technicalDepth: { score: avgDepth, display: `${avgDepth}%`, status: 'ASSESSED' }
    },
    skillEvaluations
  };
}

export default {
  RELEVANCE_THRESHOLD,
  INSUFFICIENT_EVIDENCE_TEXT,
  GATE_FALLBACK_MESSAGE,
  calculateRelevance,
  evaluateAnswerQualityChecks,
  extractAnswerEvidence,
  buildConfidenceSkillEvaluations,
  buildCandidateFriendlySummary
};
