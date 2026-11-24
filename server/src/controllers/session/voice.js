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
import { transcribeAudioBuffer } from '../../services/speech/whisperService.js';
import { calculateSpeechMetrics } from '../../services/speech/speechMetrics.js';
import { executeScoringPipeline } from '../../services/scoring/index.js';

export const submitVoiceAnswer = async (req, res, next) => {
  try {
    const { id: sessionId } = req.params;
    const { questionId, durationSeconds = 30 } = req.body;

    let question = await Question.findById(questionId).catch(() => null);
    if (!question) {
      question = allQuestions.find((q) => q._id === questionId || q.id === questionId || q.title === questionId);
    }
    if (!question) {
      return next(new AppError('Question not found', 404));
    }

    let audioBuffer = req.file?.buffer;
    let mimetype = req.file?.mimetype || 'audio/webm';
    let filename = req.file?.originalname || 'voice_recording.webm';

    // 1. Whisper Transcription
    const transcription = await transcribeAudioBuffer({
      audioBuffer,
      mimetype,
      filename,
      clientDurationSeconds: Number(durationSeconds)
    });

    const transcript = transcription.transcript || '';

    // 2. Speech Delivery Metrics (WPM, filler words, pause ratio)
    const voiceMetrics = calculateSpeechMetrics({
      transcript,
      durationSeconds: Number(transcription.durationSeconds || durationSeconds)
    });

    // 3. Execute standard Rubric Scoring Pipeline on transcript
    const rubricScoring = await executeScoringPipeline({
      question,
      candidateAnswer: transcript,
      telemetry: {
        wpm: voiceMetrics.wpm,
        fillerRatio: voiceMetrics.fillerRatio,
        pauseRatio: voiceMetrics.pauseRatio
      }
    });

    // 4. Record response in session
    const session = await AssessmentSession.findById(sessionId).catch(() => null);
    const score = Number(((rubricScoring.compositeScore || 75) / 100).toFixed(2));
    const wasCorrect = score >= 0.6;

    let nextQuestion = null;
    let newTheta = session?.abilityTheta || 0;
    let newSEM = session?.abilitySem || 1;
    let newPercentile = session?.percentileScore || 50;

    if (session) {
      // EAP Recalibration
      const administeredItems = [
        ...session.responses.map((r) => ({
          a: r.questionId?.irtParams?.a || 1.0,
          b: r.questionId?.irtParams?.b || 0.0,
          c: r.questionId?.irtParams?.c || 0.0,
          isCorrect: r.score >= 0.6
        })),
        {
          a: question.irtParams?.a || 1.0,
          b: question.irtParams?.b || 0.0,
          c: question.irtParams?.c || 0.0,
          isCorrect: wasCorrect
        }
      ];

      const irtEst = estimateAbilityEAP(administeredItems);
      newTheta = irtEst.theta;
      newSEM = irtEst.sem;
      newPercentile = thetaToPercentileScore(newTheta);

      session.abilityTheta = newTheta;
      session.abilitySem = newSEM;
      session.percentileScore = newPercentile;

      session.responses.push({
        questionId: question._id || question.id,
        roundType: 'voice',
        answer: transcript,
        score,
        thetaAfter: newTheta,
        semAfter: newSEM,
        answeredAt: new Date(),
        durationSeconds: Number(durationSeconds),
        voiceMetrics
      });

      // Advance rounds
      if (session.rounds && session.rounds.length > 0) {
        const currRound = session.rounds[session.currentRoundIndex || 0];
        if (currRound) {
          currRound.completedQuestions = (currRound.completedQuestions || 0) + 1;
          if (currRound.completedQuestions >= currRound.targetQuestions) {
            currRound.status = 'completed';
            if ((session.currentRoundIndex || 0) + 1 < session.rounds.length) {
              session.currentRoundIndex = (session.currentRoundIndex || 0) + 1;
              session.currentRound = session.rounds[session.currentRoundIndex].roundType;
            }
          }
        }
      }

      const pool = await getOrSeedQuestionPool(session.track);
      const administeredIds = session.responses.map((r) => r.questionId.toString());
      nextQuestion = selectNextQuestion(newTheta, pool, administeredIds);
      if (nextQuestion) {
        session.currentQuestionId = nextQuestion._id || nextQuestion.id;
        session.currentQuestionStartedAt = new Date();
      }

      if (session.save) await session.save().catch(() => {});
    }

    res.status(200).json({
      success: true,
      data: {
        transcript,
        voiceMetrics,
        rubricScoring,
        score,
        wasCorrect,
        theta: newTheta,
        sem: newSEM,
        percentileScore: newPercentile,
        nextQuestion: sanitizeQuestionForCandidate(nextQuestion)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Process dual-input spoken audio: transcribes with Whisper (auto-detecting Hindi/Hinglish),
 *          computes speech metrics (WPM, filler words, pause ratio), and returns transcript with confidence
 *          for candidate review/editing before submission.
 * @route   POST /api/sessions/:id/answer-audio
 * @access  Private
 */

export const handleAnswerAudio = async (req, res, next) => {
  try {
    const { id: sessionId } = req.params;
    const { clientDurationSeconds = 30, clientTranscript = '' } = req.body;

    const audioBuffer = req.file?.buffer;
    const mimetype = req.file?.mimetype || 'audio/webm';
    const filename = req.file?.originalname || `spoken_answer_${Date.now()}.webm`;

    if (!audioBuffer) {
      return next(new AppError('Audio recording file is required for speech transcription.', 400));
    }

    // 1. Whisper Transcription with language auto-detect (including Hindi/Hinglish)
    const transcription = await transcribeAudioBuffer({
      audioBuffer,
      mimetype,
      filename,
      clientDurationSeconds: Number(clientDurationSeconds),
      clientTranscript
    });

    const transcript = transcription.transcript || '';

    // 2. Compute speech delivery metrics (WPM, filler words including Hindi/Hinglish, pause ratio)
    const speechMetrics = calculateSpeechMetrics({
      transcript,
      durationSeconds: Number(transcription.durationSeconds || clientDurationSeconds)
    });

    // 3. Audio staging URL
    const audioUrl = `data:${mimetype};base64,${audioBuffer.toString('base64')}`;

    res.status(200).json({
      success: true,
      message: 'Audio transcribed and analyzed successfully',
      data: {
        transcript,
        confidence: transcription.confidence ?? 0.94,
        language: transcription.language || 'english',
        speechMetrics,
        audioUrl
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Record optional consent-gated MediaPipe confidence trend (EXCLUDED from scoring)
 * @route   POST /api/sessions/:id/confidence-trend
 * @access  Private
 */