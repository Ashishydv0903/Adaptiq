import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { proctorAPI } from '../../services/api';
import SimplePeer from '../../services/simplePeer';
import {
  ShieldAlert,
  ShieldCheck,
  Video,
  VideoOff,
  AlertTriangle,
  AlertOctagon,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  XCircle,
  FileText,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  User,
  ExternalLink,
  ChevronRight,
  Maximize2,
  Send,
  MessageSquare,
  Sparkles,
  Download,
  Flame,
  Check,
  Sliders
} from 'lucide-react';
import ProctorDemoControls from '../interview/ProctorDemoControls';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://127.0.0.1:5000';

/**
 * Synthesizes an emergency chime sound using Web Audio API for Red Alerts
 */
function playRedAlertChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3); // A5

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.65);
  } catch (e) {
    // Audio synthesis fallback
  }
}

export const RecruiterLiveMonitor = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL'|'RED'|'ORANGE'|'YELLOW'|'GREEN'
  const [searchQuery, setSearchQuery] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Live Alerts Feed
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [criticalRedBanner, setCriticalRedBanner] = useState(null);

  // WebRTC Live Video Stream State
  const [activeVideoStream, setActiveVideoStream] = useState(null);
  const [streamingSessionId, setStreamingSessionId] = useState(null);
  const [isConnectingWebRTC, setIsConnectingWebRTC] = useState(false);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const socketRef = useRef(null);

  // Action Modals State
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: null, // 'warning' | 'pause' | 'terminate' | 'add_note'
    sessionId: null,
    candidateName: '',
    message: '',
    reason: ''
  });

  // Snapshot Inspection Modal
  const [inspectSnapshot, setInspectSnapshot] = useState(null);

  // Audit Trail Drawer State
  const [auditDrawer, setAuditDrawer] = useState({
    isOpen: false,
    sessionId: null,
    candidateName: '',
    logs: [],
    loading: false
  });

  // Fetch active sessions from backend
  const fetchActiveSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await proctorAPI.getActiveSessions();
      if (res.data?.data?.sessions) {
        setSessions(res.data.data.sessions);
      }
    } catch (err) {
      console.warn('Failed to load active proctoring sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveSessions();
    const interval = setInterval(fetchActiveSessions, 15000); // Polling backup
    return () => clearInterval(interval);
  }, [fetchActiveSessions]);

  // Initialize Socket.io connection for recruiter monitor
  useEffect(() => {
    const token = localStorage.getItem('adaptiq_access_token') || localStorage.getItem('token');
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: { token }
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_recruiter_monitor');
    });

    // Listen to real-time proctor alerts (proctor:alert)
    socket.on('proctor:alert', (alert) => {
      setLiveAlerts((prev) => [alert, ...prev.slice(0, 49)]);

      // If RED alert: Play sound & trigger critical alert banner
      if (alert.severity === 'red' || alert.integrityStatus === 'RED') {
        if (soundEnabled) {
          playRedAlertChime();
        }
        setCriticalRedBanner(alert);
      }

      // Update matching session in state
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === alert.sessionId || String(s.id) === String(alert.sessionId)) {
            const currentEvents = s.recentEvents || [];
            return {
              ...s,
              integrityScore: alert.integrityScore ?? s.integrityScore,
              integrityStatus: alert.integrityStatus || s.integrityStatus,
              alerts: {
                ...s.alerts,
                total: (s.alerts?.total || 0) + 1,
                red: alert.severity === 'red' ? (s.alerts?.red || 0) + 1 : (s.alerts?.red || 0),
                orange: alert.severity === 'orange' ? (s.alerts?.orange || 0) + 1 : (s.alerts?.orange || 0),
                yellow: alert.severity === 'yellow' ? (s.alerts?.yellow || 0) + 1 : (s.alerts?.yellow || 0)
              },
              recentEvents: [alert, ...currentEvents.slice(0, 4)]
            };
          }
          return s;
        })
      );
    });

    // Listen to proctor status updates (e.g. false positive resets)
    socket.on('proctor:status_updated', (update) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === update.sessionId || String(s.id) === String(update.sessionId)) {
            return {
              ...s,
              integrityScore: update.integrityScore,
              integrityStatus: update.integrityStatus
            };
          }
          return s;
        })
      );
    });

    // Listen to WebRTC signals from candidate
    socket.on('webrtc:signal', ({ signal, sessionId: sigSessionId }) => {
      if (peerRef.current && sigSessionId === streamingSessionId) {
        peerRef.current.signal(signal);
      }
    });

    return () => {
      socket.disconnect();
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, [soundEnabled, streamingSessionId]);

  // Connect WebRTC live video feed using SimplePeer
  const handleConnectLiveVideo = (session) => {
    if (streamingSessionId === session.id && activeVideoStream) {
      // Disconnect if already active
      handleDisconnectLiveVideo();
      return;
    }

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    setIsConnectingWebRTC(true);
    setStreamingSessionId(session.id);
    setActiveVideoStream(null);

    const socket = socketRef.current;
    if (!socket) return;

    // Create initiator peer
    const peer = new SimplePeer({
      initiator: true,
      trickle: true
    });
    peerRef.current = peer;

    peer.on('signal', (signal) => {
      socket.emit('webrtc:signal', {
        sessionId: session.id,
        signal
      });
    });

    peer.on('stream', (remoteStream) => {
      setActiveVideoStream(remoteStream);
      setIsConnectingWebRTC(false);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });

    peer.on('error', (err) => {
      console.warn('Recruiter WebRTC error:', err);
      setIsConnectingWebRTC(false);
    });

    peer.on('close', () => {
      setActiveVideoStream(null);
      setIsConnectingWebRTC(false);
    });

    // Request stream from candidate via socket
    socket.emit('webrtc:request_feed', { sessionId: session.id });
  };

  const handleDisconnectLiveVideo = () => {
    if (socketRef.current && streamingSessionId) {
      socketRef.current.emit('webrtc:stop_feed', { sessionId: streamingSessionId });
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setActiveVideoStream(null);
    setStreamingSessionId(null);
    setIsConnectingWebRTC(false);
  };

  // Attach active video stream to video DOM element
  useEffect(() => {
    if (remoteVideoRef.current && activeVideoStream) {
      remoteVideoRef.current.srcObject = activeVideoStream;
    }
  }, [activeVideoStream]);

  // Execute Recruiter Action (warning, pause, resume, terminate, false positive, note)
  const handleExecuteAction = async () => {
    const { type, sessionId, message, reason } = actionModal;
    if (!sessionId || !type) return;

    try {
      await proctorAPI.executeSessionAction(sessionId, {
        action: type,
        message,
        reason
      });

      // Update local state
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === sessionId || String(s.id) === String(sessionId)) {
            if (type === 'pause') return { ...s, status: 'paused' };
            if (type === 'resume') return { ...s, status: 'in_progress' };
            if (type === 'terminate') return { ...s, status: 'terminated' };
          }
          return s;
        })
      );

      setActionModal({ isOpen: false, type: null, sessionId: null, candidateName: '', message: '', reason: '' });
      fetchActiveSessions();
    } catch (err) {
      alert(err.response?.data?.message || `Failed to execute action ${type}`);
    }
  };

  // Mark an alert as False Positive
  const handleMarkFalsePositive = async (sessionId, alertId) => {
    if (!window.confirm('Mark this alert as a false positive? The candidate integrity score will be recalculated.')) {
      return;
    }

    try {
      await proctorAPI.executeSessionAction(sessionId, {
        action: 'mark_false_positive',
        alertId
      });

      // Remove alert from live feed view
      setLiveAlerts((prev) =>
        prev.map((a) => (a.alertId === alertId ? { ...a, isFalsePositive: true } : a))
      );

      fetchActiveSessions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to mark false positive');
    }
  };

  // Open Audit Trail Drawer
  const handleOpenAuditDrawer = async (session) => {
    setAuditDrawer({
      isOpen: true,
      sessionId: session.id,
      candidateName: session.candidateName,
      logs: [],
      loading: true
    });

    try {
      const res = await proctorAPI.getSessionAuditLogs(session.id);
      setAuditDrawer((prev) => ({
        ...prev,
        logs: res.data?.data?.logs || [],
        loading: false
      }));
    } catch (err) {
      console.warn('Failed to load audit logs:', err);
      setAuditDrawer((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleInjectDemoAlert = (eventType) => {
    const selectedSession = sessions.find((s) => s.id === selectedSessionId);
    const targetSession = selectedSession || sessions[0] || { id: 'demo_session_1', candidateName: 'Alan Turing' };
    const alert = {
      sessionId: targetSession.id,
      candidateName: targetSession.candidateName || 'Alan Turing',
      severity: 'red',
      integrityStatus: 'RED',
      type: eventType === 'phone' ? 'cell_phone_detected' : eventType === 'second_face' ? 'multiple_faces' : 'identity_mismatch',
      message: eventType === 'phone' ? 'Prohibited object (cell phone) detected in viewport.' : eventType === 'second_face' ? 'Multiple faces detected in camera viewport.' : 'Face descriptor mismatch with verified enrolled template.',
      timestamp: new Date().toISOString(),
      integrityScore: 45
    };
    setLiveAlerts((prev) => [alert, ...prev.slice(0, 49)]);
    if (soundEnabled) {
      playRedAlertChime();
    }
    setCriticalRedBanner(alert);
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === alert.sessionId) {
          return {
            ...s,
            integrityScore: 45,
            integrityStatus: 'RED',
            alerts: { ...s.alerts, total: (s.alerts?.total || 0) + 1, red: (s.alerts?.red || 0) + 1 }
          };
        }
        return s;
      })
    );
  };

  // Filter sessions
  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      (s.candidateName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.candidateEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.track || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || s.integrityStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Controls Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#0F2238] border border-[#1B3A60] p-4 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-[#52D68A] animate-pulse" />
            <h2 className="text-xl font-bold text-white tracking-tight">Recruiter Live Proctoring Monitor</h2>
            <span className="text-[11px] font-mono text-[#52D68A] bg-[#52D68A]/10 px-2 py-0.5 rounded-full border border-[#52D68A]/30">
              Socket.io Live Feed
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Real-time biometric proctoring surveillance, automated escalation enforcement, and direct remote session intervention.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition ${
              soundEnabled
                ? 'bg-[#52D68A]/10 border-[#52D68A]/40 text-[#52D68A]'
                : 'bg-[#0B192C] border-[#1B3A60] text-slate-400 hover:text-slate-200'
            }`}
            title={soundEnabled ? 'Red Alert Audio Chime Enabled' : 'Mute Red Alert Audio'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Alert Chime On' : 'Chime Muted'}</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchActiveSessions}
            disabled={loading}
            className="p-2.5 bg-[#0B192C] hover:bg-[#132A46] border border-[#1B3A60] rounded-xl text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#52D68A]' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Critical Red Alert Banner */}
      {criticalRedBanner && (
        <div className="bg-rose-500/15 border-2 border-rose-500 rounded-2xl p-4 text-rose-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center flex-shrink-0 text-rose-400">
              <AlertOctagon className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider bg-rose-500 text-white px-2 py-0.5 rounded">
                  RED ALERT ESCALATION
                </span>
                <span className="text-xs text-rose-300 font-mono">
                  {new Date(criticalRedBanner.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <h4 className="font-bold text-white text-sm mt-1">
                Candidate Flagged: {criticalRedBanner.type} ({criticalRedBanner.message})
              </h4>
              <p className="text-xs text-rose-200/90 mt-0.5">
                Session: <span className="font-mono text-white">{criticalRedBanner.sessionId}</span> • Integrity Score:{' '}
                <strong className="text-rose-300">{criticalRedBanner.integrityScore}</strong> (Status: RED)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            <button
              onClick={() => {
                const target = sessions.find((s) => s.id === criticalRedBanner.sessionId);
                if (target) handleConnectLiveVideo(target);
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 transition"
            >
              <Video className="w-3.5 h-3.5" /> View Live Stream
            </button>
            <button
              onClick={() => setCriticalRedBanner(null)}
              className="px-2.5 py-1.5 bg-[#0F2238] hover:bg-[#1B3A60] text-rose-300 text-xs rounded-xl border border-rose-500/30 transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Live WebRTC Video Stream Panel (when active) */}
      {streamingSessionId && (
        <div className="bg-[#0F2238] border-2 border-[#52D68A] rounded-2xl p-4 shadow-2xl space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Video className="w-4 h-4 text-[#52D68A]" />
                Candidate Live WebRTC Stream (SimplePeer)
              </h3>
              <span className="text-[10px] font-mono text-[#52D68A] bg-[#52D68A]/10 px-2 py-0.5 rounded border border-[#52D68A]/30">
                Session: {streamingSessionId}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDisconnectLiveVideo}
                className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/40 text-rose-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
              >
                <VideoOff className="w-3.5 h-3.5" /> Disconnect Stream
              </button>
            </div>
          </div>

          <div className="relative aspect-video max-h-96 w-full bg-black rounded-xl overflow-hidden flex items-center justify-center border border-[#1B3A60]">
            {isConnectingWebRTC && !activeVideoStream && (
              <div className="flex flex-col items-center gap-3 text-slate-300">
                <div className="w-8 h-8 border-2 border-[#52D68A] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono">Negotiating WebRTC PeerConnection with candidate client...</span>
              </div>
            )}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-contain ${activeVideoStream ? 'block' : 'hidden'}`}
            />
          </div>
        </div>
      )}

      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate name, email, or track..."
            className="w-full bg-[#0F2238] border border-[#1B3A60] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#52D68A]"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-[#0F2238] border border-[#1B3A60] p-1 rounded-xl text-xs font-semibold">
          {['ALL', 'RED', 'ORANGE', 'YELLOW', 'GREEN'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === status
                  ? status === 'RED'
                    ? 'bg-rose-500 text-white font-bold'
                    : status === 'ORANGE'
                    ? 'bg-orange-500 text-white font-bold'
                    : status === 'YELLOW'
                    ? 'bg-amber-500 text-[#0B192C] font-bold'
                    : status === 'GREEN'
                    ? 'bg-[#52D68A] text-[#0B192C] font-bold'
                    : 'bg-[#1B3A60] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Active Candidate Sessions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredSessions.map((session) => {
          const status = session.integrityStatus || 'GREEN';
          const isRed = status === 'RED';
          const isOrange = status === 'ORANGE';
          const isYellow = status === 'YELLOW';

          return (
            <div
              key={session.id}
              className={`bg-[#0F2238] border rounded-2xl p-5 shadow-xl flex flex-col justify-between transition-all hover:border-[#52D68A]/60 ${
                isRed
                  ? 'border-rose-500/80 ring-1 ring-rose-500/40 bg-[#161224]'
                  : isOrange
                  ? 'border-orange-500/60'
                  : isYellow
                  ? 'border-amber-500/40'
                  : 'border-[#1B3A60]'
              }`}
            >
              {/* Card Header: Candidate Info & Status Chip */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-[#0B192C] border border-[#1B3A60] flex items-center justify-center text-slate-200 font-bold text-sm">
                      {session.candidateName?.charAt(0) || 'C'}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm tracking-tight">{session.candidateName}</h4>
                      <p className="text-[11px] text-slate-300 font-mono truncate max-w-[150px]">
                        {session.candidateEmail}
                      </p>
                    </div>
                  </div>

                  {/* Integrity Status Chip */}
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                        isRed
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : isOrange
                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                          : isYellow
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-[#52D68A]/20 text-[#52D68A] border border-[#52D68A]/40'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isRed
                            ? 'bg-rose-400 animate-ping'
                            : isOrange
                            ? 'bg-orange-400'
                            : isYellow
                            ? 'bg-amber-400'
                            : 'bg-[#52D68A]'
                        }`}
                      />
                      {status} ({session.integrityScore ?? 100})
                    </span>

                    {/* onRed Policy Chip */}
                    <span className="text-[9px] font-mono text-slate-400">
                      onRed: <strong className="text-white">{session.onRedPolicy || 'pause'}</strong>
                    </span>
                  </div>
                </div>

                {/* Session Track & Progression */}
                <div className="mt-4 pt-3 border-t border-[#1B3A60] grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400">Track</span>
                    <div className="font-medium text-slate-200 capitalize truncate">{session.track}</div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400">Progress</span>
                    <div className="font-medium text-slate-200">
                      Q{session.currentQuestionIndex + 1} / {session.totalQuestions} ({session.currentRound})
                    </div>
                  </div>
                </div>

                {/* Alert Badges Summary */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Infractions:</span>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono">
                    <span className="text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                      {session.alerts?.red || 0} Red
                    </span>
                    <span className="text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">
                      {session.alerts?.orange || 0} Orange
                    </span>
                    <span className="text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      {session.alerts?.yellow || 0} Yellow
                    </span>
                  </div>
                </div>

                {/* Recent Event Snippet */}
                {session.recentEvents && session.recentEvents.length > 0 && (
                  <div className="mt-3 p-2 rounded-xl bg-[#071322] border border-[#1B3A60] text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-semibold text-slate-300">Latest Event:</span>
                      <span className="font-mono text-[10px]">
                        {new Date(session.recentEvents[0].timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-slate-200 font-medium truncate">
                      {session.recentEvents[0].type}: {session.recentEvents[0].message}
                    </div>
                  </div>
                )}
              </div>

              {/* Recruiter Action Buttons */}
              <div className="mt-5 pt-3 border-t border-[#1B3A60] space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {/* WebRTC Video Toggle */}
                  <button
                    onClick={() => handleConnectLiveVideo(session)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      streamingSessionId === session.id
                        ? 'bg-rose-500 text-white'
                        : 'bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C]'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>{streamingSessionId === session.id ? 'Stop Stream' : 'Live Video'}</span>
                  </button>

                  {/* Send Direct Warning */}
                  <button
                    onClick={() =>
                      setActionModal({
                        isOpen: true,
                        type: 'warning',
                        sessionId: session.id,
                        candidateName: session.candidateName,
                        message: 'Proctor Advisory: Please adjust your camera angle to face the screen directly.',
                        reason: ''
                      })
                    }
                    className="py-1.5 px-2 bg-[#0B192C] hover:bg-[#132A46] border border-[#1B3A60] hover:border-amber-400 text-amber-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Warn</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  {/* Pause / Resume */}
                  {session.status === 'paused' ? (
                    <button
                      onClick={() =>
                        setActionModal({
                          isOpen: true,
                          type: 'resume',
                          sessionId: session.id,
                          candidateName: session.candidateName,
                          message: '',
                          reason: 'Integrity review complete. Session resumed.'
                        })
                      }
                      className="py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg flex items-center justify-center gap-1 transition"
                    >
                      <Play className="w-3 h-3" /> Resume
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        setActionModal({
                          isOpen: true,
                          type: 'pause',
                          sessionId: session.id,
                          candidateName: session.candidateName,
                          message: '',
                          reason: 'Session paused by proctor for integrity review.'
                        })
                      }
                      className="py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg flex items-center justify-center gap-1 transition"
                    >
                      <Pause className="w-3 h-3" /> Pause
                    </button>
                  )}

                  {/* Terminate */}
                  <button
                    onClick={() =>
                      setActionModal({
                        isOpen: true,
                        type: 'terminate',
                        sessionId: session.id,
                        candidateName: session.candidateName,
                        message: '',
                        reason: 'Session terminated due to multiple escalated proctoring infractions.'
                      })
                    }
                    className="py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg flex items-center justify-center gap-1 transition"
                  >
                    <XCircle className="w-3 h-3" /> Terminate
                  </button>

                  {/* Audit Trail */}
                  <button
                    onClick={() => handleOpenAuditDrawer(session)}
                    className="py-1 bg-[#0B192C] hover:bg-[#132A46] text-slate-300 border border-[#1B3A60] rounded-lg flex items-center justify-center gap-1 transition"
                  >
                    <FileText className="w-3 h-3" /> Audit
                  </button>

                  {/* Review Timeline */}
                  <button
                    onClick={() => navigate(`/recruiter/review/${session.id}`)}
                    className="col-span-3 py-1 bg-[#132A46] hover:bg-[#1B3A60] text-[#52D68A] border border-[#52D68A]/30 rounded-lg flex items-center justify-center gap-1 font-semibold text-[11px] transition"
                  >
                    <Sliders className="w-3 h-3 text-[#52D68A]" /> Post-Session Review Timeline
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredSessions.length === 0 && !loading && (
        <div className="bg-[#0F2238] border border-[#1B3A60] rounded-2xl p-12 text-center text-slate-400 space-y-2">
          <ShieldCheck className="w-10 h-10 text-[#52D68A] mx-auto opacity-70" />
          <h4 className="text-white font-bold text-sm">No Active Monitored Sessions</h4>
          <p className="text-xs">All candidate sessions match the current filter criteria or have finished.</p>
        </div>
      )}

      {/* Live Alerts Feed Table */}
      <div className="bg-[#0F2238] border border-[#1B3A60] rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#52D68A]" />
            <h3 className="font-bold text-white text-sm">Live Proctor Alert Event Stream</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">{liveAlerts.length} events logged</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B192C] text-slate-400 uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Session</th>
                <th className="py-2.5 px-3">Event Type</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Snapshot / Evidence</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1B3A60] text-slate-300">
              {liveAlerts.slice(0, 15).map((alert, idx) => (
                <tr key={alert.alertId || idx} className="hover:bg-[#071322] transition">
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        alert.severity === 'red'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : alert.severity === 'orange'
                          ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                    {alert.sessionId?.substring(0, 8)}...
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-white">
                    <div className="flex items-center gap-1.5">
                      <span>{alert.type}</span>
                      {(alert.source === 'demo' || alert.metadata?.source === 'demo') && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider uppercase bg-purple-900/60 text-purple-300 border border-purple-500/50">
                          SIMULATED
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 max-w-xs truncate text-slate-300">{alert.message}</td>
                  <td className="py-2.5 px-3">
                    {alert.snapshot ? (
                      <button
                        onClick={() => setInspectSnapshot(alert.snapshot)}
                        className="flex items-center gap-1 text-[11px] text-[#52D68A] hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Frame
                      </button>
                    ) : (
                      <span className="text-slate-500 text-[10px]">No Snapshot</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {alert.isFalsePositive ? (
                      <span className="text-[10px] text-slate-400 italic">False Positive</span>
                    ) : (
                      <button
                        onClick={() => handleMarkFalsePositive(alert.sessionId, alert.alertId)}
                        className="text-[11px] text-sky-400 hover:text-sky-300 hover:underline"
                      >
                        Mark False Positive
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {liveAlerts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    No proctoring infractions recorded during this session monitor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recruiter Action Modal (Warning, Pause, Terminate, Add Note) */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F2238] border border-[#1B3A60] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base capitalize">
                {actionModal.type === 'warning'
                  ? 'Dispatch Warning to Candidate'
                  : actionModal.type === 'pause'
                  ? 'Pause Candidate Assessment'
                  : actionModal.type === 'resume'
                  ? 'Resume Candidate Assessment'
                  : 'Terminate Candidate Assessment'}
              </h3>
              <button
                onClick={() => setActionModal({ isOpen: false, type: null, sessionId: null, candidateName: '', message: '', reason: '' })}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Candidate: <strong className="text-white">{actionModal.candidateName}</strong>
            </p>

            {actionModal.type === 'warning' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Advisory Message (Displayed directly on candidate's screen):
                </label>
                <textarea
                  rows={3}
                  value={actionModal.message}
                  onChange={(e) => setActionModal((prev) => ({ ...prev, message: e.target.value }))}
                  className="w-full bg-[#071322] border border-[#1B3A60] rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#52D68A]"
                  placeholder="Enter specific guidance for candidate..."
                />
              </div>
            )}

            {(actionModal.type === 'pause' || actionModal.type === 'terminate') && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Audit Reason / Justification:
                </label>
                <textarea
                  rows={3}
                  value={actionModal.reason}
                  onChange={(e) => setActionModal((prev) => ({ ...prev, reason: e.target.value }))}
                  className="w-full bg-[#071322] border border-[#1B3A60] rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  placeholder="Enter justification for compliance audit log..."
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setActionModal({ isOpen: false, type: null, sessionId: null, candidateName: '', message: '', reason: '' })}
                className="px-4 py-2 bg-[#0B192C] hover:bg-[#132A46] text-slate-300 text-xs rounded-xl border border-[#1B3A60] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteAction}
                className={`px-4 py-2 text-xs font-bold rounded-xl shadow-lg transition ${
                  actionModal.type === 'terminate'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : actionModal.type === 'pause'
                    ? 'bg-amber-500 hover:bg-amber-400 text-[#0B192C]'
                    : 'bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C]'
                }`}
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Inspection Modal */}
      {inspectSnapshot && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#0F2238] border border-[#1B3A60] rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white text-sm">Proctor Event Frame Snapshot</h4>
              <button onClick={() => setInspectSnapshot(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border border-[#1B3A60] bg-black">
              <img src={inspectSnapshot} alt="Proctor Snapshot" className="w-full h-auto object-contain max-h-[70vh]" />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setInspectSnapshot(null)}
                className="px-4 py-1.5 bg-[#0B192C] hover:bg-[#132A46] text-slate-300 text-xs rounded-xl border border-[#1B3A60]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail Drawer Modal */}
      {auditDrawer.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-end">
          <div className="bg-[#0F2238] border-l border-[#1B3A60] w-full max-w-lg h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#1B3A60]">
                <div>
                  <h3 className="font-bold text-white text-base">Session Audit Trail</h3>
                  <p className="text-xs text-slate-300">
                    Candidate: <strong className="text-white">{auditDrawer.candidateName}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setAuditDrawer({ isOpen: false, sessionId: null, candidateName: '', logs: [], loading: false })}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {auditDrawer.loading ? (
                <div className="text-center py-12 text-slate-400 text-xs">Loading audit trail...</div>
              ) : (
                <div className="space-y-3">
                  {auditDrawer.logs.map((log, i) => (
                    <div key={log._id || i} className="p-3 bg-[#071322] border border-[#1B3A60] rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-[#52D68A] uppercase font-bold">{log.action}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-200">{log.reason}</p>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Actor: {log.userEmail} ({log.userRole})
                      </div>
                    </div>
                  ))}
                  {auditDrawer.logs.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      No audit log records for this session yet.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#1B3A60] flex justify-end">
              <button
                onClick={() => setAuditDrawer({ isOpen: false, sessionId: null, candidateName: '', logs: [], loading: false })}
                className="px-4 py-2 bg-[#0B192C] hover:bg-[#132A46] text-slate-300 text-xs rounded-xl border border-[#1B3A60]"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Viva / Demo Proctor Event Injector */}
      <ProctorDemoControls onInjectEvent={handleInjectDemoAlert} />
    </div>
  );
};

export default RecruiterLiveMonitor;
