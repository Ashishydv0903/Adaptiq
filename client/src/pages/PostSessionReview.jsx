import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { proctorAPI } from '../services/api';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertOctagon,
  Eye,
  Film,
  Camera,
  Layers,
  ChevronLeft,
  ChevronRight,
  Info,
  Sliders,
  Check,
  User,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Activity
} from 'lucide-react';

export const PostSessionReview = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEventIndex, setSelectedEventIndex] = useState(0);
  const [currentScrubSeconds, setCurrentScrubSeconds] = useState(0);
  const [isPlayingScrub, setIsPlayingScrub] = useState(false);
  const [knownLimitations, setKnownLimitations] = useState([]);
  const [showLimitationsModal, setShowLimitationsModal] = useState(false);
  const [actionNotes, setActionNotes] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [tuningData, setTuningData] = useState(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  const scrubTimerRef = useRef(null);

  // Fetch session review timeline
  useEffect(() => {
    const fetchReviewData = async () => {
      try {
        setLoading(true);
        const res = await proctorAPI.getSessionReviewTimeline(sessionId);
        const data = res.data?.data;
        if (data) {
          setSessionData(data.session);
          setEvents(data.events || []);
          setKnownLimitations(data.knownLimitations || []);

          if (data.events && data.events.length > 0) {
            setSelectedEventIndex(0);
            setCurrentScrubSeconds(data.events[0].offsetSeconds || 0);
          }
        }
      } catch (err) {
        console.warn('Failed to load session review timeline:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReviewData();
  }, [sessionId]);

  // Fetch false positive tuning metrics for threshold tuning indicator
  useEffect(() => {
    const fetchTuning = async () => {
      try {
        const res = await proctorAPI.getTuningMetrics();
        if (res.data?.data) {
          setTuningData(res.data.data);
        }
      } catch (err) {}
    };
    fetchTuning();
  }, []);

  const totalDuration = sessionData?.totalDurationSeconds || 3600;
  const currentEvent = events[selectedEventIndex] || null;

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Scrub slider change
  const handleSliderChange = (e) => {
    const newSecs = Number(e.target.value);
    setCurrentScrubSeconds(newSecs);

    // Find nearest event
    if (events.length > 0) {
      let closestIdx = 0;
      let minDiff = Infinity;
      events.forEach((ev, idx) => {
        const diff = Math.abs(ev.offsetSeconds - newSecs);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });
      setSelectedEventIndex(closestIdx);
    }
  };

  // Jump to specific event
  const handleJumpToEvent = (idx) => {
    setSelectedEventIndex(idx);
    if (events[idx]) {
      setCurrentScrubSeconds(events[idx].offsetSeconds);
    }
  };

  // Play / Pause timeline scrub auto-advance
  useEffect(() => {
    if (isPlayingScrub) {
      scrubTimerRef.current = setInterval(() => {
        setCurrentScrubSeconds((prev) => {
          if (prev >= totalDuration) {
            setIsPlayingScrub(false);
            return totalDuration;
          }
          return prev + 1;
        });
      }, 500);
    } else {
      if (scrubTimerRef.current) clearInterval(scrubTimerRef.current);
    }

    return () => {
      if (scrubTimerRef.current) clearInterval(scrubTimerRef.current);
    };
  }, [isPlayingScrub, totalDuration]);

  // Handle Review Decisions: 'confirm_violation' | 'dismiss_false_positive' | 'request_retest'
  const handleReviewAction = async (actionType) => {
    if (!currentEvent) return;
    setIsSubmittingAction(true);
    setActionSuccessMsg('');

    try {
      const res = await proctorAPI.submitReviewAction(sessionId, {
        action: actionType,
        alertId: currentEvent.alertId || currentEvent.id,
        eventId: currentEvent.id,
        notes: actionNotes
      });

      const updated = res.data?.data;

      // Update current event review label in state
      setEvents((prev) =>
        prev.map((ev, idx) => {
          if (idx === selectedEventIndex) {
            return {
              ...ev,
              reviewLabel: actionType === 'confirm_violation' ? 'confirmed' : 'dismissed',
              isFalsePositive: actionType === 'dismiss_false_positive'
            };
          }
          return ev;
        })
      );

      // Update session integrity score if changed
      if (updated?.integrityScore !== undefined && sessionData) {
        setSessionData((prev) => ({
          ...prev,
          integrityScore: updated.integrityScore,
          integrityStatus: updated.integrityStatus
        }));
      }

      setActionSuccessMsg(
        actionType === 'confirm_violation'
          ? 'Violation confirmed. Session flagged in review queue.'
          : actionType === 'dismiss_false_positive'
          ? 'Dismissed as false positive. Candidate integrity score recalculated.'
          : 'Re-test requested. Candidate flagged for retake.'
      );
      setActionNotes('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit review decision');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Match false positive metric for the selected event
  const currentEventTuning = tuningData?.events?.find(
    (e) => e.type.toUpperCase() === currentEvent?.type?.toUpperCase()
  );

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center text-slate-300">
        <div className="w-8 h-8 border-2 border-[#52D68A] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-mono">Loading post-session proctoring timeline and evidence clips...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/recruiter/dashboard')}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 mb-2 transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Recruiter Dashboard
          </button>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">Post-Session Proctoring Review</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                sessionData?.integrityStatus === 'RED'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : sessionData?.integrityStatus === 'ORANGE'
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                  : 'bg-[#52D68A]/20 text-[#52D68A] border border-[#52D68A]/40'
              }`}
            >
              {sessionData?.integrityStatus} ({sessionData?.integrityScore}/100)
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Candidate: <strong className="text-white">{sessionData?.candidate?.name || sessionData?.candidateName}</strong> (
            <span className="font-mono text-slate-400">{sessionData?.candidate?.email || sessionData?.candidateEmail}</span>) • Track:{' '}
            <span className="capitalize text-slate-200">{sessionData?.track}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowLimitationsModal(true)}
            className="px-3.5 py-2 bg-[#0F2238] hover:bg-[#1B3A60] border border-[#1B3A60] rounded-xl text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition"
          >
            <Info className="w-4 h-4 text-[#52D68A]" /> Known Limitations
          </button>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Interactive Timeline Slider with Event Markers */}
      <div className="bg-[#0F2238] border border-[#1B3A60] rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#52D68A]" />
            <h3 className="font-bold text-white text-sm">Session Duration & Infraction Timeline</h3>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
            <span>
              Scrub: <strong className="text-white">{formatTime(currentScrubSeconds)}</strong> / {formatTime(totalDuration)}
            </span>
            <button
              onClick={() => setIsPlayingScrub(!isPlayingScrub)}
              className="p-1.5 bg-[#0B192C] hover:bg-[#132A46] border border-[#1B3A60] rounded-lg text-slate-200 transition"
              title={isPlayingScrub ? 'Pause playback' : 'Play timeline scrub'}
            >
              {isPlayingScrub ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Timeline Track with Marker Pins */}
        <div className="relative pt-6 pb-2">
          {/* Event Pins floating above the slider */}
          <div className="relative h-6 w-full mb-1">
            {events.map((ev, idx) => {
              const leftPercent = Math.min(100, Math.max(0, (ev.offsetSeconds / totalDuration) * 100));
              const isSelected = idx === selectedEventIndex;

              return (
                <button
                  key={ev.id || idx}
                  type="button"
                  onClick={() => handleJumpToEvent(idx)}
                  style={{ left: `${leftPercent}%` }}
                  title={`${ev.type} (${formatTime(ev.offsetSeconds)})`}
                  className={`absolute -translate-x-1/2 -top-1 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                    isSelected
                      ? 'scale-125 z-20 ring-2 ring-white shadow-lg'
                      : 'opacity-85 hover:scale-110 z-10'
                  } ${
                    ev.severity === 'red'
                      ? 'bg-rose-500 text-white'
                      : ev.severity === 'orange'
                      ? 'bg-orange-500 text-white'
                      : 'bg-amber-400 text-[#0B192C]'
                  }`}
                >
                  <span className="text-[9px] font-black">{idx + 1}</span>
                </button>
              );
            })}
          </div>

          {/* Scrub Slider Input */}
          <input
            type="range"
            min={0}
            max={totalDuration}
            value={currentScrubSeconds}
            onChange={handleSliderChange}
            className="w-full accent-[#52D68A] h-2 bg-[#0B192C] rounded-lg cursor-pointer"
          />

          <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-2">
            <span>0:00 (Interview Start)</span>
            <span>{formatTime(totalDuration)} (Conclusion)</span>
          </div>
        </div>

        {/* Event Quick Chips Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] text-slate-400 font-semibold uppercase flex-shrink-0">Events ({events.length}):</span>
          {events.map((ev, idx) => (
            <button
              key={ev.id || idx}
              onClick={() => handleJumpToEvent(idx)}
              className={`px-2.5 py-1 rounded-xl font-mono text-[11px] flex-shrink-0 flex items-center gap-1.5 transition ${
                selectedEventIndex === idx
                  ? 'bg-white text-[#0B192C] font-bold shadow-md'
                  : 'bg-[#0B192C] text-slate-300 hover:text-white border border-[#1B3A60]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  ev.severity === 'red'
                    ? 'bg-rose-500'
                    : ev.severity === 'orange'
                    ? 'bg-orange-500'
                    : 'bg-amber-400'
                }`}
              />
              <span>#{idx + 1} {ev.type}</span>
              <span className="text-[9px] opacity-75">({formatTime(ev.offsetSeconds)})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Review Workbench: Event Media Inspection & Reviewer Controls */}
      {currentEvent ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Visual Media (Video Clip or High-Res Snapshot) */}
          <div className="lg:col-span-7 bg-[#0F2238] border border-[#1B3A60] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-[#52D68A]" />
                <h3 className="font-bold text-white text-sm">
                  Infraction Media Evidence (#{selectedEventIndex + 1})
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Timestamp: {new Date(currentEvent.timestamp).toLocaleTimeString()}
              </span>
            </div>

            {/* Video Player or Snapshot */}
            <div className="relative aspect-video w-full bg-black rounded-xl overflow-hidden border border-[#1B3A60] flex items-center justify-center">
              {currentEvent.downloadUrl ? (
                <video
                  key={currentEvent.downloadUrl}
                  controls
                  playsInline
                  poster={currentEvent.snapshot}
                  className="w-full h-full object-contain"
                >
                  <source src={currentEvent.downloadUrl} type="video/webm" />
                  Your browser does not support the video tag.
                </video>
              ) : currentEvent.snapshot ? (
                <img
                  src={currentEvent.snapshot}
                  alt="Infraction Snapshot"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center text-slate-400 space-y-1">
                  <Camera className="w-8 h-8 mx-auto opacity-50" />
                  <p className="text-xs">No media buffer captured for this event.</p>
                </div>
              )}
            </div>

            {/* Event Description & Message */}
            <div className="p-3.5 bg-[#0B192C] border border-[#1B3A60] rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm">{currentEvent.type}</span>
                <span className="text-[10px] font-mono text-[#52D68A] bg-[#52D68A]/10 px-2 py-0.5 rounded border border-[#52D68A]/20">
                  {Math.round(currentEvent.confidence * 100)}% Confidence
                </span>
              </div>
              <p className="text-slate-300">{currentEvent.message}</p>
              {currentEvent.isEscalated && (
                <div className="text-[11px] text-rose-300 font-semibold bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                  ⚠️ Escalated: {currentEvent.escalationReason}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Human Review Actions & Threshold Tuning Info */}
          <div className="lg:col-span-5 space-y-5">
            {/* Review Decision Card */}
            <div className="bg-[#0F2238] border border-[#1B3A60] rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-sm">Human Review Disposition</h3>
                {currentEvent.reviewLabel ? (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      currentEvent.reviewLabel === 'confirmed'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    Labeled: {currentEvent.reviewLabel}
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-300 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Pending Decision
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Reviewer Notes / Rationalization:
                </label>
                <textarea
                  rows={3}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Document context (e.g. ambient lighting shadow, candidate was looking at paper notes, deliberate secondary phone use)..."
                  className="w-full bg-[#071322] border border-[#1B3A60] rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#52D68A]"
                />
              </div>

              {/* Three Mandatory Action Buttons */}
              <div className="space-y-2 pt-1">
                {/* 1. Confirm Violation */}
                <button
                  onClick={() => handleReviewAction('confirm_violation')}
                  disabled={isSubmittingAction}
                  className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Confirm Violation (Sustained Infraction)</span>
                </button>

                {/* 2. Dismiss as False Positive */}
                <button
                  onClick={() => handleReviewAction('dismiss_false_positive')}
                  disabled={isSubmittingAction}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Dismiss as False Positive (Recalculate Score)</span>
                </button>

                {/* 3. Request Re-Test */}
                <button
                  onClick={() => handleReviewAction('request_retest')}
                  disabled={isSubmittingAction}
                  className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-[#0B192C] font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Request Candidate Re-Test (Inconclusive)</span>
                </button>
              </div>
            </div>

            {/* Threshold Tuning Insight Card */}
            {currentEventTuning && (
              <div className="bg-[#0F2238] border border-[#1B3A60] rounded-2xl p-5 shadow-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-sky-400" />
                    <h4 className="font-bold text-white text-xs">Event Threshold Tuning Metric</h4>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    FPR: <strong className="text-white">{currentEventTuning.falsePositiveRate}%</strong>
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {currentEventTuning.recommendation}
                </p>

                <div className="pt-2 border-t border-[#1B3A60] flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>Occurrences: {currentEventTuning.totalOccurrences}</span>
                  <span>Confirmed: {currentEventTuning.confirmedViolations}</span>
                  <span>Dismissed: {currentEventTuning.dismissedFalsePositives}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-[#0F2238] border border-[#1B3A60] rounded-2xl p-12 text-center text-slate-400 space-y-2">
          <ShieldCheck className="w-10 h-10 text-[#52D68A] mx-auto opacity-70" />
          <h4 className="text-white font-bold text-sm">Clean Session: Zero Proctoring Infractions</h4>
          <p className="text-xs">No Orange or Red infractions occurred during this candidate assessment.</p>
        </div>
      )}

      {/* Known Limitations Modal */}
      {showLimitationsModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#0F2238] border border-[#1B3A60] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#1B3A60]">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-[#52D68A]" />
                <h3 className="font-bold text-white text-base">
                  AI Proctoring & Biometrics: Known Limitations
                </h3>
              </div>
              <button
                onClick={() => setShowLimitationsModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              {knownLimitations.map((item, i) => (
                <div key={i} className="p-3.5 bg-[#071322] border border-[#1B3A60] rounded-xl space-y-1">
                  <h4 className="font-bold text-white text-xs">{item.title}</h4>
                  <p>{item.description}</p>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowLimitationsModal(false)}
                className="px-4 py-2 bg-[#0B192C] hover:bg-[#132A46] text-slate-200 text-xs font-semibold rounded-xl border border-[#1B3A60]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostSessionReview;
