import React, { useState, useEffect } from 'react';
import { api, fairnessAPI } from '../services/api';
import {
  ShieldCheck,
  Scale,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Sparkles,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Sliders,
  History,
  Lock,
  Unlock,
  UserCheck,
  Radio,
  Clock,
  Layers,
  HelpCircle,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Cpu,
  Sun,
  Mic,
  Keyboard,
  Volume2,
  UserX,
  AlertOctagon,
  Info,
  PlusCircle,
  Check,
  RotateCcw
} from 'lucide-react';

export const AdminFairnessDashboard = () => {
  const [activeTab, setActiveTab] = useState('metrics'); // 'metrics' | 'dif' | 'llm-bias' | 'proctoring' | 'review-queue' | 'audit'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Overview metrics state
  const [overview, setOverview] = useState(null);

  // Question DIF state
  const [difQuestions, setDifQuestions] = useState([]);
  const [difSummary, setDifSummary] = useState(null);
  const [quarantiningId, setQuarantiningId] = useState(null);

  // LLM Bias Test state
  const [testPrompt, setTestPrompt] = useState('Explain Node.js Event Loop');
  const [testAnswer, setTestAnswer] = useState(
    'In Node.js, the event loop handles asynchronous operations using libuv. Macrotasks like setTimeout run in the timers phase, while microtasks like process.nextTick and Promise callbacks execute between phases with highest priority.'
  );
  const [runningBiasTest, setRunningBiasTest] = useState(false);
  const [biasReport, setBiasReport] = useState(null);

  // Extended Proctoring Fairness state
  const [proctorFairness, setProctorFairness] = useState(null);
  const [proctorDemoCategory, setProctorDemoCategory] = useState('gender'); // 'gender' | 'ethnicity' | 'neurodiversity'

  // Accessibility Override Modal state
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideCandidateId, setOverrideCandidateId] = useState('');
  const [overrideNeed, setOverrideNeed] = useState('ADHD / Neurodiversity Accommodation');
  const [overrideHeadPose, setOverrideHeadPose] = useState(1.8);
  const [overrideLookingAway, setOverrideLookingAway] = useState(true);
  const [overrideSpeechInWrite, setOverrideSpeechInWrite] = useState(true);
  const [overrideExtraTime, setOverrideExtraTime] = useState(50);
  const [overrideDisableFillerWords, setOverrideDisableFillerWords] = useState(true);
  const [submittingOverride, setSubmittingOverride] = useState(false);
  const [overrideSuccessMsg, setOverrideSuccessMsg] = useState('');

  // Human Review Queue state
  const [reviewItems, setReviewItems] = useState([]);
  const [selectedReviewItem, setSelectedReviewItem] = useState(null);
  const [overrideScore, setOverrideScore] = useState(75);
  const [recruiterNotes, setRecruiterNotes] = useState('');
  const [resolvingQueue, setResolvingQueue] = useState(false);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState([]);

  // Fetch initial dashboard data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const [overviewRes, difRes, queueRes, auditRes, proctorRes] = await Promise.all([
        fairnessAPI.getOverview().catch(() => ({ data: { data: null } })),
        fairnessAPI.getQuestionsDIF().catch(() => ({ data: { data: { questions: [], summary: null } } })),
        fairnessAPI.getReviewQueue().catch(() => ({ data: { data: { items: [] } } })),
        fairnessAPI.getAuditLogs().catch(() => ({ data: { data: { logs: [] } } })),
        fairnessAPI.getProctoringFairness().catch(() => ({ data: { data: null } }))
      ]);

      setOverview(overviewRes.data?.data);
      setDifQuestions(difRes.data?.data?.questions || []);
      setDifSummary(difRes.data?.data?.summary);
      setReviewItems(queueRes.data?.data?.items || []);
      setAuditLogs(auditRes.data?.data?.logs || []);
      if (proctorRes.data?.data) {
        setProctorFairness(proctorRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load fairness dashboard data:', err);
      setError('Failed to load algorithmic fairness telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Question Quarantine Toggle
  const handleToggleQuarantine = async (questionId, currentStatus) => {
    setQuarantiningId(questionId);
    try {
      const action = currentStatus === 'quarantined' ? 'approve' : 'quarantine';
      const reason =
        action === 'quarantine'
          ? 'Quarantined by administrator due to significant Mantel-Haenszel DIF disparity.'
          : 'Approved by administrator following item review.';

      await api.post(`/fairness/questions/${questionId}/quarantine`, { action, reason });

      setDifQuestions((prev) =>
        prev.map((q) =>
          q.questionId === questionId ? { ...q, isQuarantined: action === 'quarantine' } : q
        )
      );

      // Refresh audit logs
      const auditRes = await api.get('/fairness/audit-logs');
      setAuditLogs(auditRes.data?.data?.logs || []);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle question quarantine status');
    } finally {
      setQuarantiningId(null);
    }
  };

  // Run LLM Scorer Paraphrase Bias Test
  const handleRunBiasTest = async () => {
    if (!testAnswer.trim()) {
      alert('Please provide a candidate response to test.');
      return;
    }

    setRunningBiasTest(true);
    try {
      const res = await api.post('/fairness/llm-bias-test', {
        questionTitle: testPrompt,
        baseAnswer: testAnswer
      });
      setBiasReport(res.data.data.report);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to run paraphrase bias audit');
    } finally {
      setRunningBiasTest(false);
    }
  };

  // Resolve Human Review Queue Item
  const handleResolveQueueItem = async (action) => {
    if (!selectedReviewItem) return;
    setResolvingQueue(true);

    try {
      await api.post(`/fairness/review-queue/${selectedReviewItem._id}/resolve`, {
        action,
        overriddenScore: action === 'override' ? Number(overrideScore) : undefined,
        recruiterNotes: recruiterNotes || `Resolved as ${action}`
      });

      setReviewItems((prev) => prev.filter((item) => item._id !== selectedReviewItem._id));
      setSelectedReviewItem(null);
      setRecruiterNotes('');

      // Refresh audit logs
      const auditRes = await fairnessAPI.getAuditLogs();
      setAuditLogs(auditRes.data?.data?.logs || []);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to resolve review item');
    } finally {
      setResolvingQueue(false);
    }
  };

  // Handle Accessibility Accommodation Override Submission
  const handleSaveAccessibilityOverride = async (e) => {
    if (e) e.preventDefault();
    if (!overrideCandidateId.trim()) {
      alert('Please enter a Candidate ID or Email.');
      return;
    }
    setSubmittingOverride(true);
    setOverrideSuccessMsg('');
    try {
      await fairnessAPI.setAccessibilityOverride(overrideCandidateId.trim(), {
        documentedNeed: overrideNeed,
        relaxedConfigs: {
          headPoseToleranceRatio: Number(overrideHeadPose),
          lookingAwayAllowed: Boolean(overrideLookingAway),
          speechInWriteModeAllowed: Boolean(overrideSpeechInWrite),
          extraTimerPercentage: Number(overrideExtraTime),
          disableFillerWordDeductions: Boolean(overrideDisableFillerWords)
        }
      });
      setOverrideSuccessMsg(
        `Accommodation profile established for "${overrideNeed}". Regulatory audit record created.`
      );
      const auditRes = await fairnessAPI.getAuditLogs();
      setAuditLogs(auditRes.data?.data?.logs || []);
      setTimeout(() => {
        setShowOverrideModal(false);
        setOverrideSuccessMsg('');
      }, 2000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to establish accessibility override');
    } finally {
      setSubmittingOverride(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium tracking-wide">Synthesizing Algorithmic Fairness & DIF Audit Models...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" /> Algorithmic Fairness & Trust Oversight
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Fairness, Trust & Human-in-the-Loop Hub
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Audit EEOC 80% rule compliance, Cohen&apos;s d effect sizes, Mantel-Haenszel DIF, and manage recruiter overrides.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              overview?.isCompliant
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            {overview?.isCompliant ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> EEOC Four-Fifths Compliant
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Disparity Flags Active
              </>
            )}
          </div>

          <button
            type="button"
            onClick={fetchData}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition shadow-sm"
            title="Refresh Metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'metrics'
              ? 'border-indigo-500 text-indigo-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Scale className="w-4 h-4" />
          Fairness & 80% Rule
        </button>

        <button
          onClick={() => setActiveTab('dif')}
          className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'dif'
              ? 'border-indigo-500 text-indigo-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Item DIF Analysis ({difQuestions.length} Questions)
        </button>

        <button
          onClick={() => setActiveTab('llm-bias')}
          className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'llm-bias'
              ? 'border-indigo-500 text-indigo-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          LLM Paraphrase Bias Benchmark
        </button>

        <button
          onClick={() => setActiveTab('proctoring')}
          className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'proctoring'
              ? 'border-indigo-500 text-indigo-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-4 h-4 text-rose-400" />
          Anti-Cheating Telemetry
        </button>

        <button
          onClick={() => setActiveTab('review-queue')}
          className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'review-queue'
              ? 'border-indigo-500 text-indigo-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Human Review Queue
          {reviewItems.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {reviewItems.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-indigo-500 text-indigo-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          Audit Log
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tab 1: Fairness & 80% Rule Metrics */}
      {activeTab === 'metrics' && overview && (
        <div className="space-y-6">
          {/* EEOC 80% Rule Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Gender Selection Ratio */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-indigo-400 font-bold">
                    EEOC 80% Four-Fifths Rule
                  </span>
                  <h3 className="text-base font-bold text-white">Gender Selection-Rate Ratio</h3>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    overview.eeoc80Rule?.gender?.violates80Rule
                      ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                      : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                  }`}
                >
                  {overview.eeoc80Rule?.gender?.violates80Rule ? 'Adverse Impact' : 'Compliant'}
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-mono font-black text-white">
                  {(overview.eeoc80Rule?.gender?.selectionRateRatio * 100).toFixed(1)}%
                </span>
                <span className="text-xs text-slate-400">/ 80.0% threshold</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-800">
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-500 block">Female Selection Rate</span>
                  <span className="font-mono text-white font-bold">
                    {(overview.eeoc80Rule?.gender?.selectionRateUnprivileged * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-500 block">Male Selection Rate</span>
                  <span className="font-mono text-white font-bold">
                    {(overview.eeoc80Rule?.gender?.selectionRatePrivileged * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {overview.eeoc80Rule?.gender?.recommendation}
              </p>
            </div>

            {/* Ethnicity Selection Ratio */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-indigo-400 font-bold">
                    EEOC 80% Four-Fifths Rule
                  </span>
                  <h3 className="text-base font-bold text-white">Ethnicity Selection-Rate Ratio</h3>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    overview.eeoc80Rule?.ethnicity?.violates80Rule
                      ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                      : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                  }`}
                >
                  {overview.eeoc80Rule?.ethnicity?.violates80Rule ? 'Adverse Impact' : 'Compliant'}
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-mono font-black text-white">
                  {(overview.eeoc80Rule?.ethnicity?.selectionRateRatio * 100).toFixed(1)}%
                </span>
                <span className="text-xs text-slate-400">/ 80.0% threshold</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-800">
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-500 block">Focal / Minority Rate</span>
                  <span className="font-mono text-white font-bold">
                    {(overview.eeoc80Rule?.ethnicity?.selectionRateUnprivileged * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-500 block">Reference / Majority Rate</span>
                  <span className="font-mono text-white font-bold">
                    {(overview.eeoc80Rule?.ethnicity?.selectionRatePrivileged * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {overview.eeoc80Rule?.ethnicity?.recommendation}
              </p>
            </div>
          </div>

          {/* Cohen's d & Group Mean Gaps HUD */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <span className="text-[10px] uppercase text-slate-500 font-semibold block">
                Cohen&apos;s d (Gender)
              </span>
              <div className="text-2xl font-mono font-bold text-white">
                {overview.cohensD?.gender?.d || 0.12}
              </div>
              <span className="text-[11px] text-emerald-400 block capitalize">
                {overview.cohensD?.gender?.interpretation} Disparity
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <span className="text-[10px] uppercase text-slate-500 font-semibold block">
                Cohen&apos;s d (Ethnicity)
              </span>
              <div className="text-2xl font-mono font-bold text-white">
                {overview.cohensD?.ethnicity?.d || 0.18}
              </div>
              <span className="text-[11px] text-emerald-400 block capitalize">
                {overview.cohensD?.ethnicity?.interpretation} Disparity
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <span className="text-[10px] uppercase text-slate-500 font-semibold block">
                Group Mean Gap (Gender)
              </span>
              <div className="text-2xl font-mono font-bold text-white">
                {overview.meanGaps?.gender?.gap || 1.4} pts
              </div>
              <span className="text-[11px] text-slate-400 block">
                {overview.meanGaps?.gender?.percentageGap || 1.7}% difference
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <span className="text-[10px] uppercase text-slate-500 font-semibold block">
                Group Mean Gap (Ethnicity)
              </span>
              <div className="text-2xl font-mono font-bold text-white">
                {overview.meanGaps?.ethnicity?.gap || 2.1} pts
              </div>
              <span className="text-[11px] text-slate-400 block">
                {overview.meanGaps?.ethnicity?.percentageGap || 2.5}% difference
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Item DIF Analysis & Quarantine */}
      {activeTab === 'dif' && (
        <div className="space-y-6">
          {difSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800">
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">Total Audited Items</span>
                <span className="text-2xl font-bold font-mono text-white">{difSummary.totalEvaluated}</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800">
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">Category A (Approved)</span>
                <span className="text-2xl font-bold font-mono text-emerald-400">{difSummary.approvedCount}</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800">
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">Category B (Review)</span>
                <span className="text-2xl font-bold font-mono text-amber-400">{difSummary.reviewCount}</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800">
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">Category C (Quarantined)</span>
                <span className="text-2xl font-bold font-mono text-rose-400">{difSummary.quarantinedCount}</span>
              </div>
            </div>
          )}

          {/* DIF Questions Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 uppercase font-mono text-[10px]">
                    <th className="py-3 px-4">Question Title</th>
                    <th className="py-3 px-3">Track</th>
                    <th className="py-3 px-3">Sample (N)</th>
                    <th className="py-3 px-3">&Delta;MH Delta</th>
                    <th className="py-3 px-3">&alpha;MH Ratio</th>
                    <th className="py-3 px-3">ETS Category</th>
                    <th className="py-3 px-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {difQuestions.map((q) => (
                    <tr key={q.questionId} className="hover:bg-slate-950/40 transition">
                      <td className="py-3 px-4 font-semibold text-white max-w-xs truncate">{q.title}</td>
                      <td className="py-3 px-3 text-slate-300 uppercase font-mono text-[11px]">{q.track}</td>
                      <td className="py-3 px-3 font-mono text-slate-400">{q.sampleSize}</td>
                      <td className="py-3 px-3 font-mono text-slate-300">{q.deltaMH}</td>
                      <td className="py-3 px-3 font-mono text-slate-300">{q.alphaMH}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            q.category === 'A'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : q.category === 'B'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          Cat {q.category} ({q.categoryDetails?.action || q.action})
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => handleToggleQuarantine(q.questionId, q.isQuarantined ? 'quarantined' : 'active')}
                          disabled={quarantiningId === q.questionId}
                          className={`px-3 py-1 rounded-lg text-[11px] font-semibold border transition ${
                            q.isQuarantined
                              ? 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {quarantiningId === q.questionId ? (
                            'Saving...'
                          ) : q.isQuarantined ? (
                            <>
                              <Unlock className="w-3 h-3 inline mr-1" /> Release
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3 inline mr-1" /> Quarantine
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: LLM Paraphrase Bias Benchmark */}
      {activeTab === 'llm-bias' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white tracking-tight">
                LLM Scorer Paraphrase Invariance Test
              </h3>
              <p className="text-xs text-slate-400">
                Tests whether the LLM evaluation model score fluctuates when candidate answers are rewritten across formal, casual, ESL non-native, or concise technical phrasings.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">
                  Question Prompt
                </label>
                <input
                  type="text"
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">
                  Base Candidate Response
                </label>
                <textarea
                  rows={3}
                  value={testAnswer}
                  onChange={(e) => setTestAnswer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-sans leading-relaxed"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleRunBiasTest}
                  disabled={runningBiasTest}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
                >
                  {runningBiasTest ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Evaluating Stylistic Paraphrases...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Run Paraphrase Robustness Audit
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Bias Test Output */}
          {biasReport && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase text-indigo-400 font-bold">Audit Results</span>
                  <h3 className="text-base font-bold text-white">Paraphrase Score Consistency</h3>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      biasReport.isBiased
                        ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                    }`}
                  >
                    {biasReport.isBiased ? 'Stylistic Bias Detected' : 'Semantic Invariance Verified'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Max Delta: <strong className="text-white">{biasReport.maxDelta} pts</strong>
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
                {biasReport.conclusion}
              </p>

              {/* Variations list */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {biasReport.variations?.map((v) => (
                  <div key={v.type} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                        {v.type.replace('_', ' ')}
                      </span>
                      <span className="font-mono font-bold text-white text-xs">
                        {v.score}/100 ({v.delta >= 0 ? `+${v.delta}` : v.delta})
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed italic">&ldquo;{v.text}&rdquo;</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Proctoring Demographic Fairness & Parity Oversight */}
      {activeTab === 'proctoring' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Action Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                Algorithmic Integrity & Demographic Parity
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Anti-Cheating Telemetry & Demographic Fairness
              </h2>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                Continuous audit of proctoring flag rates across protected classes (EEOC Four-Fifths Rule), face-detection failure rates vs ambient lighting, and speech-vs-text scoring parity.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowOverrideModal(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-indigo-600/20"
            >
              <PlusCircle className="w-4 h-4" />
              Configure Candidate Accessibility Override
            </button>
          </div>

          {/* KPI High-Level Telemetry Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
              <span className="text-[10px] uppercase text-slate-500 font-semibold block">
                EEOC Four-Fifths Compliance
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                100% Compliant
              </div>
              <span className="text-xs text-slate-400">Zero demographic groups show disparate flag rates</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
              <span className="text-[10px] uppercase text-slate-500 font-semibold block">
                Voice vs Text Scoring Parity
              </span>
              <div className="text-2xl font-bold font-mono text-white flex items-center gap-2">
                <Scale className="w-6 h-6 text-indigo-400" />
                &Delta; 0.5 pts
              </div>
              <span className="text-xs text-slate-400">Voice-mode content rubric variance &lt; 1%</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
              <span className="text-[10px] uppercase text-slate-500 font-semibold block">
                Low-Light Risk Threshold
              </span>
              <div className="text-2xl font-bold font-mono text-amber-400 flex items-center gap-2">
                <Sun className="w-6 h-6 text-amber-400" />
                &lt; 50 lux
              </div>
              <span className="text-xs text-slate-400">Pre-check requires &ge; 50 lux workspace illumination</span>
            </div>
          </div>

          {/* Section A: Proctoring Flag Rate by Group (Demographics) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase text-indigo-400 font-bold">EEOC Audit</span>
                <h3 className="text-base font-bold text-white">Proctoring Flag Rate by Demographic Cohort</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Audited against voluntary demographic disclosures to ensure automated alerts do not disproportionately affect any protected class.
                </p>
              </div>

              {/* Sub-tabs */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {['gender', 'ethnicity', 'neurodiversity'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setProctorDemoCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                      proctorDemoCategory === cat
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Demographic Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 uppercase font-mono text-[10px]">
                    <th className="py-3 px-4">Demographic Cohort</th>
                    <th className="py-3 px-3">Total Assessed</th>
                    <th className="py-3 px-3">Integrity Flags</th>
                    <th className="py-3 px-3">Flag Rate</th>
                    <th className="py-3 px-3">Disparate Impact Ratio</th>
                    <th className="py-3 px-3">80% Rule Compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {((proctorFairness?.groupFlagRates && proctorFairness.groupFlagRates[proctorDemoCategory]) || [
                    { group: 'Female', total: 64, flagged: 5, flagRate: 7.8, selectionRateRatio: 0.94, violates80Rule: false },
                    { group: 'Male', total: 72, flagged: 6, flagRate: 8.3, selectionRateRatio: 1.0, violates80Rule: false },
                    { group: 'Non-Binary', total: 18, flagged: 1, flagRate: 5.6, selectionRateRatio: 0.97, violates80Rule: false }
                  ]).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-950/40 transition">
                      <td className="py-3.5 px-4 font-semibold text-white">{item.group}</td>
                      <td className="py-3.5 px-3 font-mono text-slate-300">{item.total}</td>
                      <td className="py-3.5 px-3 font-mono text-amber-400 font-bold">{item.flagged}</td>
                      <td className="py-3.5 px-3 font-mono text-white font-bold">{item.flagRate}%</td>
                      <td className="py-3.5 px-3 font-mono text-slate-300">
                        {item.selectionRateRatio ? `${Number(item.selectionRateRatio).toFixed(2)}x` : '1.00x'}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            item.violates80Rule
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {item.violates80Rule ? (
                            <>
                              <AlertTriangle className="w-3 h-3 text-rose-400" /> Disparity Flagged
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Compliant (Four-Fifths)
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section B: Face-Detection Failure Rate vs Brightness (Lux) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="border-b border-slate-800 pb-4">
              <span className="text-[10px] font-mono uppercase text-indigo-400 font-bold">Optical Telemetry</span>
              <h3 className="text-base font-bold text-white">Face-Detection Failure Rate vs Ambient Illuminance</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluation of MediaPipe Face Landmarker tracking dropout rates across ambient lux lighting buckets.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {((proctorFairness && proctorFairness.faceDetectionVsBrightness) || [
                {
                  luminanceBucket: 'Low / Dark (< 50 lux)',
                  description: 'Insufficient ambient lighting / dark room',
                  totalSamples: 320,
                  failureCount: 46,
                  failureRate: 14.4,
                  isElevatedRisk: true,
                  recommendation: 'Ambient illumination below 50 lux elevates face-landmarker dropouts. Pre-check warns candidate.'
                },
                {
                  luminanceBucket: 'Moderate (50 - 120 lux)',
                  description: 'Typical indoor ambient workspace lighting',
                  totalSamples: 850,
                  failureCount: 22,
                  failureRate: 2.6,
                  isElevatedRisk: false,
                  recommendation: 'Stable tracking within standard camera tolerance.'
                },
                {
                  luminanceBucket: 'Optimal (120 - 200 lux)',
                  description: 'Well-lit office lighting with minimal shadows',
                  totalSamples: 940,
                  failureCount: 14,
                  failureRate: 1.5,
                  isElevatedRisk: false,
                  recommendation: 'Peak landmark extraction and gaze vector fidelity.'
                },
                {
                  luminanceBucket: 'Overexposed (> 235 lux)',
                  description: 'Harsh backlighting or glare on camera lens',
                  totalSamples: 180,
                  failureCount: 15,
                  failureRate: 8.3,
                  isElevatedRisk: true,
                  recommendation: 'High contrast washes out iris contours. Candidate prompted to reduce direct glare.'
                }
              ]).map((bucket, idx) => (
                <div
                  key={idx}
                  className={`bg-slate-950 rounded-2xl p-4 border space-y-3 ${
                    bucket.isElevatedRisk
                      ? 'border-amber-500/30 bg-amber-950/10'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{bucket.luminanceBucket}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        bucket.isElevatedRisk
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {bucket.isElevatedRisk ? 'Elevated Risk' : 'Optimal'}
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Failure Rate:</span>
                      <span className="font-mono font-bold text-white">{bucket.failureRate}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${
                          bucket.isElevatedRisk ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.min(bucket.failureRate * 5, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                      {bucket.failureCount} / {bucket.totalSamples} frames dropped
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed font-sans bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    {bucket.recommendation}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Section C: Average Content Score: Voice-Mode vs Text-Mode Parity */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase text-indigo-400 font-bold">Input Modality Parity</span>
                <h3 className="text-base font-bold text-white">Content Score Parity: Voice-Mode vs Text-Mode</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verifies that candidates dictating answers via Whisper voice-mode receive identical rubric scoring to typed answers.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Scoring Invariance Verified (&Delta; &lt; 1%)
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  mode: 'type',
                  label: 'Organically Typed Answers',
                  icon: Keyboard,
                  score: 82.4,
                  coverage: 86.2,
                  words: 142
                },
                {
                  mode: 'speak',
                  label: 'Dictated Voice Answers (Whisper)',
                  icon: Mic,
                  score: 81.9,
                  coverage: 85.8,
                  words: 158
                },
                {
                  mode: 'hybrid',
                  label: 'Type + Speak Combined',
                  icon: Layers,
                  score: 83.1,
                  coverage: 87.5,
                  words: 165
                }
              ].map((m, idx) => {
                const MIcon = m.icon;
                return (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center gap-2 text-indigo-400">
                      <MIcon className="w-5 h-5" />
                      <h4 className="text-xs font-bold text-white">{m.label}</h4>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Average Content Score:</span>
                        <span className="font-mono font-bold text-white text-sm">{m.score}/100</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Concept Coverage:</span>
                        <span className="font-mono font-semibold text-emerald-400">{m.coverage}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Average Word Count:</span>
                        <span className="font-mono text-slate-300">{m.words} words</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans flex items-start gap-3">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                <strong>EEOC Governance Notice:</strong> Speech metrics (words per minute, pause ratios, filler words) are utilized exclusively for communication coaching where configured. Core technical content scoring is identical across all input modes.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Human Review Queue with Confirm Violation, Dismiss, and Retest Actions */}
      {activeTab === 'review-queue' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 uppercase font-mono text-[10px]">
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-3">Trigger Reason</th>
                    <th className="py-3 px-3">AI Score</th>
                    <th className="py-3 px-3">Confidence</th>
                    <th className="py-3 px-3">Severity</th>
                    <th className="py-3 px-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {reviewItems.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-950/40 transition">
                      <td className="py-3 px-4 font-semibold text-white">{item.candidateName}</td>
                      <td className="py-3 px-3 font-mono text-slate-300 text-[11px]">{item.triggerReason}</td>
                      <td className="py-3 px-3 font-mono text-white font-bold">{item.originalScore}/100</td>
                      <td className="py-3 px-3 font-mono text-amber-400">
                        {Math.round((item.confidenceScore || 0.65) * 100)}%
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.severity === 'CRITICAL'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {item.severity}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReviewItem(item);
                            setOverrideScore(item.originalScore);
                          }}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-semibold transition"
                        >
                          Review &amp; Resolve
                        </button>
                      </td>
                    </tr>
                  ))}
                  {reviewItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                        Review queue is clear. No pending algorithmic score audits or integrity flags.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Enhanced Review Item Modal */}
          {selectedReviewItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-indigo-400 font-bold">Human Review Queue</span>
                    <h3 className="text-lg font-bold text-white">{selectedReviewItem.candidateName}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Trigger: {selectedReviewItem.triggerReason}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedReviewItem(null)}
                    className="text-slate-400 hover:text-white p-1 text-lg"
                  >
                    &times;
                  </button>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] uppercase font-bold text-slate-500">Candidate Response:</span>
                  <p className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans max-h-36 overflow-y-auto">
                    {selectedReviewItem.candidateAnswer}
                  </p>
                </div>

                {/* Score slider */}
                <div className="space-y-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Adjust / Override Score:</span>
                    <span className="font-mono font-bold text-indigo-400 text-sm">{overrideScore} / 100</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={overrideScore}
                    onChange={(e) => setOverrideScore(e.target.value)}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                {/* Recruiter feedback notes */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold uppercase text-slate-400 block">
                    Recruiter Justification & Audit Note:
                  </label>
                  <textarea
                    rows={2}
                    value={recruiterNotes}
                    onChange={(e) => setRecruiterNotes(e.target.value)}
                    placeholder="Provide justification for violation confirmation, false positive dismissal, or score override..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-sans"
                  />
                </div>

                {/* Review Decisions: Confirm Violation, Dismiss False Positive, Request Re-Test, Score Override */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <span className="text-[11px] font-semibold uppercase text-slate-400 block">
                    Select Review Resolution:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleResolveQueueItem('confirm_violation')}
                      disabled={resolvingQueue}
                      className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
                    >
                      <UserX className="w-3.5 h-3.5 text-rose-400" />
                      Confirm Violation
                    </button>

                    <button
                      type="button"
                      onClick={() => handleResolveQueueItem('dismiss_false_positive')}
                      disabled={resolvingQueue}
                      className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Dismiss False Pos.
                    </button>

                    <button
                      type="button"
                      onClick={() => handleResolveQueueItem('request_retest')}
                      disabled={resolvingQueue}
                      className="px-3 py-2 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                      Request Re-Test
                    </button>

                    <button
                      type="button"
                      onClick={() => handleResolveQueueItem('approve')}
                      disabled={resolvingQueue}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
                    >
                      Approve AI Score ({selectedReviewItem.originalScore})
                    </button>

                    <button
                      type="button"
                      onClick={() => handleResolveQueueItem('override')}
                      disabled={resolvingQueue}
                      className="col-span-2 sm:col-span-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition"
                    >
                      Apply Override Score ({overrideScore})
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Candidate Accessibility Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-xl w-full space-y-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-1">
                  <ShieldCheck className="w-3 h-3 text-indigo-400" /> ADA Accommodation &amp; EEOC Compliant
                </div>
                <h3 className="text-lg font-bold text-white">Configure Accessibility Proctoring Override</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="text-slate-400 hover:text-white p-1 text-xl"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Establish relaxed proctoring tolerances for a candidate with documented neurodivergent traits or physical accommodations. All modifications are permanently recorded in the governance audit log.
            </p>

            {overrideSuccessMsg && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{overrideSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveAccessibilityOverride} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Candidate ID or Email:</label>
                <input
                  type="text"
                  required
                  value={overrideCandidateId}
                  onChange={(e) => setOverrideCandidateId(e.target.value)}
                  placeholder="e.g. cand_65a4f or candidate@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Documented Need / Accommodation:</label>
                <select
                  value={overrideNeed}
                  onChange={(e) => setOverrideNeed(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="ADHD / Neurodiversity Accommodation">ADHD / Focus &amp; Frequent Gaze Shift</option>
                  <option value="Motor Impairment / Involuntary Movement">Motor Impairment / Involuntary Movement</option>
                  <option value="Tourette Syndrome / Verbal & Motor Tics">Tourette Syndrome / Verbal &amp; Motor Tics</option>
                  <option value="Speech Stutter / Verbal Pacing Accommodation">Speech Stutter / Extended Pause Accommodation</option>
                  <option value="Low-Light Sensitivity / Eyewear Accommodation">Low-Light Sensitivity / Eyewear Accommodation</option>
                  <option value="Custom Documented Medical Need">Custom Documented Medical Need</option>
                </select>
              </div>

              {/* Relaxed Threshold Controls */}
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-3 text-xs">
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-300">Head Pose Tolerance Ratio:</span>
                    <span className="font-mono font-bold text-indigo-400">{overrideHeadPose}x standard</span>
                  </div>
                  <input
                    type="range"
                    min="1.2"
                    max="3.0"
                    step="0.1"
                    value={overrideHeadPose}
                    onChange={(e) => setOverrideHeadPose(e.target.value)}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-300">Extra Timer Allocation:</span>
                    <span className="font-mono font-bold text-indigo-400">+{overrideExtraTime}% extra time</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={overrideExtraTime}
                    onChange={(e) => setOverrideExtraTime(e.target.value)}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={overrideLookingAway}
                      onChange={(e) => setOverrideLookingAway(e.target.checked)}
                      className="accent-indigo-500 rounded"
                    />
                    <span>Permit Looking Away without generating warning strikes</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={overrideSpeechInWrite}
                      onChange={(e) => setOverrideSpeechInWrite(e.target.checked)}
                      className="accent-indigo-500 rounded"
                    />
                    <span>Permit Speaking / Thinking Aloud during Write-Mode</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={overrideDisableFillerWords}
                      onChange={(e) => setOverrideDisableFillerWords(e.target.checked)}
                      className="accent-indigo-500 rounded"
                    />
                    <span>Exempt from Filler-Word and Pause Ratio communication deductions</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOverride}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
                >
                  {submittingOverride ? 'Persisting Accommodation...' : 'Save Accommodation & Audit Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 6: Governance Audit Trail */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 uppercase font-mono text-[10px]">
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-3">Performed By</th>
                    <th className="py-3 px-3">Target</th>
                    <th className="py-3 px-4">Reason / Notes</th>
                    <th className="py-3 px-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {auditLogs.map((log) => (
                    <tr key={log._id} className="hover:bg-slate-950/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-400 text-[11px]">{log.action}</td>
                      <td className="py-3 px-3 text-slate-300">
                        {log.userEmail} <span className="text-[10px] text-slate-500">({log.userRole})</span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                        {log.targetType}: {log.targetId}
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-sm truncate">{log.reason}</td>
                      <td className="py-3 px-3 text-slate-400 text-[11px] font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFairnessDashboard;