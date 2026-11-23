import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api, sessionAPI } from '../services/api';
import { AbilityMeter } from '../components/interview/AbilityMeter';
import { QuestionTimer } from '../components/interview/QuestionTimer';
import RoundProgressBar from '../components/interview/RoundProgressBar';
import FollowUpCard from '../components/interview/FollowUpCard';
import StarFeedbackCard from '../components/interview/StarFeedbackCard';
import ExplainableFeedbackModal from '../components/feedback/ExplainableFeedbackModal';
import MonacoCodeEditor from '../components/interview/MonacoCodeEditor';
import VoiceRecorder from '../components/interview/VoiceRecorder';
import ConfidenceMeter from '../components/interview/ConfidenceMeter';
import LiveProctoringMonitor from '../components/interview/LiveProctoringMonitor';
import DictationAnswerBox from '../components/interview/DictationAnswerBox';
import DualInputAnswerBox from '../components/interview/DualInputAnswerBox';
import SpokenExplanationBox from '../components/interview/SpokenExplanationBox';
import ComprehensiveFeedbackReport from '../components/interview/ComprehensiveFeedbackReport';
import { useProctor } from '../hooks/useProctor';
import { ProctorWarningBanner } from '../components/interview/ProctorWarningBanner';
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Award,
  ChevronRight,
  Shield,
  Zap,
  Sparkles,
  ArrowRight,
  Home,
  Pause,
  Play,
  RotateCcw,
  HelpCircle,
  Clock,
  Mic,
  Code2,
  MessageSquare,
  Target,
  CameraOff,
  LogOut,
  XCircle,
  ArrowLeft
} from 'lucide-react';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const InterviewScreen = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [codingLanguage, setCodingLanguage] = useState('javascript');
  const [useVoiceMode, setUseVoiceMode] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState('');
  const [lastFeedback, setLastFeedback] = useState(null);
  const [integrityWarnings, setIntegrityWarnings] = useState(0);

  // Pause / Resume & Server Timer State
  const [isPaused, setIsPaused] = useState(false);
  const [remainingTimerSeconds, setRemainingTimerSeconds] = useState(90);

  // Follow-Up Engine State
  const [activeFollowUp, setActiveFollowUp] = useState(null);
  const [followUpsCompleted, setFollowUpsCompleted] = useState([]);

  // Behavioral STAR state
  const [starFeedback, setStarFeedback] = useState(null);

  // Explainable AI Modal State
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [activeEvaluation, setActiveEvaluation] = useState(null);

  // Live IRT state
  const [abilityData, setAbilityData] = useState({
    theta: 0.0,
    sem: 1.0,
    percentile: 50.0,
    isLive: false
  });

  // Dual-Input telemetry state
  const [answerTelemetry, setAnswerTelemetry] = useState({
    inputMode: 'type',
    transcript: '',
    audioUrl: '',
    editedAfterTranscription: false,
    speechMetrics: null
  });
  const [spokenExplanation, setSpokenExplanation] = useState(null);

  // Comprehensive Points-Wise Feedback State
  const [comprehensiveFeedback, setComprehensiveFeedback] = useState(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);

  // Exit Interview Confirmation Modal State
  const [showExitModal, setShowExitModal] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const socketRef = useRef(null);
  const [activeSocket, setActiveSocket] = useState(null);
  const [missingFaceSeconds, setMissingFaceSeconds] = useState(0);
  const questionStartTimeRef = useRef(Date.now());
  const proctorVideoRef = useRef(null);

  // Reference biometric embedding from pre-interview system check
  const referenceEmbedding = React.useMemo(() => {
    try {
      const raw = sessionStorage.getItem('adaptiq_proctor_ref_emb');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }, []);

  const isProctoringActive = Boolean(session?.isProctored);

  // Web Worker continuous AI proctoring hook with browser, typing, audio & time-decayed scoring
  const {
    latestWarning,
    dismissWarning,
    violationCounts,
    integrityScore,
    trustScore,
    integrityStatus,
    sessionControlState,
    checkAnswerSpeed,
    checkAITextRisk,
    liveFaceInFrame,
    liveGaze,
    liveEyeFocus,
    tabSwitchCount,
    focusStatus,
    facePresenceStatus,
    cameraAvailable,
    micAvailable,
    facePresencePct,
    focusRetentionPct,
    trustDeductions,
    auditLog,
    isFaceMissingLong
  } = useProctor({
    videoRef: proctorVideoRef,
    sessionId,
    referenceEmbedding,
    isEnabled: isProctoringActive && !isPaused && session?.status !== 'completed',
    isWriteMode: currentQuestion?.roundType === 'coding' || (!useVoiceMode && currentQuestion?.roundType !== 'voice'),
    socket: activeSocket
  });

  // Track continuous face absence / covered camera to enforce proctoring integrity lock
  useEffect(() => {
    if (!isProctoringActive) {
      setMissingFaceSeconds(0);
      return;
    }
    let interval = null;
    const isMissing = !liveFaceInFrame || liveGaze === 'no_face' || !cameraActive || facePresenceStatus === 'face_missing';

    if (isMissing && !isPaused && session?.status !== 'completed') {
      interval = setInterval(() => {
        setMissingFaceSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setMissingFaceSeconds(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProctoringActive, liveFaceInFrame, liveGaze, cameraActive, facePresenceStatus, isPaused, session?.status]);

  // Automatically update pause state if recruiter/onRed policy triggers pause
  useEffect(() => {
    if (sessionControlState?.status === 'paused' && !isPaused) {
      setIsPaused(true);
    } else if (sessionControlState?.status === 'in_progress' && isPaused) {
      setIsPaused(false);
    }
  }, [sessionControlState?.status, isPaused]);

  // Automatically activate voice mode if question requires voice
  useEffect(() => {
    if (currentQuestion) {
      if (currentQuestion.roundType === 'voice') {
        setUseVoiceMode(true);
      } else {
        setUseVoiceMode(false);
      }
    }
  }, [currentQuestion]);

  // Fetch points-wise feedback ONLY when assessment is officially completed
  useEffect(() => {
    if (session?.status === 'completed') {
      const fetchComprehensiveFeedback = async () => {
        setLoadingFeedback(true);
        try {
          const res = await api.get(`/sessions/${sessionId}/comprehensive-feedback`);
          if (res.data?.data) {
            setComprehensiveFeedback(res.data.data);
          }
        } catch (err) {
          console.warn('Could not load comprehensive feedback report:', err.message);
        } finally {
          setLoadingFeedback(false);
        }
      };
      fetchComprehensiveFeedback();
    }
  }, [session?.status, sessionId]);

  // Fetch assessment session details
  const fetchSession = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/sessions/${sessionId}`);
      const sessionData = res.data.data.session;
      setSession(sessionData);

      const initialTimer = res.data.data.timer?.remainingSeconds ?? sessionData.timer?.remainingSeconds ?? 90;
      setRemainingTimerSeconds(initialTimer);

      if (sessionData.status === 'paused') {
        setIsPaused(true);
      }

      setAbilityData({
        theta: sessionData.abilityTheta,
        sem: sessionData.abilitySem,
        percentile: sessionData.percentileScore,
        isLive: true
      });

      if (res.data.data.currentQuestion) {
        setCurrentQuestion(res.data.data.currentQuestion);
        questionStartTimeRef.current = Date.now();
      } else if (sessionData.isTargeted && sessionData.customQuestions && sessionData.customQuestions.length > 0) {
        const targetIndex = sessionData.responses?.length || 0;
        const targetQ = sessionData.customQuestions[targetIndex] || sessionData.customQuestions[0];
        setCurrentQuestion(targetQ);
        questionStartTimeRef.current = Date.now();
      } else if (sessionData.status !== 'completed') {
        const qRes = await api.post('/sessions/start', { track: sessionData.track });
        setCurrentQuestion(qRes.data.data.currentQuestion);
        if (qRes.data.data.session?.timer) {
          setRemainingTimerSeconds(qRes.data.data.session.timer.remainingSeconds);
        }
        questionStartTimeRef.current = Date.now();
      }
    } catch (err) {
      console.error('Fetch session error:', err);
      setError(err.response?.data?.message || 'Failed to load assessment session. Please retry.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Initial load
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Socket.io connection & integrity listeners
  useEffect(() => {
    let socket;

    // Socket.io connection
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_session', sessionId);
      setActiveSocket(socket);
      setAbilityData((prev) => ({ ...prev, isLive: true }));
    });

    socket.on('session:ability_updated', (data) => {
      setAbilityData({
        theta: data.theta,
        sem: data.sem,
        percentile: data.percentileScore,
        isLive: true
      });
    });

    socket.on('session:completed', (data) => {
      setSession((prev) => ({
        ...prev,
        status: 'completed',
        abilityTheta: data.finalTheta,
        abilitySem: data.finalSEM,
        percentileScore: data.finalPercentile
      }));
    });

    // Anti-Cheating Event Listeners
    const handleBlur = () => {
      if (isPaused) return;
      setIntegrityWarnings((prev) => prev + 1);
      socket.emit('client_integrity_event', {
        sessionId,
        eventType: 'tab_switch',
        timestamp: new Date().toISOString()
      });
      api.post(`/sessions/${sessionId}/integrity-event`, { eventType: 'tab_switch' }).catch(() => {});
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !isPaused) {
        socket.emit('client_integrity_event', {
          sessionId,
          eventType: 'fullscreen_exit',
          timestamp: new Date().toISOString()
        });
      }
    };

    const handlePaste = (e) => {
      if (isPaused) return;
      const pasted = e.clipboardData ? e.clipboardData.getData('text') : '';
      if (pasted.length > 50) {
        socket.emit('client_integrity_event', {
          sessionId,
          eventType: 'paste',
          metadata: { charCount: pasted.length },
          timestamp: new Date().toISOString()
        });
      }
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('paste', handlePaste);
      socket.disconnect();
    };
  }, [sessionId]);

  // Pause session
  const handlePauseSession = async () => {
    try {
      const res = await api.post(`/sessions/${sessionId}/pause`);
      setIsPaused(true);
      if (res.data.data?.remainingSeconds !== undefined) {
        setRemainingTimerSeconds(res.data.data.remainingSeconds);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to pause assessment');
    }
  };

  // Resume session
  const handleResumeSession = async () => {
    try {
      const res = await api.post(`/sessions/${sessionId}/resume`);
      const { session: resumedSession, currentQuestion: resumedQ } = res.data.data;
      setSession(resumedSession);
      if (resumedQ) setCurrentQuestion(resumedQ);
      setRemainingTimerSeconds(resumedSession.timer?.remainingSeconds || 90);
      setIsPaused(false);
      questionStartTimeRef.current = Date.now();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to resume assessment');
    }
  };

  // Finish & Conclude Assessment Early
  const handleFinishAssessment = async () => {
    if (window.confirm('Are you ready to conclude your assessment and calculate your final certified score and explainable feedback?')) {
      setSubmitting(true);
      try {
        const res = await api.post(`/sessions/${sessionId}/finish`);
        const updated = res.data?.data?.session;
        setSession((prev) => ({
          ...prev,
          status: 'completed',
          abilityTheta: updated?.abilityTheta ?? abilityData.theta,
          percentileScore: updated?.percentileScore ?? abilityData.percentile
        }));
        setCurrentQuestion(null);
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to conclude assessment');
      } finally {
        setSubmitting(false);
      }
    }
  };

  // Graceful Exit Interview handler: Saves responses, generates partial scorecard, records audit log
  const handleConfirmExitInterview = async () => {
    setIsExiting(true);
    try {
      const payload = {
        currentAnswer: answer ? {
          questionId: currentQuestion?._id || currentQuestion?.id,
          answer: answer,
          roundType: currentQuestion?.roundType
        } : null,
        integrityMetrics: {
          facePresencePct,
          focusRetentionPct,
          tabSwitchCount,
          cameraAvailable,
          micAvailable,
          trustScore: trustScore !== undefined ? trustScore : integrityScore,
          trustDeductions
        },
        auditLog
      };

      const res = await sessionAPI.exitSession(sessionId, payload);
      setShowExitModal(false);

      if (res.data?.data?.session) {
        setSession(res.data.data.session);
      } else {
        setSession((prev) => ({ ...prev, status: 'completed' }));
      }
      setCurrentQuestion(null);
    } catch (err) {
      console.error('Failed to exit session gracefully:', err);
      setSession((prev) => ({ ...prev, status: 'completed' }));
      setCurrentQuestion(null);
      setShowExitModal(false);
    } finally {
      setIsExiting(false);
    }
  };

  // Trigger LLM Follow-Up question
  const handleTriggerFollowUp = async () => {
    if (!answer.trim()) {
      alert('Please provide your initial answer before requesting an AI follow-up probe.');
      return;
    }

    setEvaluating(true);
    try {
      const res = await api.post(`/sessions/${sessionId}/follow-up`, {
        questionId: currentQuestion._id || currentQuestion.id,
        candidateAnswer: answer
      });

      if (res.data.data?.shouldFollowUp) {
        setActiveFollowUp(res.data.data);
      } else {
        alert(res.data.data?.reason || 'No additional follow-ups required.');
      }
    } catch (err) {
      console.error('Follow-up generation error:', err);
    } finally {
      setEvaluating(false);
    }
  };

  // Submit Answer to Follow-Up
  const handleSubmitFollowUp = async (followUpAnswer) => {
    setSubmitting(true);
    try {
      await api.post(`/sessions/${sessionId}/answer-follow-up`, {
        questionId: currentQuestion._id || currentQuestion.id,
        followUpIndex: (activeFollowUp?.followUpIndex || 1) - 1,
        answer: followUpAnswer
      });

      setFollowUpsCompleted((prev) => [
        ...prev,
        { ...activeFollowUp, candidateAnswer: followUpAnswer }
      ]);
      setActiveFollowUp(null);
    } catch (err) {
      alert('Failed to save follow-up answer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipFollowUp = () => {
    setActiveFollowUp(null);
  };

  // Submit Answer to Main Question
  const handleSubmitAnswer = async (overrideAnswer, overrideLang) => {
    const finalAnswer = overrideAnswer !== undefined ? overrideAnswer : answer;
    const finalLang = overrideLang || codingLanguage || 'javascript';

    if (!finalAnswer.trim() && currentQuestion?.roundType !== 'mcq') {
      alert('Please provide an answer before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');

    const durationSeconds = Math.round((Date.now() - questionStartTimeRef.current) / 1000);

    // Typing-pattern anomaly detection: check answer arrival velocity
    checkAnswerSpeed({ text: finalAnswer, durationSeconds });

    // AI-generated text risk indicator check (burstiness heuristic + LLM adapter)
    checkAITextRisk(finalAnswer, currentQuestion?.prompt || currentQuestion?.title);

    try {
      const res = await api.post(`/sessions/${sessionId}/answer`, {
        questionId: currentQuestion._id || currentQuestion.id,
        answer: finalAnswer,
        language: finalLang,
        durationSeconds,
        inputMode: answerTelemetry?.inputMode || 'type',
        transcript: answerTelemetry?.transcript || '',
        audioUrl: answerTelemetry?.audioUrl || '',
        editedAfterTranscription: Boolean(answerTelemetry?.editedAfterTranscription),
        speechMetrics: answerTelemetry?.speechMetrics || null,
        spokenExplanation: spokenExplanation || null
      });

      const { data } = res.data;

      setLastFeedback({
        wasCorrect: data.feedback?.wasCorrect,
        score: data.feedback?.score,
        newTheta: data.theta
      });

      if (data.feedback?.starEvaluation) {
        setStarFeedback(data.feedback.starEvaluation);
      } else {
        setStarFeedback(null);
      }

      if (data.rounds) {
        setSession((prev) => ({
          ...prev,
          rounds: data.rounds,
          currentRound: data.currentRound,
          currentRoundIndex: data.currentRoundIndex
        }));
      }

      if (data.isCompleted) {
        setSession((prev) => ({ ...prev, status: 'completed' }));
        setCurrentQuestion(null);
      } else {
        setCurrentQuestion(data.nextQuestion);
        setAnswer('');
        setActiveFollowUp(null);
        setFollowUpsCompleted([]);
        setRemainingTimerSeconds(data.timer?.remainingSeconds || 90);
        questionStartTimeRef.current = Date.now();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Voice Mode Answer Submission
  const handleVoiceSubmitted = (data) => {
    setLastFeedback({
      wasCorrect: data.feedback?.wasCorrect,
      score: data.feedback?.score,
      newTheta: data.theta
    });

    if (data.rounds) {
      setSession((prev) => ({
        ...prev,
        rounds: data.rounds,
        currentRound: data.currentRound,
        currentRoundIndex: data.currentRoundIndex
      }));
    }

    if (data.isCompleted) {
      setSession((prev) => ({ ...prev, status: 'completed' }));
      setCurrentQuestion(null);
    } else {
      setCurrentQuestion(data.nextQuestion);
      setAnswer('');
      setActiveFollowUp(null);
      setFollowUpsCompleted([]);
      setRemainingTimerSeconds(data.timer?.remainingSeconds || 90);
      questionStartTimeRef.current = Date.now();
    }
  };

  const handleAnalyzeWithAI = async () => {
    if (!answer.trim()) {
      alert('Please provide your response before analyzing.');
      return;
    }

    setEvaluating(true);
    setError('');

    const durationSeconds = Math.round((Date.now() - questionStartTimeRef.current) / 1000);

    // Typing-pattern anomaly detection: check answer arrival velocity
    checkAnswerSpeed({ text: finalAnswer, durationSeconds });

    // AI-generated text risk indicator check (burstiness heuristic + LLM adapter)
    checkAITextRisk(finalAnswer, currentQuestion?.prompt || currentQuestion?.title);

    try {
      const res = await api.post(`/sessions/${sessionId}/evaluate-response`, {
        questionId: currentQuestion._id || currentQuestion.id,
        answer,
        telemetry: { durationSeconds, tabSwitches: integrityWarnings }
      });

      const evalData = res.data.data.evaluation || res.data.data.pipeline;
      setActiveEvaluation(evalData);
      setFeedbackModalOpen(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to analyze response with AI');
    } finally {
      setEvaluating(false);
    }
  };

  const handleViewCompletionFeedback = async () => {
    setEvaluating(true);
    try {
      const res = await api.get(`/sessions/${sessionId}/evaluations`);
      const evals = res.data.data.evaluations;
      if (evals && evals.length > 0) {
        setActiveEvaluation(evals[0]);
        setFeedbackModalOpen(true);
      } else {
        const feedbackRes = await api.get(`/sessions/${sessionId}/feedback/default`);
        setActiveEvaluation(feedbackRes.data.data.evaluation);
        setFeedbackModalOpen(true);
      }
    } catch (err) {
      alert('Failed to load feedback report');
    } finally {
      setEvaluating(false);
    }
  };

  const handleTimeUp = () => {
    if (!isPaused && !submitting) {
      handleSubmitAnswer();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B192C] flex flex-col items-center justify-center text-slate-300">
        <div className="w-10 h-10 border-4 border-[#52D68A] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium tracking-wide">Setting up your interview questions...</p>
      </div>
    );
  }

  // Error Screen if loading failed and no question is present
  if (error && !currentQuestion) {
    return (
      <div className="min-h-screen bg-[#0B192C] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0F2238] border border-rose-500/40 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Could Not Load Interview</h2>
            <p className="text-xs text-rose-300 leading-relaxed">{error}</p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => {
                setError('');
                fetchSession();
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] text-xs font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Retry Loading
            </button>
            <button
              onClick={() => navigate('/candidate/dashboard')}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#0B192C] hover:bg-[#132A46] text-slate-200 text-xs font-semibold rounded-xl border border-[#1B3A60] transition flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" /> Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If session is active but current question is still being prepared
  if (!currentQuestion && session?.status !== 'completed') {
    return (
      <div className="min-h-screen bg-[#0B192C] flex flex-col items-center justify-center text-slate-300 p-4 text-center">
        <div className="w-10 h-10 border-4 border-[#52D68A] border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-bold text-white">Preparing Your Tailored Questions...</h2>
        <p className="text-xs text-slate-400 max-w-sm mt-1">
          Configuring your adaptive DSA concepts and resume deep-dive modules.
        </p>
        <button
          onClick={fetchSession}
          className="mt-4 px-4 py-2 bg-[#1B3A60] hover:bg-[#224775] text-white text-xs font-bold rounded-xl transition flex items-center gap-2"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Refresh Questions
        </button>
      </div>
    );
  }

  // Session Completed Screen (Points-Wise Feedback & Topics to Focus On)
  if (session?.status === 'completed') {
    if (loadingFeedback) {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-slate-300 bg-[#0B192C] px-4 text-center">
          <div className="w-12 h-12 border-4 border-[#52D68A] border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-xl font-bold text-white tracking-tight">
            Analyzing Your Monitored Interview...
          </h2>
          <p className="text-xs text-slate-300 max-w-md mt-1.5 leading-relaxed">
            Generating your plain-English strengths, improvement areas, and priority topics to focus on.
          </p>
        </div>
      );
    }

    if (comprehensiveFeedback) {
      return (
        <ComprehensiveFeedbackReport
          feedbackData={comprehensiveFeedback}
          sessionId={sessionId}
          onRetake={() => navigate('/candidate/dashboard')}
        />
      );
    }

    const scoreOutOf100 = Math.round(Math.max(10, Math.min(100, ((abilityData.theta + 3) / 6) * 100)));
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center space-y-6 bg-[#0B192C] text-white">
        <div className="inline-flex p-4 rounded-3xl bg-[#52D68A]/15 border border-[#52D68A]/30 text-[#52D68A] mb-2">
          <Award className="w-12 h-12" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Great Job! Interview Completed 🎉
        </h1>
        <p className="text-slate-300 text-xs sm:text-sm max-w-xl mx-auto">
          You finished the assessment rounds. Here is your verified skill rating and personalized feedback.
        </p>

        {/* Final Ability Score Card */}
        <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-6 shadow-2xl max-w-lg mx-auto space-y-4">
          <div className="text-xs uppercase font-semibold text-slate-300 tracking-wider">
            Your Final Score
          </div>
          <div className="text-5xl font-mono font-bold text-[#52D68A]">
            {scoreOutOf100} <span className="text-lg text-slate-400 font-sans font-normal">/ 100</span>
          </div>
          <div className="text-sm text-slate-200">
            Class Standing: <span className="font-bold text-amber-300">Top {Math.max(1, Math.round(100 - abilityData.percentile))}%</span>
          </div>

          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <button
              onClick={handleViewCompletionFeedback}
              disabled={evaluating}
              className="px-5 py-2.5 bg-[#0B192C] hover:bg-[#132A46] text-white text-xs font-semibold rounded-xl border border-[#1B3A60] shadow-md flex items-center gap-2 transition-all"
            >
              {evaluating ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" /> View Answer Feedback & Tips
                </>
              )}
            </button>

            <button
              onClick={() => navigate('/skills/gap-analysis')}
              className="px-5 py-2.5 bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] text-xs font-bold rounded-xl shadow-lg shadow-[#52D68A]/20 flex items-center gap-2 transition-all"
            >
              <Zap className="w-4 h-4 text-[#0B192C]" /> View My Skill Gaps & Study Plan
            </button>

            <button
              onClick={() => navigate('/candidate/dashboard')}
              className="px-5 py-2.5 bg-[#0B192C] hover:bg-[#132A46] text-slate-200 text-xs font-semibold rounded-xl border border-[#1B3A60] flex items-center gap-2 transition-all"
            >
              <Home className="w-4 h-4" /> Return to Dashboard
            </button>
          </div>
        </div>

        <ExplainableFeedbackModal
          isOpen={feedbackModalOpen}
          onClose={() => setFeedbackModalOpen(false)}
          evaluation={activeEvaluation}
          question={{ title: 'Assessment Responses Feedback' }}
        />
      </div>
    );
  }

  // Session Terminated by Proctor Overlay / Screen
  if (sessionControlState?.status === 'terminated' || session?.status === 'terminated') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-[#0F2238] border-2 border-rose-500/50 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <AlertOctagon className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Interview Session Terminated</h2>
            <p className="text-sm text-rose-300">
              {sessionControlState?.reason || 'This interview has been terminated by the proctoring authority due to an integrity policy infraction.'}
            </p>
          </div>
          <p className="text-xs text-slate-400">
            All audit logs, biometric embeddings, and alert evidence have been recorded in accordance with proctoring compliance.
          </p>
          <button
            onClick={() => navigate('/candidate/dashboard')}
            className="px-6 py-2.5 bg-[#0B192C] hover:bg-[#132A46] text-slate-200 text-xs font-semibold rounded-xl border border-[#1B3A60] inline-flex items-center gap-2 transition"
          >
            <Home className="w-4 h-4" /> Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Persistent Top Header Bar with Exit Interview Button */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1B3A60] bg-[#0B192C]/90 backdrop-blur sticky top-0 z-30 pt-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#52D68A]" />
            <span className="text-sm font-bold text-white tracking-tight">
              {session?.targetRole || 'Adaptive AI Technical Interview'}
            </span>
          </div>
          {isProctoringActive && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-[#52D68A]/10 text-[#52D68A] border border-[#52D68A]/20">
              ● Continuous Proctoring
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowExitModal(true)}
            className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            id="exit-interview-header-btn"
            title="Exit interview session"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>Exit Interview</span>
          </button>
        </div>
      </div>

      {/* Recruiter Immediate Advisory Warning Banner */}
      {sessionControlState?.activeWarning && (
        <div className="p-4 bg-rose-500/15 border-2 border-rose-500/60 rounded-2xl text-rose-200 text-sm flex items-start justify-between gap-3 shadow-xl animate-bounce">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white">PROCTOR DIRECT ADVISORY</div>
              <p className="text-xs text-rose-200 mt-0.5">{sessionControlState.activeWarning}</p>
            </div>
          </div>
          <button
            onClick={dismissWarning}
            className="text-xs bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 px-2.5 py-1 rounded-lg border border-rose-500/30 transition"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Real-Time Candidate-Side Proctoring Warning Banner */}
      {isProctoringActive && (
        <ProctorWarningBanner
          warning={latestWarning}
          onDismiss={dismissWarning}
          counts={violationCounts}
          integrityScore={integrityScore}
          integrityStatus={integrityStatus}
        />
      )}

      {/* Integrity Warning Banner */}
      {isProctoringActive && integrityWarnings > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>Window blur detected ({integrityWarnings} switch). Proctoring integrity log active.</span>
          </div>
          <span className="font-mono text-[11px] text-amber-300">Monitored</span>
        </div>
      )}

      {/* Targeted Interview Banner (If Personalized by Resume + JD) */}
      {(session?.isTargeted || session?.targetRole) && (
        <div className="bg-[#0F2238] border border-[#52D68A]/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#52D68A]/15 text-[#52D68A] flex items-center justify-center flex-shrink-0 border border-[#52D68A]/30 font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#52D68A] bg-[#52D68A]/10 px-2 py-0.5 rounded-full border border-[#52D68A]/20">
                  Targeted Mock Interview
                </span>
                <span className="text-xs text-slate-400">Personalized to your Resume & Job Description</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
                {session?.targetRole || 'Software Development Engineer'} {session?.targetCompany ? `• ${session?.targetCompany}` : ''}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-300">
            <span className="px-2.5 py-1 rounded-lg bg-[#0B192C] border border-[#1B3A60] font-medium text-amber-300">
              Resume Projects
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#0B192C] border border-[#1B3A60] font-medium text-[#52D68A]">
              Core CS
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#0B192C] border border-[#1B3A60] font-medium text-sky-400">
              DSA Screening
            </span>
          </div>
        </div>
      )}

      {/* Multi-Round Stepper & Progress Bar */}
      <RoundProgressBar
        rounds={session?.rounds || []}
        currentRoundIndex={session?.currentRoundIndex || 0}
        currentRoundType={session?.currentRound || currentQuestion.roundType}
      />

      {/* Top HUD: Proctoring Camera Feed & Ability Meter & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Continuous Live Proctoring Camera Feed OR Practice Sandbox Card */}
        <div className="lg:col-span-4 order-2 lg:order-1">
          {isProctoringActive ? (
            <LiveProctoringMonitor
              sessionId={sessionId}
              videoRef={proctorVideoRef}
              integrityWarnings={integrityWarnings}
              integrityScore={integrityScore}
              trustScore={trustScore}
              integrityStatus={integrityStatus}
              onCameraStatusChange={setCameraActive}
              faceInFrame={liveFaceInFrame}
              gazeStatus={liveGaze}
              eyeFocusRatio={liveEyeFocus}
              focusStatus={focusStatus}
              facePresenceStatus={facePresenceStatus}
              tabSwitchCount={tabSwitchCount}
              facePresencePct={facePresencePct}
              focusRetentionPct={focusRetentionPct}
              cameraAvailable={cameraAvailable}
              micAvailable={micAvailable}
              trustDeductions={trustDeductions}
            />
          ) : (
            <div className="bg-[#0F2238] border border-[#1B3A60] rounded-2xl p-4 text-center space-y-2.5 shadow-lg">
              <div className="inline-flex p-2.5 rounded-xl bg-[#52D68A]/10 text-[#52D68A] border border-[#52D68A]/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-white uppercase tracking-wider">Practice Sandbox Mode</div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Camera and proctoring checks are disabled. Take your time, practice speaking or typing comfortably!
              </p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#52D68A]/15 text-[#52D68A] text-[11px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Proctoring Off
              </div>
            </div>
          )}
        </div>

        {/* Ability Meter & Session Controls */}
        <div className="lg:col-span-8 order-1 lg:order-2 space-y-4">
          <AbilityMeter
            theta={abilityData.theta}
            sem={abilityData.sem}
            percentile={abilityData.percentile}
            isLive={abilityData.isLive}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Server-Validated Question Timer */}
            <QuestionTimer
              totalSeconds={remainingTimerSeconds}
              onTimeUp={handleTimeUp}
              isRunning={!submitting && !isPaused}
            />

            {/* Pause / Resume / Exit Control Box */}
            <div className="bg-[#0F2238] border border-[#1B3A60] rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>Continuous Monitoring</span>
                <span className={`font-semibold ${isProctoringActive ? 'text-[#52D68A]' : 'text-slate-400'}`}>
                  {isProctoringActive ? 'Camera Feed Active' : 'Disabled (Practice)'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Round Format</span>
                <span className="font-semibold text-amber-300 uppercase">{currentQuestion.roundType}</span>
              </div>

              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={handlePauseSession}
                  disabled={isPaused || submitting}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-[#0B192C] hover:bg-[#132A46] border border-[#1B3A60] text-slate-200 text-xs font-medium flex items-center justify-center gap-1 transition"
                >
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                  Pause
                </button>
                <button
                  type="button"
                  onClick={handleFinishAssessment}
                  disabled={submitting}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-[#52D68A]/15 hover:bg-[#52D68A]/25 border border-[#52D68A]/40 text-[#52D68A] text-xs font-semibold flex items-center justify-center gap-1 transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#52D68A]" />
                  Conclude
                </button>
                <button
                  type="button"
                  onClick={() => setShowExitModal(true)}
                  disabled={submitting}
                  className="py-1.5 px-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-center gap-1 transition"
                  title="Exit interview early"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  Exit
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Question Card */}
      <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#52D68A]/10 text-[#52D68A] border border-[#52D68A]/20">
                <Zap className="w-3.5 h-3.5" /> Question #{session?.responses?.length ? session.responses.length + 1 : (session?.currentQuestionIndex || 0) + 1} of ~8
              </div>
              <span className="text-[11px] text-slate-400">
                Round {(session?.currentRoundIndex || 0) + 1} of {session?.rounds?.length || 6}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {currentQuestion.roundType !== 'mcq' && currentQuestion.roundType !== 'coding' && (
                <button
                  type="button"
                  onClick={() => setUseVoiceMode(!useVoiceMode)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/20 flex items-center gap-1.5 transition"
                >
                  <Mic className="w-3 h-3 text-indigo-400" />
                  {useVoiceMode ? 'Switch to Text Input' : 'Enable Voice Mode'}
                </button>
              )}

              <span className="text-xs text-slate-400 capitalize font-medium">
                Difficulty: <strong className="text-indigo-300">{currentQuestion.difficultyLevel}</strong>
              </span>
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{currentQuestion.title}</h2>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{currentQuestion.prompt}</p>

          {/* Targeted Reason Badge */}
          {currentQuestion?.targetReason && (
            <div className="p-3 rounded-xl bg-[#52D68A]/10 border border-[#52D68A]/30 text-xs text-slate-200 flex items-start gap-2">
              <Target className="w-4 h-4 text-[#52D68A] flex-shrink-0 mt-0.5" />
              <span>
                <strong className="text-[#52D68A]">Why this question was selected:</strong> {currentQuestion.targetReason}
              </span>
            </div>
          )}
        </div>

        {/* Answering Interfaces (Coding vs MCQ vs Dual-Input) */}
        {currentQuestion.roundType === 'coding' ? (
          <div className="space-y-4">
            <MonacoCodeEditor
              question={currentQuestion}
              sessionId={sessionId}
              code={answer}
              onChange={setAnswer}
              onSubmitSolution={(finalCode, lang) => {
                setAnswer(finalCode);
                setCodingLanguage(lang);
                handleSubmitAnswer(finalCode, lang);
              }}
              submitting={submitting}
            />
          </div>
        ) : currentQuestion.roundType === 'mcq' && currentQuestion.options ? (
          <div className="space-y-3 pt-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Select the best answer:
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              {currentQuestion.options.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAnswer(opt.text)}
                  className={`p-4 rounded-2xl border text-left text-sm transition-all flex items-start gap-3 ${
                    answer === opt.text
                      ? 'bg-indigo-600/15 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500 shadow-md'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                      answer === opt.text ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span>{opt.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <DualInputAnswerBox
            value={answer}
            onChange={setAnswer}
            onTelemetryChange={setAnswerTelemetry}
            sessionId={sessionId}
            questionId={currentQuestion._id || currentQuestion.id}
            disabled={submitting}
            placeholder={
              currentQuestion.roundType === 'behavioral'
                ? 'Type or speak your STAR story (Situation, Task, Action, Result)...'
                : 'Type your technical solution or speak to dictate your thoughts naturally...'
            }
          />
        )}

        {/* Error message */}
        {error && <div className="text-xs text-rose-400 font-medium">{error}</div>}

        {/* Action Controls for Non-Coding & Non-Voice modes */}
        {currentQuestion.roundType !== 'coding' && !(useVoiceMode || currentQuestion.roundType === 'voice') && (
          <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-[#1B3A60] gap-3">
            <div className="text-xs text-slate-400 flex items-center gap-1.5 self-start sm:self-auto">
              <Shield className="w-3.5 h-3.5 text-[#52D68A]" /> Focus monitoring active
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
              {/* Submit & Next Question */}
              <button
                type="button"
                onClick={() => handleSubmitAnswer()}
                disabled={submitting || (!answer && currentQuestion.roundType === 'mcq')}
                className="px-6 py-2.5 bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] text-sm font-bold rounded-xl shadow-lg shadow-[#52D68A]/20 transition flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-[#0B192C] border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    Submit & Next <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Closed Camera / Face Missing Blocking Proctoring Overlay */}
      {isProctoringActive && (missingFaceSeconds >= 3 || isFaceMissingLong) && !isPaused && session?.status !== 'completed' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#071322]/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0F2238] border-2 border-rose-500 rounded-3xl p-8 max-w-lg w-full text-center space-y-5 shadow-2xl animate-pulse">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
              <CameraOff className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/30">
                PROCTORING INTEGRITY LOCK
              </span>
              <h3 className="text-xl font-bold text-white tracking-tight pt-2">
                Camera Covered or Candidate Not Detected
              </h3>
              <p className="text-xs text-rose-200 leading-relaxed">
                No face is detected in your webcam stream ({missingFaceSeconds || 3}s elapsed).
                In accordance with proctoring integrity policies, you must remain clearly visible in front of your camera at all times during the assessment.
              </p>
            </div>

            <div className="p-3 bg-[#0B192C] rounded-2xl border border-rose-500/30 text-xs text-slate-300">
              Exam answering and submissions are paused. Return to the center of the camera frame to resume the assessment.
            </div>

            <div className="text-[11px] text-amber-300 font-mono">
              Integrity Status: {integrityStatus} • Focus: 0%
            </div>
          </div>
        </div>
      )}

      {/* Exit Interview Confirmation Dialog Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#071322]/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
                <LogOut className="w-6 h-6" />
              </div>
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-[#1B3A60]/60 transition cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white tracking-tight">Exit Interview Session?</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to end your interview session now?
              </p>
            </div>

            <div className="p-3.5 bg-[#071322] rounded-2xl border border-[#1B3A60] space-y-2 text-xs text-slate-300">
              <div className="font-semibold text-slate-200">Session Exit Summary:</div>
              <ul className="space-y-1.5 text-[11px] text-slate-400 list-disc list-inside">
                <li>Your completed responses ({session?.responses?.length || 0} questions) will be securely saved.</li>
                <li>A partial scorecard and evaluation report will be generated.</li>
                <li>All proctoring logs, focus telemetry, and integrity audit trails will be stored.</li>
                <li>You will be redirected to your evaluation summary.</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                disabled={isExiting}
                className="w-full sm:flex-1 py-2.5 px-4 bg-[#0B192C] hover:bg-[#132A46] border border-[#1B3A60] text-slate-200 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Continue Interview
              </button>

              <button
                type="button"
                onClick={handleConfirmExitInterview}
                disabled={isExiting}
                className="w-full sm:flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/25 transition flex items-center justify-center gap-2 cursor-pointer"
                id="confirm-end-interview-btn"
              >
                {isExiting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <LogOut className="w-3.5 h-3.5" />
                    <span>End Interview</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paused Overlay Modal */}
      {isPaused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl">
            <div className="inline-flex p-4 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Pause className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white tracking-tight">Assessment Paused</h3>
              <p className="text-xs text-slate-400">
                Your question timer is safely frozen on the server at{' '}
                <strong className="text-white font-mono">{remainingTimerSeconds}s</strong> remaining.
              </p>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300">
              You can resume now, or return from your dashboard whenever you are ready.
            </div>

            <button
              onClick={handleResumeSession}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/25 transition flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" /> Resume Assessment
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewScreen;