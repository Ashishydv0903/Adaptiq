/**
 * @file Multi-Round Assessment Configuration per Track
 * Configures the sequential interview rounds, target questions, and server-enforced timer limits.
 */

export const ROUND_TYPES = {
  MCQ: 'mcq',
  TECHNICAL: 'technical',
  CODING: 'coding',
  SYSTEM_DESIGN: 'system_design',
  BEHAVIORAL: 'behavioral',
  HR: 'hr'
};

export const DEFAULT_ROUND_TIMERS = {
  [ROUND_TYPES.MCQ]: 90,           // 1.5 minutes per MCQ
  [ROUND_TYPES.TECHNICAL]: 180,    // 3 minutes per open-ended technical
  [ROUND_TYPES.CODING]: 600,       // 10 minutes per coding challenge
  [ROUND_TYPES.SYSTEM_DESIGN]: 420,// 7 minutes per system architecture
  [ROUND_TYPES.BEHAVIORAL]: 240,   // 4 minutes for STAR response
  [ROUND_TYPES.HR]: 180            // 3 minutes for culture & alignment
};

export const TIMER_GRACE_PERIOD_SECONDS = 15; // Network latency buffer for server validation

/**
 * Multi-round configurations across all 5 career tracks
 */
export const TRACK_ROUNDS = {
  fullstack: [
    { roundType: ROUND_TYPES.MCQ, label: 'Core Fundamentals MCQ', targetQuestions: 2, defaultTimerSeconds: 90 },
    { roundType: ROUND_TYPES.TECHNICAL, label: 'Full-Stack Technical Depth', targetQuestions: 2, defaultTimerSeconds: 180 },
    { roundType: ROUND_TYPES.CODING, label: 'Algorithmic Coding Challenge', targetQuestions: 1, defaultTimerSeconds: 600 },
    { roundType: ROUND_TYPES.SYSTEM_DESIGN, label: 'Distributed System Design', targetQuestions: 1, defaultTimerSeconds: 420 },
    { roundType: ROUND_TYPES.BEHAVIORAL, label: 'Engineering Ownership (STAR)', targetQuestions: 1, defaultTimerSeconds: 240 },
    { roundType: ROUND_TYPES.HR, label: 'Culture & Collaboration', targetQuestions: 1, defaultTimerSeconds: 180 }
  ],
  frontend: [
    { roundType: ROUND_TYPES.MCQ, label: 'Web Vitals & React MCQs', targetQuestions: 2, defaultTimerSeconds: 90 },
    { roundType: ROUND_TYPES.TECHNICAL, label: 'State & Component Architecture', targetQuestions: 2, defaultTimerSeconds: 180 },
    { roundType: ROUND_TYPES.CODING, label: 'Interactive UI Algorithm', targetQuestions: 1, defaultTimerSeconds: 600 },
    { roundType: ROUND_TYPES.BEHAVIORAL, label: 'Design System Collaboration (STAR)', targetQuestions: 1, defaultTimerSeconds: 240 },
    { roundType: ROUND_TYPES.HR, label: 'Agile & Team Dynamics', targetQuestions: 1, defaultTimerSeconds: 180 }
  ],
  backend: [
    { roundType: ROUND_TYPES.MCQ, label: 'Database & OS Fundamentals', targetQuestions: 2, defaultTimerSeconds: 90 },
    { roundType: ROUND_TYPES.TECHNICAL, label: 'Concurrency & Caching Depth', targetQuestions: 2, defaultTimerSeconds: 180 },
    { roundType: ROUND_TYPES.CODING, label: 'Data Structures & API Logic', targetQuestions: 1, defaultTimerSeconds: 600 },
    { roundType: ROUND_TYPES.SYSTEM_DESIGN, label: 'Microservices & Event Streams', targetQuestions: 1, defaultTimerSeconds: 420 },
    { roundType: ROUND_TYPES.BEHAVIORAL, label: 'Incident Triage & Post-Mortem (STAR)', targetQuestions: 1, defaultTimerSeconds: 240 },
    { roundType: ROUND_TYPES.HR, label: 'Mentorship & Values Alignment', targetQuestions: 1, defaultTimerSeconds: 180 }
  ],
  devops: [
    { roundType: ROUND_TYPES.MCQ, label: 'Cloud & Linux Networking MCQs', targetQuestions: 2, defaultTimerSeconds: 90 },
    { roundType: ROUND_TYPES.TECHNICAL, label: 'CI/CD & Container Orchestration', targetQuestions: 2, defaultTimerSeconds: 180 },
    { roundType: ROUND_TYPES.SYSTEM_DESIGN, label: 'High Availability & SRE Architecture', targetQuestions: 1, defaultTimerSeconds: 420 },
    { roundType: ROUND_TYPES.BEHAVIORAL, label: 'Production Outage Management (STAR)', targetQuestions: 1, defaultTimerSeconds: 240 },
    { roundType: ROUND_TYPES.HR, label: 'Blameless Culture & Communication', targetQuestions: 1, defaultTimerSeconds: 180 }
  ],
  datascience: [
    { roundType: ROUND_TYPES.MCQ, label: 'Statistics & Linear Algebra MCQs', targetQuestions: 2, defaultTimerSeconds: 90 },
    { roundType: ROUND_TYPES.TECHNICAL, label: 'Feature Engineering & Model Evaluation', targetQuestions: 2, defaultTimerSeconds: 180 },
    { roundType: ROUND_TYPES.CODING, label: 'Data Pipelines & Vector Processing', targetQuestions: 1, defaultTimerSeconds: 600 },
    { roundType: ROUND_TYPES.BEHAVIORAL, label: 'Communicating Complex Models (STAR)', targetQuestions: 1, defaultTimerSeconds: 240 },
    { roundType: ROUND_TYPES.HR, label: 'AI Ethics & Alignment', targetQuestions: 1, defaultTimerSeconds: 180 }
  ]
};

/**
 * Initializes round progression array for a session
 *
 * @param {string} track
 * @returns {Array<Object>} Initialized rounds
 */
export function getTrackRounds(track = 'fullstack') {
  const template = TRACK_ROUNDS[track] || TRACK_ROUNDS.fullstack;
  return template.map((r, index) => ({
    roundType: r.roundType,
    label: r.label,
    targetQuestions: r.targetQuestions,
    completedQuestions: 0,
    defaultTimerSeconds: r.defaultTimerSeconds,
    status: index === 0 ? 'in_progress' : 'pending',
    score: 0
  }));
}

/**
 * Calculates total planned questions for a track
 *
 * @param {string} track
 * @returns {number}
 */
export function getTotalTrackQuestions(track = 'fullstack') {
  const rounds = TRACK_ROUNDS[track] || TRACK_ROUNDS.fullstack;
  return rounds.reduce((sum, r) => sum + r.targetQuestions, 0);
}
