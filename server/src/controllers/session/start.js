import mongoose from 'mongoose';
import { AssessmentSession, Question, Skill, ResponseEvaluation, User, AuditLog } from '../../models/index.js';
import { AppError } from '../../middleware/errorHandler.js';
import {
  estimateAbilityEAP,
  selectNextQuestion,
  shouldStopAdaptiveTest,
  thetaToPercentileScore,
  IRT_DEFAULTS
} from '../../ml/irt.js';
import { emitAbilityUpdate, emitSessionCompleted } from '../../services/socket.js';
import { allQuestions } from '../../seed/questions/allQuestions.js';
import {
  getTrackRounds,
  DEFAULT_ROUND_TIMERS,
  TIMER_GRACE_PERIOD_SECONDS,
  getTotalTrackQuestions
} from '../../config/tracks.js';
import { sanitizeQuestionForCandidate, getOrSeedQuestionPool } from './helpers.js';
import { parseResumeWithLLM } from '../../services/resume/resumeParser.js';
import { parseJobDescription } from '../../services/jd/jdAnalyzer.js';
import { calculateEvaluationConfidence } from '../../services/scoring/confidenceScorer.js';

export const startSession = async (req, res, next) => {
  try {
    const { track = 'fullstack', isProctored = false } = req.body;
    const candidateId = req.user?.id || req.user?._id;

    // Retrieve active questions (auto-seeds if database is empty)
    const questionPool = await getOrSeedQuestionPool(track);

    if (!questionPool || questionPool.length === 0) {
      return next(new AppError(`No active questions available for track: ${track}`, 404));
    }

    // Initialize multi-round sequence for track
    const rounds = getTrackRounds(track);
    const initialRoundType = rounds[0]?.roundType || 'mcq';

    // Prioritize initial question matching first round and favor basic, foundational topics
    const initialPool = questionPool.filter((q) => q.roundType === initialRoundType);
    const poolForSelection = initialPool.length > 0 ? initialPool : questionPool;

    // Favor easy/introductory questions for the very first question so candidate begins with approachable concepts
    const easyPool = poolForSelection.filter((q) => q.difficultyLevel === 'easy' || (q.irtParams?.b ?? q.b ?? 0) <= 0.0);
    const candidateSelectionPool = easyPool.length > 0 ? easyPool : poolForSelection;

    // Select initial question at initial ability theta=0.0
    const firstQuestion = selectNextQuestion(
      IRT_DEFAULTS.INITIAL_THETA,
      candidateSelectionPool,
      [],
      { enforceTopicBalance: true }
    );

    if (!firstQuestion) {
      return next(new AppError('Failed to select initial adaptive question', 500));
    }

    const defaultTimer =
      rounds[0]?.defaultTimerSeconds || DEFAULT_ROUND_TIMERS[firstQuestion.roundType] || 90;

    let session;
    try {
      session = await AssessmentSession.create({
        candidateId,
        track,
        status: 'in_progress',
        isProctored: Boolean(isProctored),
        rounds,
        currentRoundIndex: 0,
        currentRound: firstQuestion.roundType,
        currentQuestionIndex: 0,
        totalQuestions: getTotalTrackQuestions(track),
        currentQuestionId: firstQuestion._id,
        currentQuestionStartedAt: new Date(),
        currentQuestionAllowedSeconds: defaultTimer,
        pausedAt: null,
        totalPausedSeconds: 0,
        abilityTheta: IRT_DEFAULTS.INITIAL_THETA,
        abilitySem: IRT_DEFAULTS.INITIAL_SEM,
        percentileScore: 50.0,
        responses: [],
        integrityEvents: [],
        integrityScore: 100,
        startedAt: new Date()
      });
    } catch (dbErr) {
      // In-memory fallback session if DB is offline
      session = {
        _id: `session_${Date.now()}`,
        candidateId,
        track,
        status: 'in_progress',
        isProctored: Boolean(isProctored),
        rounds,
        currentRoundIndex: 0,
        currentRound: firstQuestion.roundType,
        currentQuestionIndex: 0,
        totalQuestions: getTotalTrackQuestions(track),
        currentQuestionId: firstQuestion._id || firstQuestion.id,
        currentQuestionStartedAt: new Date(),
        currentQuestionAllowedSeconds: defaultTimer,
        pausedAt: null,
        totalPausedSeconds: 0,
        abilityTheta: IRT_DEFAULTS.INITIAL_THETA,
        abilitySem: IRT_DEFAULTS.INITIAL_SEM,
        percentileScore: 50.0,
        responses: [],
        integrityEvents: [],
        integrityScore: 100,
        startedAt: new Date()
      };
    }

    res.status(201).json({
      success: true,
      data: {
        session: {
          id: session._id,
          track: session.track,
          status: session.status,
          isProctored: Boolean(session.isProctored),
          currentRound: session.currentRound,
          currentRoundIndex: session.currentRoundIndex || 0,
          rounds: session.rounds,
          totalQuestions: session.totalQuestions,
          currentQuestionIndex: 0,
          abilityTheta: session.abilityTheta,
          abilitySem: session.abilitySem,
          percentileScore: session.percentileScore,
          timer: {
            allowedSeconds: defaultTimer,
            remainingSeconds: defaultTimer
          }
        },
        currentQuestion: sanitizeQuestionForCandidate(firstQuestion)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit response to current question & dynamically adapt theta
 * @route   POST /api/sessions/:id/answer
 * @access  Private (Candidate)
 */

export const getSessionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let session = await AssessmentSession.findById(id)
      .populate('responses.questionId', 'title roundType difficultyLevel')
      .populate('currentQuestionId')
      .catch(() => null);

    if (!session) {
      session = {
        _id: id,
        track: 'fullstack',
        status: 'in_progress',
        abilityTheta: 0.0,
        abilitySem: 1.0,
        percentileScore: 50.0,
        responses: []
      };
    }

    let activeQuestion = session.currentQuestionId;

    // If targeted session or session with custom questions, resolve active question from customQuestions
    if (session.customQuestions && session.customQuestions.length > 0) {
      if (session.isTargeted || !activeQuestion || !activeQuestion.prompt) {
        const targetIdx = session.responses ? session.responses.length : 0;
        if (targetIdx < session.customQuestions.length) {
          activeQuestion = session.customQuestions[targetIdx];
        } else {
          activeQuestion = session.customQuestions[session.customQuestions.length - 1];
        }
      }
    }
    let timer = null;
    if (session.currentQuestionAllowedSeconds) {
      const now = Date.now();
      const startedAt = session.currentQuestionStartedAt
        ? new Date(session.currentQuestionStartedAt).getTime()
        : now;
      const totalPaused = (session.totalPausedSeconds || 0) * 1000;
      const pauseDuration = session.pausedAt
        ? now - new Date(session.pausedAt).getTime()
        : 0;
      const elapsedSeconds = Math.max(
        0,
        Math.round((now - startedAt - totalPaused - pauseDuration) / 1000)
      );
      const remainingSeconds = Math.max(0, session.currentQuestionAllowedSeconds - elapsedSeconds);
      timer = {
        allowedSeconds: session.currentQuestionAllowedSeconds,
        remainingSeconds
      };
    }

    // Fallback if currentQuestionId was not populated or is missing
    if (!activeQuestion && session.status !== 'completed' && session.track) {
      const pool = await getOrSeedQuestionPool(session.track);
      const administeredIds = (session.responses || []).map((r) =>
        r.questionId?.toString ? r.questionId.toString() : r.questionId
      );
      activeQuestion = selectNextQuestion(session.abilityTheta || 0, pool, administeredIds);
      if (activeQuestion && session.save) {
        session.currentQuestionId = activeQuestion._id || activeQuestion.id;
        session.currentQuestionStartedAt = new Date();
        session.currentQuestionAllowedSeconds =
          DEFAULT_ROUND_TIMERS[activeQuestion.roundType] || 90;
        await session.save().catch(() => {});
      }
    }

    res.status(200).json({
      success: true,
      data: {
        session,
        currentQuestion: sanitizeQuestionForCandidate(activeQuestion),
        timer
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get candidate's active or paused assessment session for resume flow
 * @route   GET /api/sessions/my/active
 * @access  Private
 */

export const getMyActiveSession = async (req, res, next) => {
  try {
    const candidateId = req.user?.id || req.user?._id;
    let session = null;

    if (candidateId && mongoose.connection.readyState === 1) {
      session = await AssessmentSession.findOne({
        candidateId,
        status: { $in: ['in_progress', 'paused'] }
      })
        .populate('currentQuestionId', 'title roundType difficultyLevel')
        .sort({ updatedAt: -1 });
    }

    res.status(200).json({
      success: true,
      data: {
        session: session
          ? {
              id: session._id,
              track: session.track,
              status: session.status,
              currentRound: session.currentRound,
              currentRoundIndex: session.currentRoundIndex || 0,
              rounds: session.rounds || [],
              questionsAnswered: session.responses?.length || 0,
              totalQuestions: session.totalQuestions || 8,
              abilityTheta: session.abilityTheta,
              percentileScore: session.percentileScore,
              isProctored: Boolean(session.isProctored),
              updatedAt: session.updatedAt
            }
          : null
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get candidate's past assessment sessions (history)
 * @route   GET /api/sessions/my/history
 * @access  Private
 */

export const getMySessionHistory = async (req, res, next) => {
  try {
    const candidateId = req.user?.id || req.user?._id;
    if (!candidateId) {
      return res.status(200).json({ success: true, data: { sessions: [] } });
    }

    let sessions = [];
    if (mongoose.connection.readyState === 1) {
      sessions = await AssessmentSession.find({ candidateId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('_id track status isProctored isTargeted targetRole targetCompany abilityTheta percentileScore startedAt completedAt createdAt responses');
    }

    const formattedSessions = sessions.map((s) => {
      const scoreOutOf100 = s.percentileScore != null
        ? Math.round(s.percentileScore)
        : Math.round(Math.max(10, Math.min(100, (((s.abilityTheta || 0) + 3) / 6) * 100)));

      return {
        id: s._id,
        track: s.track,
        status: s.status,
        isProctored: Boolean(s.isProctored),
        isTargeted: Boolean(s.isTargeted),
        targetRole: s.targetRole || (s.track ? s.track.charAt(0).toUpperCase() + s.track.slice(1) + ' Development' : 'General Assessment'),
        targetCompany: s.targetCompany || '',
        score: scoreOutOf100,
        questionsAnswered: s.responses ? s.responses.length : 0,
        createdAt: s.startedAt || s.createdAt || new Date(),
        completedAt: s.completedAt
      };
    });

    res.status(200).json({
      success: true,
      data: {
        sessions: formattedSessions
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Manually finalize/finish assessment session
 * @route   POST /api/sessions/:id/finish
 * @access  Private
 */

export const finishSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = await AssessmentSession.findById(id).catch(() => null);

    if (session) {
      session.status = 'completed';
      session.completedAt = new Date();
      await session.save().catch(() => {});
    }

    emitSessionCompleted(id, {
      sessionId: id,
      finalTheta: session?.abilityTheta || 0,
      finalSEM: session?.abilitySem || 1,
      finalPercentile: session?.percentileScore || 50
    });

    res.status(200).json({
      success: true,
      message: 'Assessment completed successfully',
      data: {
        session
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Log candidate window blur or tab switch integrity event
 * @route   POST /api/sessions/:id/integrity-event
 * @access  Private
 */

export const exitSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { integrityMetrics = {}, auditLog = [] } = req.body;

    let session = await AssessmentSession.findById(id).catch(() => null);
    if (!session) {
      return next(new AppError('Session not found', 404));
    }

    const responses = session.responses || [];

    // Calculate partial score based on answered questions
    const avgScore = responses.length > 0
      ? responses.reduce((sum, r) => sum + (r.score <= 1.0 ? r.score * 100 : r.score), 0) / responses.length
      : 50;
    const finalScore = Math.round(avgScore);

    session.status = 'completed';
    session.completedAt = new Date();

    // Append manual exit event to audit log
    const exitEvent = {
      eventType: 'MANUAL_EXIT',
      severity: 'WARNING',
      durationMs: 0,
      deduction: 0,
      timestamp: new Date(),
      metadata: { reason: 'Candidate confirmed manual exit from interview' }
    };

    const combinedAuditLog = [...(session.auditLog || []), ...(auditLog || []), exitEvent];
    session.auditLog = combinedAuditLog;

    session.integrityMetrics = {
      facePresencePct: integrityMetrics.facePresencePct ?? 95,
      focusRetentionPct: integrityMetrics.focusRetentionPct ?? 90,
      tabSwitchCount: integrityMetrics.tabSwitchCount ?? 0,
      cameraAvailable: integrityMetrics.cameraAvailable ?? true,
      micAvailable: integrityMetrics.micAvailable ?? true,
      trustScore: integrityMetrics.trustScore ?? session.integrityScore ?? 90,
      trustDeductions: integrityMetrics.trustDeductions || [],
      isEarlyExit: true
    };

    session.integrityScore = session.integrityMetrics.trustScore;

    await session.save();

    res.status(200).json({
      success: true,
      message: 'Interview session ended successfully. Partial scorecard and audit logs generated.',
      data: {
        sessionId: session._id,
        status: session.status,
        isEarlyExit: true,
        finalScore,
        questionsAnswered: responses.length,
        integrityMetrics: session.integrityMetrics,
        auditLog: session.auditLog
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Record granular proctoring audit event (tab switch, window blur, face loss)
 * @route   POST /api/sessions/:id/audit-event
 * @access  Private
 */

export const pauseSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    let session = await AssessmentSession.findById(id).catch(() => null);

    if (!session) {
      return next(new AppError('Session not found', 404));
    }
    if (session.status === 'completed') {
      return next(new AppError('Cannot pause a completed assessment session', 400));
    }

    const now = Date.now();
    session.status = 'paused';
    session.pausedAt = new Date(now);

    const startedAt = session.currentQuestionStartedAt
      ? new Date(session.currentQuestionStartedAt).getTime()
      : now;
    const priorPaused = (session.totalPausedSeconds || 0) * 1000;
    const elapsedSeconds = Math.max(0, Math.round((now - startedAt - priorPaused) / 1000));
    const allowed = session.currentQuestionAllowedSeconds || 90;
    const remainingSeconds = Math.max(0, allowed - elapsedSeconds);

    if (session.save) await session.save().catch(() => {});

    res.status(200).json({
      success: true,
      message: 'Assessment session paused successfully',
      data: {
        sessionId: session._id,
        status: session.status,
        remainingSeconds,
        pausedAt: session.pausedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resume a paused assessment session and re-synchronize question timer
 * @route   POST /api/sessions/:id/resume
 * @access  Private
 */

export const resumeSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    let session = await AssessmentSession.findById(id)
      .populate('currentQuestionId')
      .catch(() => null);

    if (!session) {
      return next(new AppError('Session not found', 404));
    }
    if (session.status === 'completed') {
      return next(new AppError('Assessment session is already completed', 400));
    }

    const now = Date.now();
    if (session.pausedAt) {
      const pauseDuration = Math.max(
        0,
        Math.round((now - new Date(session.pausedAt).getTime()) / 1000)
      );
      session.totalPausedSeconds = (session.totalPausedSeconds || 0) + pauseDuration;
      session.pausedAt = null;
    }
    session.status = 'in_progress';

    // Calculate server remaining seconds
    const startedAt = session.currentQuestionStartedAt
      ? new Date(session.currentQuestionStartedAt).getTime()
      : now;
    const totalPaused = (session.totalPausedSeconds || 0) * 1000;
    const elapsedSeconds = Math.max(0, Math.round((now - startedAt - totalPaused) / 1000));
    const allowed = session.currentQuestionAllowedSeconds || 90;
    const remainingSeconds = Math.max(5, allowed - elapsedSeconds);

    // Retrieve active question
    let activeQuestion = session.currentQuestionId;

    // If targeted session or session with custom questions, resolve active question from customQuestions
    if (session.customQuestions && session.customQuestions.length > 0) {
      if (session.isTargeted || !activeQuestion || !activeQuestion.prompt) {
        const targetIdx = session.responses ? session.responses.length : 0;
        if (targetIdx < session.customQuestions.length) {
          activeQuestion = session.customQuestions[targetIdx];
        } else {
          activeQuestion = session.customQuestions[session.customQuestions.length - 1];
        }
      }
    }
    if (!activeQuestion) {
      const pool = await getOrSeedQuestionPool(session.track);
      const administeredIds = session.responses.map((r) => r.questionId.toString());
      activeQuestion = selectNextQuestion(session.abilityTheta || 0, pool, administeredIds);
      if (activeQuestion) {
        session.currentQuestionId = activeQuestion._id || activeQuestion.id;
      }
    }

    if (session.save) await session.save().catch(() => {});

    res.status(200).json({
      success: true,
      message: 'Assessment session resumed',
      data: {
        session: {
          id: session._id,
          track: session.track,
          status: session.status,
          currentRound: session.currentRound,
          currentRoundIndex: session.currentRoundIndex || 0,
          rounds: session.rounds || [],
          totalQuestions: session.totalQuestions || 8,
          currentQuestionIndex: session.responses.length,
          abilityTheta: session.abilityTheta,
          abilitySem: session.abilitySem,
          percentileScore: session.percentileScore,
          timer: {
            allowedSeconds: allowed,
            remainingSeconds
          }
        },
        currentQuestion: sanitizeQuestionForCandidate(activeQuestion)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate a context-aware LLM follow-up question (max 2 per question)
 * @route   POST /api/sessions/:id/follow-up
 * @access  Private
 */

export const startTargetedSession = async (req, res, next) => {
  try {
    let { resumeText = '', jdText = '', targetRole = '', targetCompany = '', isProctored = true } = req.body;
    const candidateId = req.user?.id || req.user?._id;

    if (!resumeText.trim() && !jdText.trim()) {
      return next(new AppError('Please provide either your resume, a job description, or both to start your interview.', 400));
    }

    // Auto-decode if raw binary PDF was submitted
    if (resumeText.startsWith('%PDF-') || resumeText.startsWith('PK\x03\x04')) {
      try {
        const buf = Buffer.from(resumeText, 'binary');
        const extracted = await extractTextFromFileBuffer(buf, 'application/pdf');
        if (extracted && extracted.length > 20) {
          resumeText = extracted;
        }
      } catch (err) {
        console.warn('PDF buffer decode in startTargetedSession:', err.message);
      }
    }

    // Persist and replace user's saved resume in MongoDB
    if (candidateId && resumeText.trim()) {
      await User.findByIdAndUpdate(candidateId, {
        'profile.resumeText': resumeText.trim(),
        'profile.resumeUpdatedAt': new Date(),
        'profile.savedJDText': jdText.trim() || ''
      }).catch(() => {});
    }

    // 1. Analyze Resume
    let parsedResume = null;
    try {
      if (resumeText && resumeText.trim().length > 10) {
        parsedResume = await parseResumeWithLLM(resumeText);
      }
    } catch (e) {
      console.error('Targeted session resume parse error:', e);
    }

    const resumeLines = (resumeText || '').split('\n').map((l) => l.trim()).filter(Boolean);

    if (!parsedResume || !parsedResume.claimedSkills || parsedResume.claimedSkills.length === 0) {
      // Heuristic extraction from raw resume text
      const resumeLower = (resumeText || '').toLowerCase();
      const detectedSkills = [];
      if (resumeLower.includes('react')) detectedSkills.push({ name: 'React.js', level: 'Intermediate' });
      if (resumeLower.includes('node')) detectedSkills.push({ name: 'Node.js & Express', level: 'Intermediate' });
      if (resumeLower.includes('javascript') || resumeLower.includes('js')) detectedSkills.push({ name: 'JavaScript', level: 'Intermediate' });
      if (resumeLower.includes('python')) detectedSkills.push({ name: 'Python', level: 'Intermediate' });
      if (resumeLower.includes('java') && !resumeLower.includes('javascript')) detectedSkills.push({ name: 'Java', level: 'Intermediate' });
      if (resumeLower.includes('cpp') || resumeLower.includes('c++')) detectedSkills.push({ name: 'C++', level: 'Intermediate' });
      if (resumeLower.includes('mongo') || resumeLower.includes('sql')) detectedSkills.push({ name: 'Databases (SQL/NoSQL)', level: 'Intermediate' });
      if (resumeLower.includes('html') || resumeLower.includes('css')) detectedSkills.push({ name: 'HTML & CSS', level: 'Foundational' });

      parsedResume = {
        candidateName: req.user?.name || 'Candidate',
        claimedSkills: detectedSkills.length > 0 ? detectedSkills : [
          { name: 'Web Development Fundamentals', level: 'Intermediate' },
          { name: 'JavaScript & Programming', level: 'Intermediate' },
          { name: 'Data Structures & Algorithms', level: 'Intermediate' }
        ],
        workHistory: []
      };
    }

    // 2. Analyze Job Description
    let parsedJD = null;
    try {
      if (jdText && jdText.trim().length > 10) {
        parsedJD = await parseJobDescription(jdText);
      }
    } catch (e) {
      console.error('Targeted session JD parse error:', e);
    }

    if (!parsedJD) {
      parsedJD = {
        roleTitle: targetRole || 'Software Development Engineer (SDE)',
        company: targetCompany || 'Tech Company',
        track: 'fullstack',
        requiredSkills: [
          { name: 'Programming Fundamentals', slug: 'programming-fundamentals', minProficiency: 0.7 },
          { name: 'Web & API Basics', slug: 'web-api-basics', minProficiency: 0.7 },
          { name: 'Data Structures & Algorithms (DSA)', slug: 'algorithms-dsa', minProficiency: 0.7 }
        ]
      };
    }

    const finalRoleTitle = targetRole || parsedJD.roleTitle || 'Software Engineer';
    const finalCompany = targetCompany || parsedJD.company || 'Tech Company';

    // 3. Assemble Dynamic, Beginner-Friendly 5-Question Interview Sequence
    // Extract candidate's actual project dynamically from resume lines
    let topProject = parsedResume.workHistory?.[0]?.company;
    let projectHighlight = parsedResume.workHistory?.[0]?.highlights?.[0];

    // Scan resume lines for specific projects, avoiding generic titles
    for (let i = 0; i < resumeLines.length; i++) {
      const line = resumeLines[i];
      // Check for numbered project, bullet point project, or "Project:" / "Title:" headers
      const match = line.match(/^(?:(?:\d+[\.\)]\s*)|[-•*]\s*)?(?:Project:\s*|Title:\s*)?([A-Za-z0-9\s&–-]{3,45})(?:\s*[:–-]\s*(.*))?$/i);
      if (match) {
        const candidateProj = match[1].trim();
        const lower = candidateProj.toLowerCase();
        const isHeader = /summary|skill|education|experience|certif|contact|email|phone|objective|languages/i.test(lower);
        const isRole = /developer|engineer|intern|student|bachelor|master|university|college|school/i.test(lower);
        if (!isHeader && !isRole && candidateProj.length >= 4) {
          topProject = candidateProj;
          if (match[2]) projectHighlight = match[2].trim();
          break;
        }
      }
    }

    if (!topProject || ['Fullstack Web Project', 'Tech Solutions Inc.', 'Key Engineering Project', 'Technical Engineering Project'].includes(topProject)) {
      // Look for any line that looks like a project name
      const possibleName = resumeLines.find((l) => /^[A-Z][A-Za-z0-9\s-]{3,35}$/.test(l) && !/summary|skills|education|experience|projects/i.test(l));
      topProject = possibleName || 'Your Core Software Project';
    }

    // Dynamic Top Skill from parsed resume or resume text
    let topSkillName = parsedResume.claimedSkills?.[0]?.name;
    if (!topSkillName) {
      topSkillName = 'modern software development';
    }

    // Round 1: Project Overview & Background (Easy & Welcoming)
    const resumeQuestion = {
      _id: new mongoose.Types.ObjectId(),
      id: `q_targeted_resume_${Date.now()}`,
      title: `Project Overview: ${topProject}`,
      prompt: `Welcome to the interview! To get started, please give a brief overview of your project "${topProject}" built with ${topSkillName}.\n\nWhat was the main purpose of this project, what primary technologies did you use, and what feature was the most interesting for you to develop?`,
      roundType: 'behavioral',
      topic: 'Project Overview & Fundamentals',
      category: 'Resume & Past Projects',
      difficultyLevel: 'easy',
      keyConcepts: ['project overview', 'technologies', 'core features', 'problem solving', 'role'],
      targetReason: 'Directly tailored to the project and experience found on your resume'
    };

    // Round 2: Core Programming Fundamentals: Variables & Scope (Easy)
    const coreConceptQuestion = {
      _id: new mongoose.Types.ObjectId(),
      id: `q_targeted_core_${Date.now()}`,
      title: 'Core Programming Fundamentals: Variables & Scope',
      prompt: 'Let\'s cover basic programming fundamentals. Can you explain the difference between `let`, `const`, and `var` in modern programming? In your explanation, describe what block scope means and why developers prefer `const` and `let` in clean code.',
      roundType: 'technical',
      topic: 'Variables, Scope & Fundamentals',
      category: 'Core Computer Science',
      difficultyLevel: 'easy',
      keyConcepts: ['variables', 'let vs const', 'block scope', 'reassignment', 'functions'],
      targetReason: 'Foundational programming concept essential for any developer role'
    };

    // Round 3: Web Basics: HTTP Methods & Database Fundamentals (Easy)
    const backendSystemQuestion = {
      _id: new mongoose.Types.ObjectId(),
      id: `q_targeted_systems_${Date.now()}`,
      title: 'Web & Database Basics: HTTP Requests & Data Storage',
      prompt: 'Let\'s cover basic web and database fundamentals. What is the difference between an HTTP GET request and an HTTP POST request? Additionally, what is the main difference between a Relational (SQL) database and a NoSQL database in terms of how data is stored?',
      roundType: 'technical',
      topic: 'HTTP Methods & Database Basics',
      category: 'Web & Database Fundamentals',
      difficultyLevel: 'easy',
      keyConcepts: ['http methods', 'get vs post', 'sql vs nosql', 'relational', 'databases'],
      targetReason: 'Basic web and data storage concepts tested in initial screening rounds'
    };

    // Round 4: Beginner Coding (Two Sum Target Lookup - Easy)
    const dsaQuestion = {
      _id: new mongoose.Types.ObjectId(),
      id: `q_targeted_dsa_${Date.now()}`,
      title: 'Beginner Coding: Two Sum Target Lookup',
      prompt: 'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nExample:\nInput: nums = [2, 7, 11, 15], target = 9\nOutput: [0, 1] (because nums[0] + nums[1] == 9)\n\nWrite a clean working solution in your preferred language.',
      roundType: 'coding',
      topic: 'Arrays & Target Lookup',
      category: 'Data Structures & Algorithms (DSA)',
      difficultyLevel: 'easy',
      keyConcepts: ['arrays', 'two sum', 'indices', 'loops', 'hashmap'],
      testCases: [
        { input: '[2, 7, 11, 15], 9', expectedOutput: '[0, 1]', isHidden: false },
        { input: '[3, 2, 4], 6', expectedOutput: '[1, 2]', isHidden: false },
        { input: '[3, 3], 6', expectedOutput: '[0, 1]', isHidden: true }
      ],
      targetReason: 'Beginner-friendly algorithmic screening question on arrays'
    };

    // Round 5: Beginner Coding (Palindrome String Check - Easy)
    const dsaHardQuestion = {
      _id: new mongoose.Types.ObjectId(),
      id: `q_targeted_palindrome_${Date.now()}`,
      title: 'Beginner Coding: String Reversal & Palindrome Check',
      prompt: 'Write a function that checks whether a given string is a Palindrome (reads the same backwards as forwards, ignoring spaces and capitalization).\n\nExamples:\n- "racecar" -> true\n- "hello" -> false\n- "madam" -> true\n\nWrite a clean working function in your preferred language.',
      roundType: 'coding',
      topic: 'Strings & Palindrome Check',
      category: 'Data Structures & Algorithms (DSA)',
      difficultyLevel: 'easy',
      keyConcepts: ['strings', 'palindrome', 'reversal', 'two pointers', 'loops'],
      testCases: [
        { input: '"racecar"', expectedOutput: 'true', isHidden: false },
        { input: '"hello"', expectedOutput: 'false', isHidden: false },
        { input: '"madam"', expectedOutput: 'true', isHidden: true }
      ],
      targetReason: 'Foundational string manipulation and validation problem'
    };

    const customQuestions = [
      resumeQuestion,
      coreConceptQuestion,
      backendSystemQuestion,
      dsaQuestion,
      dsaHardQuestion
    ];

    const rounds = [
      { roundType: 'behavioral', label: 'Resume & Project Overview', targetQuestions: 1, completedQuestions: 0, defaultTimerSeconds: 180 },
      { roundType: 'technical', label: 'Core Programming Fundamentals', targetQuestions: 2, completedQuestions: 0, defaultTimerSeconds: 120 },
      { roundType: 'coding', label: 'Beginner Algorithmic Coding', targetQuestions: 2, completedQuestions: 0, defaultTimerSeconds: 300 }
    ];

    const initialQuestion = customQuestions[0];

    let session;
    try {
      session = await AssessmentSession.create({
        candidateId,
        track: parsedJD.track || 'fullstack',
        status: 'in_progress',
        isTargeted: true,
        isProctored: isProctored !== undefined ? Boolean(isProctored) : true,
        targetRole: finalRoleTitle,
        targetCompany: finalCompany,
        resumeHighlights: (parsedResume.claimedSkills || []).slice(0, 6).map((s) => s.name),
        jdRequirements: (parsedJD.requiredSkills || []).slice(0, 6).map((r) => r.name),
        customQuestions,
        rounds,
        currentRoundIndex: 0,
        currentRound: initialQuestion.roundType,
        currentQuestionIndex: 0,
        totalQuestions: customQuestions.length,
        currentQuestionId: initialQuestion._id,
        currentQuestionStartedAt: new Date(),
        currentQuestionAllowedSeconds: 180,
        abilityTheta: 0.0,
        abilitySem: 1.0,
        percentileScore: 50.0,
        responses: [],
        integrityEvents: [],
        integrityScore: 100,
        startedAt: new Date()
      });
    } catch (dbErr) {
      session = {
        _id: `targeted_${Date.now()}`,
        id: `targeted_${Date.now()}`,
        candidateId,
        track: parsedJD.track || 'fullstack',
        status: 'in_progress',
        isTargeted: true,
        isProctored: isProctored !== undefined ? Boolean(isProctored) : true,
        targetRole: finalRoleTitle,
        targetCompany: finalCompany,
        resumeHighlights: (parsedResume.claimedSkills || []).slice(0, 6).map((s) => s.name),
        jdRequirements: (parsedJD.requiredSkills || []).slice(0, 6).map((r) => r.name),
        customQuestions,
        rounds,
        currentRoundIndex: 0,
        currentRound: initialQuestion.roundType,
        currentQuestionIndex: 0,
        totalQuestions: customQuestions.length,
        currentQuestionId: initialQuestion._id || initialQuestion.id,
        currentQuestionStartedAt: new Date(),
        currentQuestionAllowedSeconds: 180,
        abilityTheta: 0.0,
        abilitySem: 1.0,
        percentileScore: 50.0,
        responses: [],
        integrityEvents: [],
        integrityScore: 100,
        startedAt: new Date(),
        save: async () => true
      };
    }

    res.status(201).json({
      success: true,
      message: 'Targeted real-job interview session successfully generated and started',
      data: {
        session,
        currentQuestion: initialQuestion,
        totalQuestions: customQuestions.length,
        targetRole: finalRoleTitle,
        targetCompany: finalCompany,
        curatedPlan: [
          'Round 1: Project Overview & Background',
          'Round 2: Core Programming Fundamentals (Variables & Scope)',
          'Round 3: Web & Database Basics (HTTP & SQL vs NoSQL)',
          'Round 4: Beginner Coding (Two Sum Target Lookup)',
          'Round 5: Beginner Coding (Palindrome String Check)'
        ]
      }
    });
  } catch (err) {
    next(err);
  }
};
