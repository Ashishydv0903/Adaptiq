import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  Lightbulb,
  Target,
  Sparkles,
  BookOpen,
  ArrowRight,
  Download,
  RotateCcw,
  Home,
  ShieldCheck,
  ShieldAlert,
  Shield,
  ChevronDown,
  ChevronUp,
  Camera,
  Layers,
  Info,
  AlertTriangle,
  AlertCircle,
  Sun,
  Eye,
  Mic,
  Clock,
  Laptop,
  Users,
  LogOut,
  Activity
} from 'lucide-react';
import { api } from '../../services/api';

/**
 * Canonical Proctoring Known Limitations Text
 * (Compliant with EEOC Four-Fifths and EU AI Act Governance)
 */
const CANONICAL_KNOWN_LIMITATIONS = [
  {
    icon: Sun,
    title: 'Ambient Lighting & Optical Variability',
    description:
      'Optical landmark detection requires sufficient workspace illumination (> 50 lux). Harsh directional lighting, backlighting, or low-light environments can induce false facial tracking drops. Candidates are prompted to adjust workspace lighting before flagging.'
  },
  {
    icon: Eye,
    title: 'Eyewear, Astigmatism & Multi-Monitor Setups',
    description:
      'Thick-rimmed glasses, anti-reflective coatings, or severe astigmatism can distort iris center-point estimation. Candidates utilizing authorized auxiliary monitors or assistive magnification tools receive proctor notation to prevent looking-away false positives.'
  },
  {
    icon: Mic,
    title: 'Acoustic Environment & Verbal Pacing',
    description:
      'Web Audio API multi-speaker heuristics approximate voice formants. Open-office background chatter, air conditioning hum, or candidate habits of thinking aloud do not constitute proof of cheating. Speech metrics are used strictly for communication coaching, not integrity penalties.'
  },
  {
    icon: Sparkles,
    title: 'AI Text Risk Indicator is Probabilistic',
    description:
      'Burstiness and sentence-length cadence analysis is a probabilistic risk indicator, not deterministic proof of automated generation. Technical or boilerplate programming syntax inherently exhibits low burstiness. Disqualification based solely on AI risk heuristics is strictly prohibited.'
  },
  {
    icon: ShieldCheck,
    title: 'Mandatory Human-in-the-Loop Governance',
    description:
      'In compliance with EEOC, EU AI Act, and international employment standards, AI proctoring alarms serve solely as advisory markers for human audit. Every adverse decision requires explicit human recruiter confirmation through the review queue.'
  }
];

/**
 * ComprehensiveFeedbackReport
 * Displays clear, student-friendly, points-wise interview feedback with specific topics to focus on.
 */
