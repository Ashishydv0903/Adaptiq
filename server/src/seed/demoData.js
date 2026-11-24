/**
 * @file Comprehensive Demo Data Seeder
 * Populates realistic, rich demo data across all roles:
 * - Demo users: Candidate (Alan Turing), Recruiter (Grace Hopper), Admin (Ada Lovelace) + cohort candidates
 * - 12 completed assessment sessions with realistic theta trajectories
 * - Explainable AI evaluations with SHAP attributions, rubric scores, and counterfactuals
 * - Comprehensive learning roadmap with milestone progress
 * - Proctoring events (red alerts, yellow warnings, and recruiter-dismissed anomalies)
 * - Review-queue items (flagged responses with low AI confidence)
 * - Admin question approval queue (pending AI-generated questions)
 *
 * All demo records are marked with isDemo: true.
 */

import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  User,
  Skill,
  Question,
  Resource,
  AssessmentSession,
  ResponseEvaluation,
  Roadmap
} from '../models/index.js';
import { seedDatabase } from './index.js';

export async function seedDemoData() {
  try {
    logger.info('🚀 Initiating AdaptIQ comprehensive demo data seed...');
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(env.MONGO_URI);
      logger.info(`Connected to MongoDB: ${env.MONGO_URI}`);
    }

    // 1. Ensure foundation skills and questions are present
    const questionCount = await Question.countDocuments();
    if (questionCount === 0) {
      logger.info('Base questions missing, running initial database seed...');
      await seedDatabase();
    }

    // 2. Clean up previous demo data & users
    const demoEmails = [
      'candidate@adaptiq.ai',
      'recruiter@adaptiq.ai',
      'admin@adaptiq.ai',
      'elena.rostova@example.com',
      'sarah.connor@example.com',
      'marcus.vance@example.com',
      'aisha.khan@example.com',
      'chen.wei@example.com',
      'carlos.mendez@example.com',
      'david.bowman@example.com',
      'alex.rivera@example.com'
    ];

    await User.deleteMany({ $or: [{ isDemo: true }, { email: { $in: demoEmails } }] });
    await AssessmentSession.deleteMany({ isDemo: true });
    await ResponseEvaluation.deleteMany({ isDemo: true });
    await Roadmap.deleteMany({ isDemo: true });
    await Question.deleteMany({ isDemo: true });

    logger.info('Cleaned previous demo records.');

    // 3. Create Demo Users
    const demoCandidate = await User.create({
      name: 'Alan Turing (Candidate)',
      email: 'candidate@adaptiq.ai',
      password: 'Candidate@123456',
      role: 'candidate',
      demographicGroup: 'minority',
      isDemo: true,
      profile: {
        headline: 'Senior Full-Stack Engineer & Distributed Systems Architect',
        targetRole: 'Senior Fullstack Engineer',
        resumeFileName: 'alan_turing_senior_resume.pdf',
        resumeText: `ALAN TURING - Senior Fullstack & Distributed Systems Engineer
Experience:
- Lead Architect at Bletchley Tech (2021-Present): Designed high-throughput microservices handling 50k req/s using Node.js, TypeScript, Kafka, and Redis.
- Senior Software Engineer at Enigma Software (2018-2021): Implemented React single-page applications, REST APIs, and MongoDB sharded clusters.
Skills: JavaScript, TypeScript, React, Node.js, Express, Redis, Docker, Kubernetes, PostgreSQL, MongoDB, Distributed Transactions, IRT Systems.`,
        savedJDText: `Senior Fullstack Engineer (Fintech Scale)
Requirements:
- 5+ years building distributed web applications with React and Node.js
- In-depth mastery of caching layers (Redis), event-driven architectures (Kafka), and database indexing
- Solid algorithms, system design, and security best practices`,
        resumeUpdatedAt: new Date(Date.now() - 3600000 * 24 * 2)
      }
    });

    const demoRecruiter = await User.create({
      name: 'Grace Hopper (Recruiter)',
      email: 'recruiter@adaptiq.ai',
      password: 'Recruiter@123456',
      role: 'recruiter',
      demographicGroup: 'majority',
      isDemo: true
    });

    const demoAdmin = await User.create({
      name: 'Ada Lovelace (Admin)',
      email: 'admin@adaptiq.ai',
      password: 'Admin@123456',
      role: 'admin',
      demographicGroup: 'majority',
      isDemo: true
    });

    // Additional cohort candidates for recruiter candidate lists and EEOC fairness analytics
    const cohortCandidates = [
      { name: 'Elena Rostova', email: 'elena.rostova@example.com', group: 'majority', role: 'candidate' },
      { name: 'Sarah Connor', email: 'sarah.connor@example.com', group: 'majority', role: 'candidate' },
      { name: 'Marcus Vance', email: 'marcus.vance@example.com', group: 'minority', role: 'candidate' },
      { name: 'Aisha Khan', email: 'aisha.khan@example.com', group: 'minority', role: 'candidate' },
      { name: 'Chen Wei', email: 'chen.wei@example.com', group: 'minority', role: 'candidate' },
      { name: 'Carlos Mendez', email: 'carlos.mendez@example.com', group: 'minority', role: 'candidate' },
      { name: 'David Bowman', email: 'david.bowman@example.com', group: 'majority', role: 'candidate' },
      { name: 'Alex Rivera', email: 'alex.rivera@example.com', group: 'minority', role: 'candidate' }
    ];

    const createdCohortUsers = [];
    for (const c of cohortCandidates) {
      const u = await User.create({
        name: c.name,
        email: c.email,
        password: 'Password@123456',
        role: 'candidate',
        demographicGroup: c.group,
        isDemo: true
      });
      createdCohortUsers.push(u);
    }

    logger.info(`✅ Seeded demo users: 1 Candidate, 1 Recruiter, 1 Admin, plus ${createdCohortUsers.length} cohort candidates`);

    // 4. Fetch Question Bank
    const allQuestions = await Question.find({ status: 'active' }).limit(30);
    const fallbackQId = allQuestions[0]?._id || new mongoose.Types.ObjectId();

    // Helper to generate realistic theta trajectories
    const candidatePool = [demoCandidate, ...createdCohortUsers];
    const tracks = ['fullstack', 'backend', 'frontend', 'devops', 'datascience'];

    // 5. Seed 12 Completed Sessions with realistic theta trajectories and proctoring events
    logger.info('Seeding 12 completed assessment sessions with realistic IRT latent trait calibration...');

    const sessionsData = [
      // 1. High Performer (Alan Turing) - Clean Proctoring
      {
        candidate: demoCandidate,
        track: 'fullstack',
        status: 'completed',
        isProctored: true,
        theta: +1.65,
        sem: 0.28,
        percentile: 94.2,
        integrityScore: 98,
        integrityStatus: 'GREEN',
        redAlerts: false,
        dismissed: false,
        flaggedReview: false
      },
      // 2. Strong Backend Candidate (Elena) - Clean Proctoring
      {
        candidate: createdCohortUsers[0],
        track: 'backend',
        status: 'completed',
        isProctored: true,
        theta: +1.82,
        sem: 0.26,
        percentile: 96.5,
        integrityScore: 100,
        integrityStatus: 'GREEN',
        redAlerts: false,
        dismissed: false,
        flaggedReview: false
      },
      // 3. Medium Frontend Performer (Sarah) - 1 Red Alert (Multiple Faces) - Recruiter Dismissed
      {
        candidate: createdCohortUsers[1],
        track: 'frontend',
        status: 'reviewed',
        isProctored: true,
        theta: +0.72,
        sem: 0.32,
        percentile: 76.4,
        integrityScore: 82,
        integrityStatus: 'ORANGE',
        redAlerts: true,
        dismissed: true,
        flaggedReview: true
      },
      // 4. Junior Fullstack Candidate (Marcus) - Red Alert Active (Cell Phone Detected)
      {
        candidate: createdCohortUsers[2],
        track: 'fullstack',
        status: 'flagged',
        isProctored: true,
        theta: -0.45,
        sem: 0.38,
        percentile: 32.6,
        integrityScore: 45,
        integrityStatus: 'RED',
        redAlerts: true,
        dismissed: false,
        flaggedReview: true
      },
      // 5. Solid DevOps Candidate (Aisha) - Clean Proctoring
      {
        candidate: createdCohortUsers[3],
        track: 'devops',
        status: 'completed',
        isProctored: true,
        theta: +1.15,
        sem: 0.30,
        percentile: 87.5,
        integrityScore: 96,
        integrityStatus: 'GREEN',
        redAlerts: false,
        dismissed: false,
        flaggedReview: false
      },
      // 6. Data Science Specialist (Chen) - Minor Yellow Alert (Tab Switch)
      {
        candidate: createdCohortUsers[4],
        track: 'datascience',
        status: 'completed',
        isProctored: true,
        theta: +1.40,
        sem: 0.29,
        percentile: 91.9,
        integrityScore: 88,
        integrityStatus: 'YELLOW',
        redAlerts: false,
        dismissed: false,
        flaggedReview: false
      },
      // 7. Fullstack Mid-level (Carlos) - Clean Proctoring
      {
        candidate: createdCohortUsers[5],
        track: 'fullstack',
        status: 'completed',
        isProctored: true,
        theta: +0.25,
        sem: 0.34,
        percentile: 59.8,
        integrityScore: 95,
        integrityStatus: 'GREEN',
        redAlerts: false,
        dismissed: false,
        flaggedReview: false
      },
      // 8. Backend Senior (David) - Clean Proctoring
      {
        candidate: createdCohortUsers[6],
        track: 'backend',
        status: 'completed',
        isProctored: true,
        theta: +1.28,
        sem: 0.31,
        percentile: 89.9,
        integrityScore: 99,
        integrityStatus: 'GREEN',
        redAlerts: false,
        dismissed: false,
        flaggedReview: false
      },
      // 9. Frontend Lead (Alex) - Review Queue item (borderline heuristic evaluation)
      {
        candidate: createdCohortUsers[7],
        track: 'frontend',
        status: 'completed',
        isProctored: true,
        theta: +0.95,
        sem: 0.33,
        percentile: 82.9,
        integrityScore: 94,
        integrityStatus: 'GREEN',
        redAlerts: false,
        dismissed: false,
        flaggedReview: true
      },
      // 10. Alan Turing 2nd Assessment (DevOps Track) - Practice Sandbox
      {
        candidate: demoCandidate,
        track: 'devops',
        status: 'completed',
        isProctored: false,
        theta: +0.88,
        sem: 0.33,
        percentile: 81.1,
        integrityScore: 100,
        integrityStatus: 'GREEN',
        redAlerts: false,
        dismissed: false,
        flaggedReview: false
      },
      // 11. Backend Architect (Marcus) - Multiple Looking Away Events (Orange Alert)
      {
        candidate: createdCohortUsers[2],
        track: 'backend',
        status: 'completed',
        isProctored: true,
        theta: +0.55,
        sem: 0.35,
        percentile: 70.8,
        integrityScore: 78,
        integrityStatus: 'ORANGE',
        redAlerts: false,
        dismissed: true,
        flaggedReview: false
      },
      // 12. Fullstack Graduate (Aisha) - Clean Practice Track
      {
        candidate: createdCohortUsers[3],
        track: 'fullstack',
        status: 'completed',
        isProctored: false,
        theta: +0.10,
        sem: 0.36,
        percentile: 53.9,
        integrityScore: 100,
        integrityStatus: 'GREEN',
        redAlerts: false,
        dismissed: false,
        flaggedReview: false
      }
    ];

    const createdSessions = [];

    for (let i = 0; i < sessionsData.length; i++) {
      const s = sessionsData[i];
      const sessionStartDate = new Date(Date.now() - 3600000 * 24 * (12 - i));
      const sessionEndDate = new Date(sessionStartDate.getTime() + 1000 * 60 * 35);

      // Build realistic theta trajectory across 5 questions
      const finalTheta = s.theta;
      const trajectory = [
        { theta: 0.0, sem: 1.0, score: 70 },
        { theta: Number((finalTheta * 0.35).toFixed(2)), sem: 0.72, score: finalTheta > 0 ? 80 : 45 },
        { theta: Number((finalTheta * 0.65).toFixed(2)), sem: 0.52, score: finalTheta > 0 ? 85 : 50 },
        { theta: Number((finalTheta * 0.88).toFixed(2)), sem: 0.38, score: finalTheta > 0 ? 90 : 40 },
        { theta: finalTheta, sem: s.sem, score: finalTheta > 0 ? 92 : 35 }
      ];

      const responses = [];
      const proctorEvents = [];
      const auditLog = [];

      // Add proctoring events if flagged or red
      if (s.redAlerts) {
        proctorEvents.push({
          eventType: 'multiple_faces',
          severity: 'CRITICAL',
          timestamp: new Date(sessionStartDate.getTime() + 1000 * 60 * 8),
          scoreDeduction: 25,
          metadata: { faceCount: 2, message: 'Secondary face identified in camera viewport.' }
        });
        auditLog.push({
          eventType: 'multiple_faces',
          severity: 'CRITICAL',
          deduction: 25,
          timestamp: new Date(sessionStartDate.getTime() + 1000 * 60 * 8),
          metadata: { faceCount: 2 }
        });
      }

      if (s.integrityStatus === 'YELLOW' || s.integrityStatus === 'ORANGE') {
        proctorEvents.push({
          eventType: 'tab_switch',
          severity: 'WARNING',
          timestamp: new Date(sessionStartDate.getTime() + 1000 * 60 * 12),
          scoreDeduction: 10,
          metadata: { durationSeconds: 6, message: 'Browser window blur / focus loss.' }
        });
        auditLog.push({
          eventType: 'tab_switch',
          severity: 'WARNING',
          deduction: 10,
          timestamp: new Date(sessionStartDate.getTime() + 1000 * 60 * 12)
        });
      }

      const recruiterNotes = [];
      if (s.dismissed) {
        recruiterNotes.push({
          note: 'Proctoring review complete: candidate had an in-room monitor reflection. False positive cleared.',
          authorEmail: 'recruiter@adaptiq.ai',
          authorRole: 'recruiter',
          createdAt: new Date(sessionEndDate.getTime() + 1000 * 60 * 15)
        });
      }

      // Generate responses
      for (let qIdx = 0; qIdx < trajectory.length; qIdx++) {
        const step = trajectory[qIdx];
        const question = allQuestions[qIdx % allQuestions.length] || allQuestions[0];
        const qId = question._id || fallbackQId;

        const isFlaggedForHumanReview = s.flaggedReview && qIdx === 2;

        responses.push({
          questionId: qId,
          roundType: question.roundType || (qIdx === 2 ? 'coding' : 'technical'),
          answer: `Demonstration response covering architectural patterns, trade-offs, and scaling bounds for ${question.title || 'engineering topic'}.`,
          score: step.score,
          evaluatedBy: isFlaggedForHumanReview ? 'heuristic' : 'llm',
          thetaAfter: step.theta,
          semAfter: step.sem,
          answeredAt: new Date(sessionStartDate.getTime() + 1000 * 60 * (qIdx * 6 + 4)),
          durationSeconds: 120,
          confidenceScore: isFlaggedForHumanReview ? 0.38 : 0.88,
          reviewStatus: isFlaggedForHumanReview ? 'flagged_review' : 'not_flagged',
          serverValidatedTimer: {
            allowedSeconds: 180,
            actualSeconds: 120,
            timeExpired: false
          }
        });
      }

      const sessionDoc = await AssessmentSession.create({
        candidateId: s.candidate._id,
        track: s.track,
        status: s.status,
        isProctored: s.isProctored,
        isDemo: true,
        targetRole: `${s.track.charAt(0).toUpperCase() + s.track.slice(1)} Engineer`,
        targetCompany: 'Fintech Cloud Technologies',
        abilityTheta: s.theta,
        abilitySem: s.sem,
        percentileScore: s.percentile,
        integrityScore: s.integrityScore,
        integrityStatus: s.integrityStatus,
        integrityMetrics: {
          facePresencePct: s.integrityStatus === 'RED' ? 72 : 98,
          focusRetentionPct: s.integrityStatus === 'RED' ? 68 : 96,
          tabSwitchCount: s.integrityStatus === 'RED' ? 4 : s.integrityStatus === 'YELLOW' ? 1 : 0,
          cameraAvailable: true,
          micAvailable: true,
          trustScore: s.integrityScore
        },
        recruiterNotes,
        proctoringEvents: proctorEvents,
        auditLog: auditLog,
        responses: responses,
        totalQuestions: 5,
        startedAt: sessionStartDate,
        completedAt: sessionEndDate
      });

      createdSessions.push(sessionDoc);

      // Create rich ResponseEvaluation records for first 2 responses with SHAP feature attributions
      for (let rIdx = 0; rIdx < Math.min(2, responses.length); rIdx++) {
        const resp = responses[rIdx];
        await ResponseEvaluation.create({
          sessionId: sessionDoc._id,
          questionId: resp.questionId,
          candidateAnswer: resp.answer,
          score: resp.score,
          rawScore: resp.score / 10,
          isDemo: true,
          evaluatedBy: resp.evaluatedBy,
          model: 'gemini-1.5-flash',
          rubricScores: {
            correctness: Math.min(10, Math.max(1, Math.round(resp.score / 10))),
            depth: Math.min(10, Math.max(1, Math.round(resp.score / 10 - 0.5))),
            clarity: 8.5,
            completeness: 8.0,
            relevance: 9.0
          },
          shap: {
            correctness: +1.65,
            depth: +1.10,
            clarity: +0.45,
            completeness: +0.30,
            relevance: +0.80
          },
          shapAttributions: {
            correctness: { value: 8.5, attribution: +1.65, baseline: 5.0 },
            depth: { value: 7.5, attribution: +1.10, baseline: 5.0 },
            clarity: { value: 8.5, attribution: +0.45, baseline: 5.0 },
            completeness: { value: 8.0, attribution: +0.30, baseline: 5.0 },
            relevance: { value: 9.0, attribution: +0.80, baseline: 5.0 }
          },
          counterfactuals: [
            {
              concept: 'Distributed Cache Invalidation',
              currentStatus: 'Partial Coverage',
              potentialGain: 8,
              simulatedScore: resp.score + 8,
              currentScore: resp.score,
              recommendation: 'Explicitly describe Cache-Aside probabilistic early expiration and CDC invalidation streams.',
              dimension: 'depth'
            },
            {
              concept: 'Split-Brain Mitigation',
              currentStatus: 'Missing',
              potentialGain: 6,
              simulatedScore: resp.score + 14,
              currentScore: resp.score,
              recommendation: 'Detail quorum read/write consistency leases under network partition partitions.',
              dimension: 'correctness'
            }
          ],
          feedback: {
            strengths: [
              'Clear and structured explanation of service architecture boundaries.',
              'Good understanding of database write-behind buffering.'
            ],
            improvements: [
              'Include explicit fault isolation and retry backoff formulas.',
              'Discuss memory tradeoffs when caching unindexed objects.'
            ],
            summary: 'Strong technical foundations with concise technical vocabulary.'
          }
        });
      }
    }

    logger.info(`✅ Seeded ${createdSessions.length} complete sessions across 5 tracks with realistic theta trajectories.`);

    // 6. Seed Learning Roadmap for demoCandidate
    logger.info('Seeding candidate personalized learning roadmap...');
    const demoRoadmap = await Roadmap.create({
      candidateId: demoCandidate._id,
      targetRole: 'Senior Fullstack Engineer',
      matchPercentage: 74,
      isDemo: true,
      skillGaps: [
        {
          skillName: 'Distributed Caching (Redis)',
          currentMastery: 0.35,
          requiredLevel: 0.75,
          gap: 0.40,
          priority: 'Critical'
        },
        {
          skillName: 'Kubernetes Container Orchestration',
          currentMastery: 0.45,
          requiredLevel: 0.70,
          gap: 0.25,
          priority: 'Critical'
        },
        {
          skillName: 'Database Indexing & Query Plans',
          currentMastery: 0.55,
          requiredLevel: 0.75,
          gap: 0.20,
          priority: 'Medium'
        }
      ],
      milestones: [
        {
          title: 'Milestone 1: High-Performance Distributed Caching',
          description: 'Master Redis caching strategies, TTL jitter, cache stampede prevention, and CDC invalidation pipelines.',
          durationWeeks: 2,
          skillsTargeted: ['Distributed Caching (Redis)'],
          resources: [
            {
              title: 'Redis Patterns and Anti-Patterns in High Scale Apps',
              type: 'article',
              url: 'https://redis.io/docs/manual/patterns/',
              difficulty: 'Intermediate'
            },
            {
              title: 'Building Cache-Aside with Asynchronous Invalidation in Node.js',
              type: 'project',
              url: 'https://github.com/adaptiq/redis-cache-aside-demo',
              difficulty: 'Advanced'
            }
          ]
        },
        {
          title: 'Milestone 2: Kubernetes Deployment & Reliability',
          description: 'Learn Helm charts, readiness/liveness probes, rolling updates, and cluster autoscaling.',
          durationWeeks: 3,
          skillsTargeted: ['Kubernetes Container Orchestration'],
          resources: [
            {
              title: 'Production Kubernetes Cluster Architecture Guide',
              type: 'doc',
              url: 'https://kubernetes.io/docs/concepts/architecture/',
              difficulty: 'Advanced'
            }
          ]
        }
      ]
    });

    logger.info(`✅ Seeded personalized learning roadmap for ${demoCandidate.name} (74% match, 3 priority gaps)`);

    // 7. Seed Admin Approval Queue with 3 Pending AI Questions
    logger.info('Seeding admin AI question approval queue...');
    const pendingQuestions = [
      {
        title: 'Distributed Saga Pattern & Compensating Transactions',
        prompt: 'Design a distributed transaction workflow for a financial trading microservice. Contrast Choreography vs Orchestration and explain rollbacks under partial network failures.',
        difficultyLevel: 'hard',
        track: 'backend',
        roundType: 'system_design',
        topic: 'Distributed Systems',
        status: 'pending',
        isDemo: true,
        idealAnswer: 'Implement an orchestrator state machine with idempotent event compensation logs and dead-letter queues.',
        testCases: []
      },
      {
        title: 'React Concurrent Rendering & Fiber Reconciliation',
        prompt: 'Explain how React Fiber schedules high-priority user interactions over background re-renders. What are the performance implications of useTransition vs useDeferredValue?',
        difficultyLevel: 'medium',
        track: 'frontend',
        roundType: 'technical',
        topic: 'React Architecture',
        status: 'pending',
        isDemo: true,
        idealAnswer: 'Fiber uses cooperative yielding via MessageChannel to maintain 60 FPS while deferring non-urgent subtrees.',
        testCases: []
      },
      {
        title: 'Zero-Downtime Database Migration & Expanding Blueprints',
        prompt: 'Explain the Expand-Contract pattern for safely migrating a high-throughput table with 100M+ rows without table locks or downtime.',
        difficultyLevel: 'hard',
        track: 'fullstack',
        roundType: 'system_design',
        topic: 'Databases & Infrastructure',
        status: 'pending',
        isDemo: true,
        idealAnswer: 'Add new column nullable, backfill asynchronously with batch triggers, transition writes to dual-mode, switch reads, and remove old column.',
        testCases: []
      }
    ];

    for (const pq of pendingQuestions) {
      await Question.create(pq);
    }

    logger.info('✅ Seeded 3 pending AI questions in admin approval queue');

    logger.info('🎉 AdaptIQ Demo Data Seed Completed Successfully!');
    return {
      success: true,
      sessionsCount: createdSessions.length,
      usersCount: 3 + createdCohortUsers.length,
      roadmapId: demoRoadmap._id
    };
  } catch (err) {
    logger.error(`❌ Demo seed error: ${err.message}`);
    throw err;
  }
}

// Allow direct CLI execution: node src/seed/demoData.js
if (process.argv[1] && process.argv[1].endsWith('demoData.js')) {
  seedDemoData()
    .then(() => {
      logger.info('Demo seed finished. Exiting.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Demo seed script failed:', err);
      process.exit(1);
    });
}
