import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  CameraOff,
  ShieldCheck,
  Activity,
  Eye,
  Maximize2,
  Minimize2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Mic,
  MicOff,
  Users,
  ShieldAlert,
  Shield
} from 'lucide-react';

/**
 * LiveProctoringMonitor
 * Provides continuous webcam presence and AI proctoring feed during interview sessions,
 * with real-time indicators for Tab/Focus status, Face presence, and Integrity metrics.
 */
export const LiveProctoringMonitor = ({
  sessionId,
  integrityWarnings = 0,
  integrityScore = 100,
  trustScore,
  integrityStatus = 'GREEN',
  onCameraStatusChange = () => {},
  videoRef: externalVideoRef,
  faceInFrame = true,
  gazeStatus = 'centered', // 'centered' | 'looking_away' | 'no_face'
  eyeFocusRatio = 95,
  // Enhanced Proctoring & Authentication Props
  focusStatus = 'focused', // 'focused' | 'tab_switched' | 'window_out_of_focus'
  facePresenceStatus = 'face_detected', // 'face_detected' | 'face_missing' | 'multiple_faces'
  tabSwitchCount = 0,
  facePresencePct = 100,
  focusRetentionPct = 100,
  cameraAvailable = true,
  micAvailable = true,
  trustDeductions = []
}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraPermission, setCameraPermission] = useState('prompt'); // 'prompt' | 'granted' | 'denied'
  const [isMinimized, setIsMinimized] = useState(false);
  const [error, setError] = useState('');

  const internalVideoRef = useRef(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const streamRef = useRef(null);

  const displayTrustScore = trustScore !== undefined ? trustScore : integrityScore;

  // Automatically start camera on mount for continuous monitoring
  useEffect(() => {
    // 250ms delay to allow previous unmounted stream to release hardware cleanly
    const timer = setTimeout(() => {
      startCamera();
    }, 250);

    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Your browser does not support webcam capture.');
        setCameraPermission('denied');
        onCameraStatusChange(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsStreaming(true);
      setCameraPermission('granted');
      onCameraStatusChange(true);
    } catch (err) {
      console.warn('Webcam stream error:', err.name, err.message);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission was blocked. Please allow camera access in your browser address bar.');
        setCameraPermission('denied');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No webcam detected on this device. Screen & audio focus monitoring remains active.');
        setCameraPermission('denied');
      } else {
        setError('Unable to initialize webcam for monitoring.');
        setCameraPermission('denied');
      }
      setIsStreaming(false);
      onCameraStatusChange(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    onCameraStatusChange(false);
  };

  return (
    <div
      className={`bg-[#0F2238] border border-[#1B3A60] rounded-2xl shadow-xl transition-all duration-300 overflow-hidden ${
        isMinimized ? 'p-2.5' : 'p-3.5 space-y-3'
      }`}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isStreaming ? 'bg-[#52D68A] animate-pulse' : 'bg-amber-400'
              }`}
            />
            {isStreaming && (
              <span className="absolute w-4 h-4 rounded-full bg-[#52D68A]/30 animate-ping" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white tracking-tight">
                {isStreaming ? 'Live Proctoring Active' : 'Proctoring Monitor'}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#52D68A] bg-[#52D68A]/10 px-1.5 py-0.5 rounded border border-[#52D68A]/20">
                Continuous
              </span>
            </div>
            {!isMinimized && (
              <p className="text-[11px] text-slate-300">
                Camera feed stays on to monitor interview focus & integrity.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isMinimized && (
            <div className="flex items-center gap-1.5 mr-2">
              {focusStatus === 'tab_switched' ? (
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Tab Switched ⚠️
                </span>
              ) : focusStatus === 'window_out_of_focus' ? (
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Out of Focus ⚠️
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Focused ✅
                </span>
              )}

              {facePresenceStatus === 'multiple_faces' ? (
                <span className="text-[10px] px-2 py-0.5 rounded bg-red-600/30 text-red-300 border border-red-500/40">
                  Multiple Faces 🚨
                </span>
              ) : facePresenceStatus === 'face_missing' || !faceInFrame ? (
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Face Missing ⚠️
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Face Detected ✅
                </span>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-[#1B3A60]/60 transition"
            title={isMinimized ? 'Expand Camera Monitor' : 'Minimize Camera Monitor'}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Live Indicator Badges Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#071322] px-3 py-2 rounded-xl border border-[#1B3A60]">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Focus:</span>
              {focusStatus === 'tab_switched' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                  Tab Switched ⚠️
                </span>
              ) : focusStatus === 'window_out_of_focus' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                  Window Out of Focus ⚠️
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Focused ✅
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Presence:</span>
              {facePresenceStatus === 'multiple_faces' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-600/25 text-red-300 border border-red-500/50 animate-bounce">
                  Multiple Faces Detected 🚨
                </span>
              ) : facePresenceStatus === 'face_missing' || gazeStatus === 'no_face' || !faceInFrame ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                  Face Missing ⚠️
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Face Detected ✅
                </span>
              )}
            </div>
          </div>

          {/* Video Preview or Fallback */}
          <div className="relative aspect-video sm:aspect-[16/10] bg-[#071322] rounded-xl overflow-hidden border border-[#1B3A60] flex items-center justify-center">
            {isStreaming ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />

                {/* Facial Reticle & Dynamic Frame Guide */}
                <div
                  className={`absolute inset-4 sm:inset-6 border border-dashed rounded-2xl pointer-events-none flex flex-col justify-between p-2 transition-all duration-300 ${
                    facePresenceStatus === 'multiple_faces'
                      ? 'border-red-500 bg-red-950/40 animate-pulse'
                      : facePresenceStatus === 'face_missing' || gazeStatus === 'no_face' || !faceInFrame
                      ? 'border-rose-500 bg-rose-950/40 animate-pulse'
                      : gazeStatus === 'looking_away'
                      ? 'border-amber-400 bg-amber-950/30'
                      : 'border-[#52D68A]/60 bg-transparent'
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span
                      className={`px-1.5 py-0.5 rounded border flex items-center gap-1 transition-colors duration-200 ${
                        facePresenceStatus === 'multiple_faces'
                          ? 'bg-red-900/90 text-red-200 border-red-500/50'
                          : facePresenceStatus === 'face_missing' || gazeStatus === 'no_face' || !faceInFrame
                          ? 'bg-rose-900/90 text-rose-200 border-rose-500/50'
                          : gazeStatus === 'looking_away'
                          ? 'bg-amber-900/90 text-amber-200 border-amber-500/50'
                          : 'bg-[#0B192C]/80 text-[#52D68A] border-[#52D68A]/30'
                      }`}
                    >
                      {facePresenceStatus === 'multiple_faces' ? (
                        <>
                          <Users className="w-3 h-3 text-red-400" /> Multiple Faces Detected 🚨
                        </>
                      ) : facePresenceStatus === 'face_missing' || gazeStatus === 'no_face' || !faceInFrame ? (
                        <>
                          <AlertCircle className="w-3 h-3 text-rose-400" /> Face Missing ⚠️
                        </>
                      ) : gazeStatus === 'looking_away' ? (
                        <>
                          <Eye className="w-3 h-3 text-amber-300" /> Looking Away
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-[#52D68A]" /> Face Detected ✅
                        </>
                      )}
                    </span>
                    <span className="bg-[#0B192C]/80 px-1.5 py-0.5 rounded border border-[#1B3A60] text-slate-300">
                      REC 24fps
                    </span>
                  </div>

                  <div
                    className={`self-center text-[10px] px-2.5 py-1 rounded-full shadow-md flex items-center gap-1.5 border transition-all duration-300 ${
                      facePresenceStatus === 'multiple_faces'
                        ? 'bg-red-900/95 border-red-500 text-red-200'
                        : facePresenceStatus === 'face_missing' || gazeStatus === 'no_face' || !faceInFrame
                        ? 'bg-rose-900/95 border-rose-500 text-rose-200'
                        : gazeStatus === 'looking_away'
                        ? 'bg-amber-950/95 border-amber-400 text-amber-200'
                        : 'bg-[#0B192C]/90 border-[#52D68A]/30 text-slate-200'
                    }`}
                  >
                    {facePresenceStatus === 'multiple_faces' ? (
                      <>
                        <ShieldAlert className="w-3 h-3 text-red-400 animate-pulse" />
                        <span>🚨 Multiple persons visible in webcam feed</span>
                      </>
                    ) : facePresenceStatus === 'face_missing' || gazeStatus === 'no_face' || !faceInFrame ? (
                      <>
                        <AlertCircle className="w-3 h-3 text-rose-400 animate-spin" />
                        <span>⚠️ Face not detected &bull; please reposition</span>
                      </>
                    ) : gazeStatus === 'looking_away' ? (
                      <>
                        <AlertCircle className="w-3 h-3 text-amber-400" />
                        <span>⚠️ Please look directly at screen</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-[#52D68A]" />
                        <span>In-Frame & Looking at Screen</span>
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-4 text-center space-y-3 max-w-xs">
                <div className="w-10 h-10 rounded-full bg-slate-800 text-amber-300 flex items-center justify-center mx-auto border border-slate-700">
                  <CameraOff className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-white block">Camera Not Streaming</span>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    {error || 'Continuous interview monitoring requires your camera to be enabled.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-3.5 py-1.5 bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 mx-auto"
                >
                  <Camera className="w-3.5 h-3.5" /> Turn On Camera
                </button>
              </div>
            )}
          </div>

          {/* Interview Integrity Dashboard (Real-Time Metrics) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] px-1 text-slate-400">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <Shield className="w-3 h-3 text-[#52D68A]" /> Real-Time Integrity Dashboard
              </span>
              <span className={`font-bold ${
                displayTrustScore >= 90 ? 'text-[#52D68A]' : displayTrustScore >= 75 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                Trust Score: {displayTrustScore}/100
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-[11px] bg-[#0B192C] p-2.5 rounded-xl border border-[#1B3A60]">
              <div className="bg-[#071322]/80 p-2 rounded-lg border border-[#1B3A60]/60">
                <span className="text-slate-400 block text-[10px] mb-0.5">Face Presence %</span>
                <span className={`font-bold text-xs ${
                  facePresencePct >= 90 ? 'text-[#52D68A]' : facePresencePct >= 75 ? 'text-amber-300' : 'text-rose-400'
                }`}>
                  {facePresencePct}%
                </span>
              </div>

              <div className="bg-[#071322]/80 p-2 rounded-lg border border-[#1B3A60]/60">
                <span className="text-slate-400 block text-[10px] mb-0.5">Focus Retention %</span>
                <span className={`font-bold text-xs ${
                  focusRetentionPct >= 90 ? 'text-[#52D68A]' : focusRetentionPct >= 75 ? 'text-amber-300' : 'text-rose-400'
                }`}>
                  {focusRetentionPct}%
                </span>
              </div>

              <div className="bg-[#071322]/80 p-2 rounded-lg border border-[#1B3A60]/60">
                <span className="text-slate-400 block text-[10px] mb-0.5">Tab Switch Count</span>
                <span className={`font-bold text-xs ${
                  tabSwitchCount === 0 ? 'text-[#52D68A]' : tabSwitchCount <= 2 ? 'text-amber-300' : 'text-rose-400'
                }`}>
                  {tabSwitchCount} {tabSwitchCount === 1 ? 'switch' : 'switches'}
                </span>
              </div>

              <div className="bg-[#071322]/80 p-2 rounded-lg border border-[#1B3A60]/60">
                <span className="text-slate-400 block text-[10px] mb-0.5">Camera Availability</span>
                <span className={`font-semibold text-xs flex items-center justify-center gap-1 ${
                  cameraAvailable && isStreaming ? 'text-[#52D68A]' : 'text-rose-400'
                }`}>
                  <Camera className="w-3 h-3" />
                  {cameraAvailable && isStreaming ? 'Available ✅' : 'Disconnected ⚠️'}
                </span>
              </div>

              <div className="bg-[#071322]/80 p-2 rounded-lg border border-[#1B3A60]/60">
                <span className="text-slate-400 block text-[10px] mb-0.5">Mic Availability</span>
                <span className={`font-semibold text-xs flex items-center justify-center gap-1 ${
                  micAvailable ? 'text-[#52D68A]' : 'text-rose-400'
                }`}>
                  <Mic className="w-3 h-3" />
                  {micAvailable ? 'Available ✅' : 'Disconnected ⚠️'}
                </span>
              </div>

              <div className="bg-[#071322]/80 p-2 rounded-lg border border-[#1B3A60]/60">
                <span className="text-slate-400 block text-[10px] mb-0.5">Assessment Status</span>
                <span className={`font-bold text-xs ${
                  integrityStatus === 'GREEN' ? 'text-[#52D68A]' : integrityStatus === 'YELLOW' ? 'text-amber-300' : 'text-rose-400'
                }`}>
                  {integrityStatus}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LiveProctoringMonitor;