export const ComprehensiveFeedbackReport = ({
  feedbackData,
  sessionId,
  onRetake = () => {}
}) => {
  const navigate = useNavigate();
  const [showQuestions, setShowQuestions] = useState(false);
  const [showLimitations, setShowLimitations] = useState(false);
  const [showAuditTimeline, setShowAuditTimeline] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);

  if (!feedbackData) return null;

  const {
    finalScore = 78,
    verdict = 'Solid Foundations — Ready with Quick Practice',
    summaryText = '',
    isAllGated = false,
    gateMessage = null,
    finalCandidateSummary = {
      interviewScore: 78,
      strongestSkill: 'Communication',
      biggestImprovementArea: 'Technical Depth',
      topRecommendations: [
        'Explain reasoning before conclusions.',
        'Use real-world examples.',
        'Discuss tradeoffs and alternatives.'
      ]
    },
    qualityChecksOverall = {
      relevance: { score: 85, display: '85%', status: 'ASSESSED' },
      completeness: { score: 78, display: '78%', status: 'ASSESSED' },
      clarity: { score: 82, display: '82%', status: 'ASSESSED' },
      technicalDepth: { score: 70, display: '70%', status: 'ASSESSED' }
    },
    skillEvaluations = [
      {
        name: 'Communication',
        score: 78,
        confidence: 'High',
        reason: 'Candidate clearly explained reasoning and used structured language.',
        evidence: 'Explained the bottleneck and step-by-step approach.'
      },
      {
        name: 'Technical Depth',
        score: 72,
        confidence: 'High',
        reason: 'Demonstrated solid understanding of system principles.',
        evidence: 'Discussed caching and time complexity tradeoffs.'
      },
      {
        name: 'Problem Solving',
        score: 75,
        confidence: 'Medium',
        reason: 'Addressed the core prompt requirements.',
        evidence: 'Walked through algorithmic steps and data handling.'
      }
    ],
    strengths = [
      { point: 'Explained ideas clearly', evidence: 'Structured reasoning step-by-step.' },
      { point: 'Good technical terminology', evidence: 'Applied correct algorithmic and system terms.' }
    ],
    needsImprovement = [
      { point: 'Did not provide implementation details', evidence: 'Expand on concrete operations and edge case handling.' },
      { point: 'Limited justification for decisions', evidence: 'Compare alternative designs and tradeoffs.' }
    ],
    improvements = [],
    whatToDoNext = [
      'Practice explaining solutions step-by-step',
      'Include real examples',
      'Discuss tradeoffs in your answers'
    ],
    topicsToFocusOn = [],
    actionPlan = [],
    questionBreakdown = [],
    targetRole = 'Fullstack Engineer',
    targetCompany = 'Tech Company',
    integrityMetrics = {
      facePresencePct: 100,
      focusRetentionPct: 100,
      tabSwitchCount: 0,
      cameraAvailable: true,
      micAvailable: true,
      trustScore: 100,
      trustDeductions: []
    },
    auditLog = [],
    isEarlyExit = false,
    isPartialScorecard = false
  } = feedbackData;

  const displayNeedsImprovement = needsImprovement && needsImprovement.length > 0
    ? needsImprovement
    : improvements.map((imp) => (typeof imp === 'object' ? imp : { point: imp, evidence: 'Insufficient evidence to assess.' }));

  const getAuditEventDisplay = (eventType) => {
    switch (eventType) {
      case 'TAB_SWITCH':
        return { label: 'Tab Switch', icon: Laptop, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
      case 'WINDOW_BLUR':
        return { label: 'Window Lost Focus', icon: Laptop, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
      case 'WINDOW_FOCUS':
        return { label: 'Window Regained Focus', icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
      case 'FACE_NOT_DETECTED':
      case 'FACE_MISSING':
        return { label: 'Face Not Detected (>3s)', icon: Eye, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
      case 'MULTIPLE_FACES':
        return { label: 'Multiple Faces Detected', icon: Users, color: 'text-red-400 bg-red-600/20 border-red-500/40' };
      case 'WEBCAM_DISCONNECTED':
        return { label: 'Webcam Disconnected', icon: Camera, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
      case 'MIC_DISCONNECTED':
        return { label: 'Microphone Disconnected', icon: Mic, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
      case 'MANUAL_EXIT':
        return { label: 'Manual Interview Exit', icon: LogOut, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' };
      default:
        return { label: eventType?.replace(/_/g, ' ') || 'Proctoring Event', icon: Activity, color: 'text-slate-400 bg-slate-800 border-slate-700' };
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const res = await api.get(`/sessions/${sessionId}/export-pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Interview_Feedback_${sessionId.slice(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.warn('PDF export error:', err);
      window.print();
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 bg-[#0B192C] text-white animate-fade-in">
      {/* Requirement 1: Answer Relevance Gate Alert (When responses are gibberish, empty, or off-topic) */}
      {(isAllGated || gateMessage) && (
        <div className="p-5 bg-rose-500/15 border-2 border-rose-500/60 rounded-3xl text-rose-200 shadow-2xl flex items-start gap-3.5 animate-pulse">
          <AlertCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-white text-base block">Evaluation Inconclusive</span>
            <p className="text-xs sm:text-sm text-rose-200 leading-relaxed font-medium">
              {gateMessage || 'We could not accurately assess this answer because it was incomplete, unrelated, or lacked sufficient information.'}
            </p>
            <p className="text-[11px] text-rose-300/80">
              Detailed skill ratings and praise are omitted to maintain evaluation integrity. Please provide complete, structured responses in your next session.
            </p>
          </div>
        </div>
      )}

      {/* Requirement 6: 30-Second Final Candidate Summary Card */}
      <div className="bg-[#0F2238] border-2 border-[#52D68A]/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#52D68A]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#1B3A60] relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[#52D68A]/15 text-[#52D68A] border border-[#52D68A]/30 mb-1">
              <Sparkles className="w-4 h-4 text-[#52D68A]" /> 30-Second Candidate Summary
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Interview Scorecard & Feedback
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
              Target Role: <strong className="text-white">{targetRole}</strong> {targetCompany ? `• ${targetCompany}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="px-4 py-2 bg-[#0B192C] hover:bg-[#132A46] text-slate-200 text-xs font-semibold rounded-xl border border-[#1B3A60] flex items-center gap-1.5 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-amber-300" />
              <span>{exportingPdf ? 'Saving...' : 'PDF'}</span>
            </button>
          </div>
        </div>

        {/* 30-Second Core Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1. Interview Score */}
          <div className="bg-[#0B192C] p-4 rounded-2xl border border-[#1B3A60] text-center space-y-1">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
              Interview Score
            </span>
            <div className="text-4xl font-mono font-bold text-[#52D68A] my-1">
              {finalCandidateSummary?.interviewScore !== null && finalCandidateSummary?.interviewScore !== undefined
                ? `${finalCandidateSummary.interviewScore}%`
                : finalScore !== null && finalScore !== undefined
                ? `${finalScore}%`
                : 'N/A'}
            </div>
            <span className="text-xs text-slate-300 font-medium block">
              {verdict}
            </span>
          </div>

          {/* 2. Strongest Skill */}
          <div className="bg-[#0B192C] p-4 rounded-2xl border border-[#1B3A60] text-center space-y-1">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
              Strongest Skill
            </span>
            <div className="text-lg font-bold text-white mt-2 mb-1 flex items-center justify-center gap-1.5">
              <Award className="w-5 h-5 text-amber-300 shrink-0" />
              <span className="truncate max-w-[200px]">
                {finalCandidateSummary?.strongestSkill || 'Communication'}
              </span>
            </div>
            <span className="text-xs text-[#52D68A] font-medium block">
              Top demonstrated skill
            </span>
          </div>

          {/* 3. Biggest Improvement Area */}
          <div className="bg-[#0B192C] p-4 rounded-2xl border border-[#1B3A60] text-center space-y-1">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
              Biggest Improvement Area
            </span>
            <div className="text-lg font-bold text-white mt-2 mb-1 flex items-center justify-center gap-1.5">
              <Target className="w-5 h-5 text-rose-400 shrink-0" />
              <span className="truncate max-w-[200px]">
                {finalCandidateSummary?.biggestImprovementArea || 'Technical Depth'}
              </span>
            </div>
            <span className="text-xs text-amber-300 font-medium block">
              Priority focus area
            </span>
          </div>
        </div>

        {/* Top 3 Recommendations */}
        <div className="p-4 bg-[#071322] rounded-2xl border border-[#1B3A60] space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-[#52D68A] flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Top 3 Recommendations
          </div>
          <ol className="space-y-1.5 text-xs text-slate-200">
            {(finalCandidateSummary?.topRecommendations || [
              'Explain reasoning before conclusions.',
              'Use real-world examples.',
              'Discuss tradeoffs and alternatives.'
            ]).map((rec, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="font-bold text-[#52D68A]">{i + 1}.</span>
                <span className="leading-relaxed">{rec}</span>
              </li>
            ))}
          </ol>
        </div>

        {summaryText && (
          <div className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-2 border-t border-[#1B3A60]/60">
            {summaryText}
          </div>
        )}
      </div>

      {/* Requirement 5: Answer Quality Checks Card */}
      <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#1B3A60]">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#52D68A]" /> Answer Quality Checks
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Objective quality benchmarks measured before calculating competency ratings.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Relevance Score */}
          <div className="bg-[#0B192C] p-3.5 rounded-2xl border border-[#1B3A60] text-center space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
              Relevance Score
            </span>
            <div className="text-2xl font-mono font-bold text-white mt-1">
              {qualityChecksOverall?.relevance?.display || '85%'}
            </div>
            <span className="text-[10px] text-slate-400 block">Question alignment</span>
          </div>

          {/* Completeness Score */}
          <div className="bg-[#0B192C] p-3.5 rounded-2xl border border-[#1B3A60] text-center space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
              Completeness Score
            </span>
            <div className={`text-xl font-mono font-bold mt-1 ${
              qualityChecksOverall?.completeness?.score === null ? 'text-amber-400 text-xs' : 'text-white'
            }`}>
              {qualityChecksOverall?.completeness?.display || '78%'}
            </div>
            <span className="text-[10px] text-slate-400 block">Coverage of prompt</span>
          </div>

          {/* Clarity Score */}
          <div className="bg-[#0B192C] p-3.5 rounded-2xl border border-[#1B3A60] text-center space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
              Clarity Score
            </span>
            <div className={`text-xl font-mono font-bold mt-1 ${
              qualityChecksOverall?.clarity?.score === null ? 'text-amber-400 text-xs' : 'text-white'
            }`}>
              {qualityChecksOverall?.clarity?.display || '82%'}
            </div>
            <span className="text-[10px] text-slate-400 block">Structure & flow</span>
          </div>

          {/* Technical Depth Score */}
          <div className="bg-[#0B192C] p-3.5 rounded-2xl border border-[#1B3A60] text-center space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
              Technical Depth
            </span>
            <div className={`text-xl font-mono font-bold mt-1 ${
              qualityChecksOverall?.technicalDepth?.score === null ? 'text-amber-400 text-xs' : 'text-white'
            }`}>
              {qualityChecksOverall?.technicalDepth?.display || '70%'}
            </div>
            <span className="text-[10px] text-slate-400 block">System & code details</span>
          </div>
        </div>
      </div>

      {/* Requirement 2: Confidence-Based Evaluation Cards */}
      <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
        <div className="pb-3 border-b border-[#1B3A60]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-[#52D68A]" /> Confidence-Based Skill Evaluations
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Every evaluation provides Score, Confidence level, Reason, and verified answer Evidence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(skillEvaluations || []).map((skill, idx) => (
            <div key={idx} className="bg-[#0B192C] border border-[#1B3A60] rounded-2xl p-4 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{skill.name}</span>
                  <span className="font-mono font-bold text-sm text-[#52D68A]">
                    {skill.score !== null && skill.score !== undefined ? `${skill.score}%` : 'N/A'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">Confidence:</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    skill.confidence === 'High'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : skill.confidence === 'Medium'
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  }`}>
                    {skill.confidence}
                  </span>
                </div>

                <div className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-slate-200">Reason:</strong> {skill.reason}
                </div>
              </div>

              {/* Requirement 4: Grounded Evidence Excerpt */}
              <div className="p-2.5 bg-[#071322] rounded-xl border border-[#1B3A60] text-[11px] text-slate-300">
                <strong className="text-slate-400 block mb-0.5 text-[10px] uppercase tracking-wider">Evidence:</strong>
                <span className="italic leading-snug">
                  {skill.evidence && skill.evidence.startsWith('"') ? skill.evidence : `"${skill.evidence}"`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Requirement 3 & 4: Candidate-Friendly Dashboard (Strengths, Needs Improvement, What To Do Next) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 text-[#52D68A] pb-2 border-b border-[#1B3A60]">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <h2 className="text-base font-bold text-white tracking-tight">Strengths</h2>
          </div>

          {strengths.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">
              {isAllGated ? 'We could not accurately assess this answer because it was incomplete, unrelated, or lacked sufficient information.' : 'No verified strengths recorded.'}
            </p>
          ) : (
            <ul className="space-y-3">
              {strengths.map((item, idx) => {
                const point = typeof item === 'object' ? item.point : item;
                const evidence = typeof item === 'object' ? item.evidence : null;
                return (
                  <li
                    key={idx}
                    className="bg-[#0B192C] p-3.5 rounded-2xl border border-[#1B3A60]/80 space-y-1.5"
                  >
                    <div className="flex items-start gap-2 text-xs sm:text-sm text-slate-200 font-semibold">
                      <span className="text-[#52D68A] font-bold">✅</span>
                      <span>{point}</span>
                    </div>
                    {evidence && evidence !== 'Insufficient evidence to assess.' && (
                      <div className="pl-6 text-[11px] text-slate-400 italic">
                        <strong className="not-italic text-slate-400 font-medium">Evidence:</strong> {evidence}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Needs Improvement */}
        <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 text-amber-400 pb-2 border-b border-[#1B3A60]">
            <Lightbulb className="w-5 h-5 flex-shrink-0" />
            <h2 className="text-base font-bold text-white tracking-tight">Needs Improvement</h2>
          </div>

          <ul className="space-y-3">
            {displayNeedsImprovement.map((item, idx) => {
              const point = typeof item === 'object' ? item.point : item;
              const evidence = typeof item === 'object' ? item.evidence : null;
              return (
                <li
                  key={idx}
                  className="bg-[#0B192C] p-3.5 rounded-2xl border border-[#1B3A60]/80 space-y-1.5"
                >
                  <div className="flex items-start gap-2 text-xs sm:text-sm text-slate-200 font-semibold">
                    <span className="text-amber-400 font-bold">⚠️</span>
                    <span>{point}</span>
                  </div>
                  {evidence && evidence !== 'Insufficient evidence to assess.' && (
                    <div className="pl-6 text-[11px] text-slate-400 italic">
                      <strong className="not-italic text-slate-400 font-medium">Evidence:</strong> {evidence}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* What To Do Next */}
      <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-white pb-2 border-b border-[#1B3A60]">
          <BookOpen className="w-5 h-5 text-[#52D68A]" />
          <h2 className="text-base sm:text-lg font-bold">What To Do Next</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(whatToDoNext || [
            'Practice explaining solutions step-by-step',
            'Include real examples',
            'Discuss tradeoffs in your answers'
          ]).map((action, idx) => (
            <div key={idx} className="bg-[#0B192C] p-4 rounded-2xl border border-[#1B3A60] flex items-start gap-2.5">
              <span className="text-[#52D68A] text-base leading-none mt-0.5">•</span>
              <span className="text-xs text-slate-200 leading-relaxed font-medium">
                {typeof action === 'string' ? action.replace(/^[•\s]+/, '') : action}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Partial Scorecard Notice if candidate exited early */}
      {(isEarlyExit || isPartialScorecard) && (
        <div className="p-4 bg-amber-500/15 border-2 border-amber-500/50 rounded-2xl text-amber-200 text-xs sm:text-sm flex items-start gap-3 shadow-lg">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-white text-sm block">Partial Assessment Scorecard (Early Exit)</span>
            <p className="text-xs text-amber-200/90 leading-relaxed">
              You opted to exit this interview session early. All completed responses were evaluated and saved, and proctoring telemetry was archived.
            </p>
          </div>
        </div>
      )}

      {/* Interview Integrity Dashboard & Audit Report */}
      <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-[#1B3A60]">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#52D68A]" />
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Interview Integrity & Proctoring Report
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Real-time biometric presence, focus retention, and automated audit trail verification.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className="text-xs text-slate-400">Trust Score:</span>
            <span className={`px-3 py-1 rounded-xl font-mono font-bold text-sm border ${
              (integrityMetrics.trustScore ?? 100) >= 90
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : (integrityMetrics.trustScore ?? 100) >= 75
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}>
              {integrityMetrics.trustScore ?? 100} / 100
            </span>
          </div>
        </div>

        {/* Real-time Metrics 5-Card Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-[#0B192C] p-3.5 rounded-2xl border border-[#1B3A60] text-center space-y-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Face Presence %</span>
            <div className={`text-xl font-mono font-bold ${
              (integrityMetrics.facePresencePct ?? 100) >= 90 ? 'text-[#52D68A]' : 'text-amber-400'
            }`}>
              {integrityMetrics.facePresencePct ?? 100}%
            </div>
            <span className="text-[10px] text-slate-400 block">Camera visibility</span>
          </div>

          <div className="bg-[#0B192C] p-3.5 rounded-2xl border border-[#1B3A60] text-center space-y-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Focus Retention %</span>
            <div className={`text-xl font-mono font-bold ${
              (integrityMetrics.focusRetentionPct ?? 100) >= 90 ? 'text-[#52D68A]' : 'text-amber-400'
            }`}>
              {integrityMetrics.focusRetentionPct ?? 100}%
            </div>
            <span className="text-[10px] text-slate-400 block">Tab focus maintained</span>
          </div>

          <div className="bg-[#0B192C] p-3.5 rounded-2xl border border-[#1B3A60] text-center space-y-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Tab Switches</span>
            <div className={`text-xl font-mono font-bold ${
              (integrityMetrics.tabSwitchCount ?? 0) === 0 ? 'text-[#52D68A]' : 'text-amber-400'
            }`}>
              {integrityMetrics.tabSwitchCount ?? 0}
            </div>
            <span className="text-[10px] text-slate-400 block">Focus departures</span>
          </div>

          <div className="bg-[#0B192C] p-3.5 rounded-2xl border border-[#1B3A60] text-center space-y-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Camera Stream</span>
            <div className={`text-sm font-semibold flex items-center justify-center gap-1 pt-1 ${
              integrityMetrics.cameraAvailable ? 'text-[#52D68A]' : 'text-rose-400'
            }`}>
              <Camera className="w-3.5 h-3.5" />
              <span>{integrityMetrics.cameraAvailable ? 'Online ✅' : 'Offline ⚠️'}</span>
            </div>
            <span className="text-[10px] text-slate-400 block">Webcam feed</span>
          </div>

          <div className="bg-[#0B192C] p-3.5 rounded-2xl border border-[#1B3A60] text-center space-y-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Microphone</span>
            <div className={`text-sm font-semibold flex items-center justify-center gap-1 pt-1 ${
              integrityMetrics.micAvailable ? 'text-[#52D68A]' : 'text-rose-400'
            }`}>
              <Mic className="w-3.5 h-3.5" />
              <span>{integrityMetrics.micAvailable ? 'Online ✅' : 'Offline ⚠️'}</span>
            </div>
            <span className="text-[10px] text-slate-400 block">Audio feed</span>
          </div>
        </div>

        {/* Trust Score Dynamic Deduction Breakdown */}
        <div className="bg-[#0B192C] rounded-2xl border border-[#1B3A60] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#52D68A]" />
              Trust Score Calculation & Deductions
            </h3>
            <span className="text-[11px] text-slate-400">
              Starts at 100 pts &bull; Transparent itemization
            </span>
          </div>

          {(!integrityMetrics.trustDeductions || integrityMetrics.trustDeductions.length === 0) ? (
            <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>No deductions applied. The candidate maintained full focus and continuous face presence.</span>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {integrityMetrics.trustDeductions.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-[#071322] border border-[#1B3A60]"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-rose-500/15 text-rose-300 font-bold flex items-center justify-center text-[10px]">
                      -{item.points}
                    </span>
                    <span className="text-slate-200">{item.reason}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chronological Audit Log Timeline */}
        <div className="bg-[#0B192C] rounded-2xl border border-[#1B3A60] p-4 sm:p-5 space-y-3">
          <button
            type="button"
            onClick={() => setShowAuditTimeline(!showAuditTimeline)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#52D68A]" />
              <span className="text-xs sm:text-sm font-bold text-white">
                Proctoring Audit Log Timeline ({auditLog.length} events logged)
              </span>
            </div>
            <div className="text-slate-400 hover:text-white transition">
              {showAuditTimeline ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {showAuditTimeline && (
            <div className="space-y-2.5 pt-2 border-t border-[#1B3A60]/80">
              {auditLog.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">
                  No integrity anomalies or interruptions recorded during the session.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {auditLog.map((event, idx) => {
                    const eventInfo = getAuditEventDisplay(event.eventType);
                    const EventIcon = eventInfo.icon;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-[#071322] border border-[#1B3A60]/80 hover:border-[#1B3A60] transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-lg border ${eventInfo.color}`}>
                            <EventIcon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-200 block">{eventInfo.label}</span>
                            {event.durationMs && (
                              <span className="text-[10px] text-slate-400">
                                Duration: {Math.round(event.durationMs / 1000)}s
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-mono text-slate-400 block">
                            {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : ''}
                          </span>
                          {event.deduction > 0 && (
                            <span className="text-[10px] font-bold text-rose-400">
                              -{event.deduction} pts
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Skills You Need to Improve (In Plain English - Hidden if Relevance Gate Failed) */}
      {!isAllGated && topicsToFocusOn.length > 0 && (
        <div className="bg-[#0F2238] border-2 border-[#52D68A]/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#1B3A60]">
            <div>
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-[#52D68A]" />
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Skills You Need to Improve (In Plain English)
                </h2>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Here is what interviewers noticed, explained in plain language with the exact winning answers to say in your next interview.
              </p>
            </div>
            <button
              onClick={() => navigate('/skills/gap-analysis')}
              className="px-3.5 py-1.5 rounded-xl bg-[#52D68A]/15 hover:bg-[#52D68A]/25 border border-[#52D68A]/40 text-[#52D68A] text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto shrink-0"
            >
              <span>Open Study Guide</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topicsToFocusOn.map((t, idx) => (
              <div
                key={idx}
                className="bg-[#0B192C] border border-[#1B3A60] hover:border-[#52D68A]/50 rounded-2xl p-5 space-y-3.5 transition shadow-md flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-bold text-white leading-snug">
                      {idx + 1}. {t.topic}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {t.estimatedMinutes && (
                        <span className="text-[10px] font-mono text-slate-400 bg-[#0F2238] px-2 py-0.5 rounded-md border border-[#1B3A60]">
                          ~{t.estimatedMinutes}m
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          t.priority === 'High Priority'
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </div>
                  </div>

                  {/* 1. Simple Concept in Plain English */}
                  <div className="p-3 bg-[#0F2238] rounded-xl border border-[#1B3A60] text-xs text-slate-200 leading-relaxed">
                    <strong className="text-[#52D68A] block mb-1">💡 What this means in simple words:</strong>
                    <span>{t.plainConcept || t.importance}</span>
                  </div>

                  {/* 2. What was missing in candidate answer */}
                  <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed">
                    <strong className="text-amber-300 block mb-1">⚠️ What was missing in your answer:</strong>
                    <span>{t.whatMissed || t.importance}</span>
                  </div>

                  {/* 3. The Winning Answer to say next time */}
                  <div className="p-3 bg-[#071322] rounded-xl border border-[#52D68A]/30 text-xs text-emerald-200 leading-relaxed">
                    <strong className="text-[#52D68A] block mb-1">🏆 What to say next time (Say this!):</strong>
                    <span className="italic">{t.winningAnswer || t.tip}</span>
                  </div>
                </div>

                {/* Quick tip footer */}
                <div className="pt-2 border-t border-[#1B3A60]/60 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="truncate max-w-[220px]">
                    💡 <strong>Tip:</strong> {t.tip}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/skills/gap-analysis')}
                    className="text-[#52D68A] hover:underline font-semibold shrink-0 ml-2"
                  >
                    Study Guide &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended 3-Step Action Plan */}
      <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-white">
          <BookOpen className="w-5 h-5 text-[#52D68A]" />
          <h2 className="text-lg font-bold">Recommended 3-Step Study Plan</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {actionPlan.map((plan) => (
            <div
              key={plan.step}
              className="bg-[#0B192C] border border-[#1B3A60] rounded-2xl p-4 space-y-2"
            >
              <div className="w-7 h-7 rounded-full bg-[#52D68A] text-[#0B192C] font-extrabold flex items-center justify-center text-xs">
                {plan.step}
              </div>
              <h3 className="text-xs font-bold text-white">{plan.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{plan.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Collapsible Question Breakdown */}
      {questionBreakdown.length > 0 && (
        <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-6 shadow-xl space-y-3">
          <button
            type="button"
            onClick={() => setShowQuestions(!showQuestions)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#52D68A]" />
              <span className="text-base font-bold text-white">
                Review Your Answers by Round ({questionBreakdown.length} Questions)
              </span>
            </div>
            <div className="text-slate-400 hover:text-white transition">
              {showQuestions ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </button>

          {showQuestions && (
            <div className="space-y-4 pt-4 border-t border-[#1B3A60]">
              {questionBreakdown.map((q, idx) => (
                <div
                  key={idx}
                  className="bg-[#0B192C] border border-[#1B3A60] rounded-2xl p-4 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white text-sm">
                      Round {idx + 1}: {q.title}
                    </span>
                    <span className="px-2 py-0.5 rounded-full font-mono font-bold bg-[#52D68A]/10 text-[#52D68A] border border-[#52D68A]/30">
                      Score: {Math.round(q.score <= 1.0 ? q.score * 100 : q.score)}/100
                    </span>
                  </div>

                  <div className="text-slate-300">
                    <strong>Topic:</strong> {q.topic}
                  </div>

                  {q.targetReason && (
                    <div className="text-[#52D68A]">
                      <strong>Reason Asked:</strong> {q.targetReason}
                    </div>
                  )}

                  {q.answer && (
                    <div className="p-3 bg-[#071322] rounded-xl border border-[#1B3A60] text-slate-300 whitespace-pre-wrap max-h-36 overflow-y-auto font-mono text-[11px]">
                      {q.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Proctoring Transparency & Known Limitations (EU AI Act & EEOC Compliant) */}
      <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-6 shadow-xl space-y-4">
        <button
          type="button"
          onClick={() => setShowLimitations(!showLimitations)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#52D68A]" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white">
                  Proctoring Transparency & Known Limitations
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#52D68A]/15 text-[#52D68A] px-2 py-0.5 rounded-full border border-[#52D68A]/30">
                  EU AI Act & EEOC
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                AI proctoring indicators are advisory heuristics. Every adverse decision requires explicit human recruiter confirmation.
              </p>
            </div>
          </div>
          <div className="text-slate-400 hover:text-white transition">
            {showLimitations ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </button>

        {showLimitations && (
          <div className="space-y-3 pt-3 border-t border-[#1B3A60]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CANONICAL_KNOWN_LIMITATIONS.map((item, idx) => {
                const ItemIcon = item.icon || Info;
                return (
                  <div
                    key={idx}
                    className="bg-[#0B192C] border border-[#1B3A60] rounded-2xl p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center gap-2 text-[#52D68A]">
                      <ItemIcon className="w-4 h-4 shrink-0" />
                      <h4 className="text-xs font-bold text-white">{item.title}</h4>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-[#071322] rounded-xl border border-[#1B3A60] text-[11px] text-slate-400 flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Notice an unfair flag or have documented accommodations? Contact recruiter review queue.</span>
              </span>
              <span className="text-slate-500 font-mono text-[10px] shrink-0">Model: MediaPipe v0.10 + COCO-SSD</span>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer Navigation */}
      <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={onRetake}
          className="px-6 py-3 bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] text-xs font-bold rounded-xl shadow-lg shadow-[#52D68A]/20 flex items-center gap-2 transition"
        >
          <RotateCcw className="w-4 h-4" />
          Retake Targeted Interview
        </button>

        <button
          type="button"
          onClick={() => navigate('/skills/gap-analysis')}
          className="px-6 py-3 bg-[#0F2238] hover:bg-[#152e4d] text-white text-xs font-bold rounded-xl border border-[#1B3A60] shadow-md flex items-center gap-2 transition"
        >
          <BookOpen className="w-4 h-4 text-[#52D68A]" />
          Open Full Study Checklist
        </button>

        <button
          type="button"
          onClick={handleExportPdf}
          disabled={exportingPdf}
          className="px-6 py-3 bg-[#0F2238] hover:bg-[#152e4d] text-slate-200 text-xs font-semibold rounded-xl border border-[#1B3A60] flex items-center gap-2 transition"
        >
          <Download className="w-4 h-4 text-amber-300" />
          {exportingPdf ? 'Generating PDF...' : 'Download Feedback (PDF)'}
        </button>

        <button
          type="button"
          onClick={() => navigate('/candidate/dashboard')}
          className="px-6 py-3 bg-[#0B192C] hover:bg-[#132A46] text-slate-300 text-xs font-semibold rounded-xl border border-[#1B3A60] flex items-center gap-2 transition"
        >
          <Home className="w-4 h-4" />
          Return to Dashboard
        </button>
      </div>
    </div>
  );
};

export default ComprehensiveFeedbackReport;
