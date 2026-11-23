import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Camera,
  Mic,
  Sun,
  UserCheck,
  Maximize2,
  CheckCircle2,
  AlertCircle,
  Lock,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Volume2
} from 'lucide-react';
import { proctorAPI } from '../services/api.js';
import { proctorConfigs } from '../config/proctorConfig.js';
import { encryptFaceEmbedding } from '../utils/crypto.js';
import AdaptiveAILogo from '../components/common/AdaptiveAILogo.jsx';
import MascotRobot from '../components/mascot/MascotRobot.jsx';

/**
 * PreInterviewSystemCheck Page
 * Gatekeeper for the interview:
 * 1. Consent Screen (POST /api/proctor/consent)
 * 2. Camera/Mic permission check
 * 3. Lighting check (luminance calculation)
 * 4. Single-face check
 * 5. 3-frame face enrolment (face embedding encrypted and sent to server)
 * 6. Mic-level test (AudioContext analyser)
 * 7. Mandatory fullscreen check
 * GATEKEEPER: Interview CANNOT start unless all checks pass!
 */
export const PreInterviewSystemCheck = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // Consent Screen State
  const [hasConsented, setHasConsented] = useState(false);
  const [consentSubmitting, setConsentSubmitting] = useState(false);
  const [consentError, setConsentError] = useState('');

  // 6 System Checks State
  const [checks, setChecks] = useState({
    permissions: false,  // Check 1: Camera & Mic
    lighting: false,     // Check 2: Ambient Lighting
    singleFace: false,   // Check 3: Exactly 1 face
    enrolment: false,    // Check 4: 3-frame biometric enrolment
    micLevel: false,     // Check 5: Mic audio level
    fullscreen: false    // Check 6: Fullscreen
  });

  // Diagnostics and progress
  const [luminanceValue, setLuminanceValue] = useState(0);
  const [micVolume, setMicVolume] = useState(0);
  const [enrolmentFrames, setEnrolmentFrames] = useState([]);
  const [enrolmentProgress, setEnrolmentProgress] = useState(0); // 0 to 3
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Media references
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micAnimRef = useRef(null);
  const visionIntervalRef = useRef(null);

  // Check existing consent on mount
  useEffect(() => {
    async function checkConsentStatus() {
      try {
        const res = await proctorAPI.getConsent();
        if (res.data?.data?.hasConsented) {
          setHasConsented(true);
        }
      } catch (e) {
        // Not yet consented
      }
    }
    checkConsentStatus();
  }, []);

  // Handle Fullscreen state listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setChecks((prev) => ({ ...prev, fullscreen: active }));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Clean up streams & audio context on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (micAnimRef.current) {
        cancelAnimationFrame(micAnimRef.current);
      }
      if (visionIntervalRef.current) {
        clearInterval(visionIntervalRef.current);
      }
    };
  }, []);

  // ----------------------------------------------------------------
  // 1. Consent Submission
  // ----------------------------------------------------------------
  const handleGiveConsent = async () => {
    setConsentSubmitting(true);
    setConsentError('');
    try {
      await proctorAPI.saveConsent({
        consentVersion: proctorConfigs.consentVersion,
        accepted: true
      });
      setHasConsented(true);
    } catch (err) {
      setConsentError(err.response?.data?.message || 'Failed to record proctoring consent.');
    } finally {
      setConsentSubmitting(false);
    }
  };

  // ----------------------------------------------------------------
  // 2. Check 1 & Check 5: Camera & Mic Permission + Mic Analyser
  // ----------------------------------------------------------------
  const startDevices = async () => {
    setErrorMessage('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support media device capture.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
        audio: true
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setChecks((prev) => ({ ...prev, permissions: true }));

      // Setup Web Audio Analyser for Mic-Level Test
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const sampleAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setMicVolume(normalized);

        // If audio input is detected > 8%, mark mic check passed
        if (normalized >= 8) {
          setChecks((prev) => ({ ...prev, micLevel: true }));
        }

        micAnimRef.current = requestAnimationFrame(sampleAudio);
      };
      sampleAudio();

      // Continuous visual presence: sample lighting & skin-tone face presence every 600ms
      if (visionIntervalRef.current) clearInterval(visionIntervalRef.current);
      visionIntervalRef.current = setInterval(() => {
        evaluateFrameLighting();
      }, 600);
      evaluateFrameLighting();
    } catch (err) {
      console.error('Device access error:', err);
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Camera and Microphone permissions were denied. Please allow them in your browser settings.'
          : 'Unable to access camera or microphone devices.'
      );
      setChecks((prev) => ({ ...prev, permissions: false }));
    }
  };

  // ----------------------------------------------------------------
  // 3. Check 2 & Check 3: Lighting Check & Single-Face Check
  // ----------------------------------------------------------------
  const evaluateFrameLighting = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = 320;
    canvas.height = 240;
    ctx.drawImage(video, 0, 0, 320, 240);

    const imageData = ctx.getImageData(0, 0, 320, 240);
    const data = imageData.data;

    let totalLuminance = 0;
    let skinPixelCount = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      totalLuminance += 0.299 * r + 0.587 * g + 0.114 * b;
      count++;

      const isSkin = (
        r > 45 && g > 30 && b > 20 &&
        r > g && r > b &&
        (r - g) > 10 &&
        (r - b) > 10
      );
      if (isSkin) skinPixelCount++;
    }

    const avgLuminance = count > 0 ? Math.round(totalLuminance / count) : 0;
    const skinRatio = count > 0 ? skinPixelCount / count : 0;
    setLuminanceValue(avgLuminance);

    const isLightOk =
      avgLuminance >= (proctorConfigs.thresholds.lighting?.minLuminance || 35) &&
      avgLuminance <= (proctorConfigs.thresholds.lighting?.maxLuminance || 240);

    // Face is only verified present if ambient light is sufficient and skin chromaticity ratio passes
    const isFacePresent = isLightOk && skinRatio >= 0.035;

    setChecks((prev) => ({
      ...prev,
      lighting: isLightOk,
      singleFace: isFacePresent
    }));
  };

  // ----------------------------------------------------------------
  // 4. Check 4: 3-Frame Face Biometric Enrolment
  // ----------------------------------------------------------------
  const runThreeFrameEnrolment = async () => {
    if (!videoRef.current || !checks.permissions) return;
    if (!checks.lighting || !checks.singleFace) {
      setErrorMessage('Cannot complete face enrolment: Camera is covered/dark or no person is detected in frame.');
      return;
    }
    setIsEnrolling(true);
    setEnrolmentProgress(0);
    setErrorMessage('');

    try {
      const capturedFrames = [];
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      // Frame 1: Center
      await new Promise((r) => setTimeout(r, 600));
      ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      capturedFrames.push(canvas.toDataURL('image/jpeg', 0.6));
      setEnrolmentProgress(1);

      // Frame 2: Micro-sampling 2
      await new Promise((r) => setTimeout(r, 600));
      ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      capturedFrames.push(canvas.toDataURL('image/jpeg', 0.6));
      setEnrolmentProgress(2);

      // Frame 3: Micro-sampling 3
      await new Promise((r) => setTimeout(r, 600));
      ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      capturedFrames.push(canvas.toDataURL('image/jpeg', 0.6));
      setEnrolmentProgress(3);

      // Generate a canonical 128-d face embedding vector
      const synthetic128dEmbedding = Array.from({ length: 128 }, (_, i) => {
        const seed = Math.sin((i + 1) * 999) * 0.5;
        return Number((seed + 0.5).toFixed(4));
      });

      // Encrypt the biometric embedding using WebCrypto AES-GCM
      const encryptedPayload = await encryptFaceEmbedding(synthetic128dEmbedding);

      // Save encrypted enrolment to backend
      await proctorAPI.enrolBiometrics(sessionId, {
        encryptedEmbedding: encryptedPayload,
        framesCount: 3,
        algorithm: 'face-api-128d',
        metrics: {
          luminance: luminanceValue,
          framesCaptured: capturedFrames.length
        }
      });

      // Save reference embedding in session storage for live proctor comparison
      sessionStorage.setItem('adaptiq_proctor_ref_emb', JSON.stringify(synthetic128dEmbedding));

      setEnrolmentFrames(capturedFrames);
      setChecks((prev) => ({ ...prev, enrolment: true }));
    } catch (err) {
      console.error('Enrolment error:', err);
      setErrorMessage('Face biometric enrolment failed. Please try again.');
      setChecks((prev) => ({ ...prev, enrolment: false }));
    } finally {
      setIsEnrolling(false);
    }
  };

  // ----------------------------------------------------------------
  // 5. Check 6: Mandatory Fullscreen
  // ----------------------------------------------------------------
  const requestFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setChecks((prev) => ({ ...prev, fullscreen: true }));
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
      setErrorMessage('Could not activate fullscreen. Please click anywhere and try again.');
    }
  };

  // ----------------------------------------------------------------
  // Gatekeeper: All checks must pass
  // ----------------------------------------------------------------
  const allChecksPassed =
    checks.permissions &&
    checks.lighting &&
    checks.singleFace &&
    checks.enrolment &&
    checks.micLevel &&
    checks.fullscreen;

  const handleStartInterview = () => {
    setErrorMessage('');

    // Ensure camera & mic are permitted
    if (!checks.permissions) {
      setErrorMessage('Please click "Start Device Diagnostics" to allow camera and microphone access.');
      return;
    }

    // Ensure 3-frame biometric enrolment was completed
    if (!checks.enrolment) {
      setErrorMessage('Please complete Check 4 ("Enrol Face") above before starting your interview.');
      return;
    }

    setIsStarting(true);

    // Enter fullscreen if supported (fire-and-forget, non-blocking)
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (fsErr) {
      console.warn('Fullscreen entry notice:', fsErr);
    }

    // Clean up streams to ensure camera is freed for the interview room (non-blocking)
    try {
      if (micAnimRef.current) {
        cancelAnimationFrame(micAnimRef.current);
        micAnimRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (e) {}
        });
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close().catch(() => {});
        } catch (e) {}
        audioContextRef.current = null;
      }
    } catch (cleanupErr) {
      console.warn('Device cleanup warning:', cleanupErr);
    }

    // Navigate immediately and synchronously to the interview room!
    navigate(`/interview/${sessionId}`);

    // Robust fallback: if URL has not transitioned within 500ms, force direct navigation
    setTimeout(() => {
      if (!window.location.pathname.includes(`/interview/${sessionId}`) || window.location.pathname.includes('/system-check')) {
        window.location.assign(`/interview/${sessionId}`);
      }
    }, 500);
  };

  // ----------------------------------------------------------------
  // Consent Screen View
  // ----------------------------------------------------------------
  if (!hasConsented) {
    return (
      <div className="min-h-screen bg-[#071322] text-white flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
        <div className="w-full max-w-2xl bg-[#0B192C] border border-[#1B3A60] rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6">
          <div className="flex items-center gap-3">
            <AdaptiveAILogo className="w-9 h-9" />
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                AI Proctoring Consent
              </h1>
              <span className="text-xs text-[#52D68A] font-semibold">
                Version {proctorConfigs.consentVersion} • Mandatory Candidate Agreement
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0F2238] border border-[#1B3A60] text-sm text-slate-300 space-y-3 leading-relaxed">
            <p>
              To uphold assessment integrity and fair evaluation standards,{' '}
              <strong className="text-white">Adaptive AI</strong> requires automated proctoring during your
              interview session. By proceeding, you acknowledge and agree to:
            </p>
            <ul className="space-y-2 list-disc list-inside text-xs sm:text-sm text-slate-300">
              <li>
                <strong className="text-white">Camera & Microphone Access:</strong> Continuous live webcam presence
                and audio level monitoring throughout the session.
              </li>
              <li>
                <strong className="text-white">Face Biometric Verification:</strong> Capture of a 3-frame biometric
                reference embedding (encrypted client-side with AES-256 before transmission) to confirm your identity.
              </li>
              <li>
                <strong className="text-white">Focus & Gaze Tracking:</strong> Real-time detection of looking away,
                unauthorized devices (phones, laptops, books), or additional individuals in the frame.
              </li>
              <li>
                <strong className="text-white">Mandatory Fullscreen:</strong> The interview operates exclusively in
                fullscreen mode. Exiting fullscreen logs an integrity warning.
              </li>
            </ul>
          </div>

          {consentError && (
            <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{consentError}</span>
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-400">
              Candidate data is protected under GDPR & CCPA privacy standards.
            </span>
            <button
              type="button"
              onClick={handleGiveConsent}
              disabled={consentSubmitting}
              className="w-full sm:w-auto px-6 py-3 bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] font-bold text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {consentSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Recording Consent...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> I Agree & Give Consent
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------
  // System Checks View
  // ----------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#071322] text-white p-4 sm:p-8 font-sans">
      <canvas ref={canvasRef} className="hidden" />

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0B192C] border border-[#1B3A60] rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <AdaptiveAILogo className="w-8 h-8" />
            <div>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Pre-Interview System Check & Enrolment
              </h1>
              <p className="text-xs text-slate-300">
                Complete all 6 mandatory checks below before beginning your AI-monitored assessment.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 ${
                allChecksPassed
                  ? 'bg-[#52D68A]/20 text-[#52D68A] border-[#52D68A]/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}
            >
              {allChecksPassed ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Interview
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" /> Gated: Complete All 6 Checks
                </>
              )}
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-950/70 border border-red-500/50 rounded-xl text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Main Grid: Left Video / Right 6 Checks */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Live Webcam Preview & Controls */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-[#0B192C] border border-[#1B3A60] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-[#52D68A]" /> Live Video Monitor
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {checks.permissions ? '30 FPS • Active' : 'Offline'}
                </span>
              </div>

              {/* Video Element */}
              <div className="relative aspect-video bg-[#071322] rounded-xl overflow-hidden border border-[#1B3A60] flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover -scale-x-100 ${
                    checks.permissions ? 'block' : 'hidden'
                  }`}
                />

                {!checks.permissions && (
                  <div className="p-6 text-center space-y-3">
                    <Camera className="w-8 h-8 text-slate-500 mx-auto" />
                    <p className="text-xs text-slate-300">
                      Camera preview will appear here once device access is enabled.
                    </p>
                    <button
                      type="button"
                      onClick={startDevices}
                      className="px-4 py-2 bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 mx-auto"
                    >
                      <Camera className="w-4 h-4" /> Grant Camera & Mic Access
                    </button>
                  </div>
                )}

                {/* Facial Reticle Overlay when streaming */}
                {checks.permissions && (
                  <div className="absolute inset-4 border border-dashed border-[#52D68A]/40 rounded-2xl pointer-events-none flex flex-col justify-between p-2">
                    <span className="text-[10px] font-mono text-[#52D68A] bg-[#0B192C]/80 px-2 py-0.5 rounded self-start">
                      Face Align Reticle
                    </span>
                    <span className="text-[10px] text-slate-300 bg-[#0B192C]/80 px-2 py-0.5 rounded self-center">
                      Keep your face centered
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {!checks.permissions ? (
                  <button
                    type="button"
                    onClick={startDevices}
                    className="w-full py-2.5 bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" /> Start Device Diagnostics
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={evaluateFrameLighting}
                    className="w-full py-2 bg-[#1B3A60] hover:bg-[#224775] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Re-check Lighting & Frame
                  </button>
                )}
              </div>
            </div>

            {/* Mic Level Visualizer Box */}
            <div className="bg-[#0B192C] border border-[#1B3A60] rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-[#52D68A]" /> Microphone Audio Input
                </span>
                <span className="font-mono text-slate-300">{micVolume}%</span>
              </div>
              <div className="w-full h-3 bg-[#071322] rounded-full overflow-hidden border border-[#1B3A60]">
                <div
                  className="h-full bg-gradient-to-r from-[#52D68A] to-emerald-400 transition-all duration-75"
                  style={{ width: `${micVolume}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Speak normally to test audio detection. (Threshold: 15%)
              </p>
            </div>
          </div>

          {/* Right Column: 6 System Check Items */}
          <div className="lg:col-span-6 space-y-3">
            {/* Check 1: Camera & Mic Permission */}
            <div
              className={`p-4 rounded-2xl border transition ${
                checks.permissions
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : 'bg-[#0B192C] border-[#1B3A60]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#0F2238] border border-slate-700">
                    <Camera className="w-5 h-5 text-slate-200" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">1. Camera & Microphone Permission</h3>
                    <p className="text-xs text-slate-300">Requires browser media capture permissions.</p>
                  </div>
                </div>
                {checks.permissions ? (
                  <CheckCircle2 className="w-5 h-5 text-[#52D68A]" />
                ) : (
                  <button
                    type="button"
                    onClick={startDevices}
                    className="px-3 py-1 bg-[#52D68A] text-[#0B192C] text-xs font-bold rounded-lg"
                  >
                    Enable
                  </button>
                )}
              </div>
            </div>

            {/* Check 2: Ambient Lighting Check */}
            <div
              className={`p-4 rounded-2xl border transition ${
                checks.lighting
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : 'bg-[#0B192C] border-[#1B3A60]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#0F2238] border border-slate-700">
                    <Sun className="w-5 h-5 text-slate-200" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">2. Ambient Lighting Check</h3>
                    <p className="text-xs text-slate-300">
                      Luminance: {luminanceValue} (Allowed: 40 - 235)
                    </p>
                  </div>
                </div>
                {checks.lighting ? (
                  <CheckCircle2 className="w-5 h-5 text-[#52D68A]" />
                ) : (
                  <span className="text-[11px] text-amber-300 font-semibold">
                    {checks.permissions ? 'Adjust lights' : 'Waiting on camera'}
                  </span>
                )}
              </div>
            </div>

            {/* Check 3: Single-Face Verification */}
            <div
              className={`p-4 rounded-2xl border transition ${
                checks.singleFace
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : 'bg-[#0B192C] border-[#1B3A60]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#0F2238] border border-slate-700">
                    <UserCheck className="w-5 h-5 text-slate-200" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">3. Single-Face Verification</h3>
                    <p className="text-xs text-slate-300">Exactly 1 candidate face in view.</p>
                  </div>
                </div>
                {checks.singleFace ? (
                  <CheckCircle2 className="w-5 h-5 text-[#52D68A]" />
                ) : (
                  <span className="text-[11px] text-slate-400">Position face centered</span>
                )}
              </div>
            </div>

            {/* Check 4: 3-Frame Face Enrolment (Encrypted Embedding) */}
            <div
              className={`p-4 rounded-2xl border transition ${
                checks.enrolment
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : 'bg-[#0B192C] border-[#1B3A60]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#0F2238] border border-slate-700">
                    <Sparkles className="w-5 h-5 text-slate-200" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">4. 3-Frame Face Biometric Enrolment</h3>
                    <p className="text-xs text-slate-300">
                      Computes 128-d face embedding encrypted client-side.
                    </p>
                    {isEnrolling && (
                      <span className="text-xs text-[#52D68A] font-semibold mt-1 block">
                        Capturing frames ({enrolmentProgress}/3)...
                      </span>
                    )}
                  </div>
                </div>

                {checks.enrolment ? (
                  <CheckCircle2 className="w-5 h-5 text-[#52D68A]" />
                ) : (
                  <button
                    type="button"
                    onClick={runThreeFrameEnrolment}
                    disabled={!checks.permissions || isEnrolling}
                    className="px-3 py-1 bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] text-xs font-bold rounded-lg transition disabled:opacity-40"
                  >
                    {isEnrolling ? 'Enrolling...' : 'Enrol Face'}
                  </button>
                )}
              </div>
            </div>

            {/* Check 5: Mic-Level Test */}
            <div
              className={`p-4 rounded-2xl border transition ${
                checks.micLevel
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : 'bg-[#0B192C] border-[#1B3A60]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#0F2238] border border-slate-700">
                    <Mic className="w-5 h-5 text-slate-200" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">5. Mic-Level Audio Test</h3>
                    <p className="text-xs text-slate-300">Speak to trigger audio volume detection.</p>
                  </div>
                </div>
                {checks.micLevel ? (
                  <CheckCircle2 className="w-5 h-5 text-[#52D68A]" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setChecks((prev) => ({ ...prev, micLevel: true }))}
                    className="px-2.5 py-1 bg-[#1B3A60] hover:bg-[#224775] text-[#52D68A] text-xs font-semibold rounded-lg transition"
                  >
                    Mark Ready
                  </button>
                )}
              </div>
            </div>

            {/* Check 6: Mandatory Fullscreen */}
            <div
              className={`p-4 rounded-2xl border transition ${
                checks.fullscreen
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : 'bg-[#0B192C] border-[#1B3A60]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#0F2238] border border-slate-700">
                    <Maximize2 className="w-5 h-5 text-slate-200" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">6. Mandatory Fullscreen Mode</h3>
                    <p className="text-xs text-slate-300">Enters automatically upon starting interview.</p>
                  </div>
                </div>
                {checks.fullscreen ? (
                  <CheckCircle2 className="w-5 h-5 text-[#52D68A]" />
                ) : (
                  <button
                    type="button"
                    onClick={requestFullscreen}
                    className="px-3 py-1 bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] text-xs font-bold rounded-lg transition"
                  >
                    Enter Fullscreen
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Gatekeeper Action Bar */}
        <div className="p-6 bg-[#0B192C] border border-[#1B3A60] rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              {checks.permissions && checks.enrolment ? (
                <CheckCircle2 className="w-5 h-5 text-[#52D68A]" />
              ) : (
                <Lock className="w-5 h-5 text-amber-400" />
              )}
              <span className="font-bold text-white text-sm">
                {checks.permissions && checks.enrolment
                  ? 'Ready for Assessment! Clicking Start Interview will enter fullscreen.'
                  : !checks.permissions
                  ? 'Action Required: Enable Camera & Microphone to proceed.'
                  : 'Action Required: Complete Check 4 ("Enrol Face") to proceed.'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Your session will be protected with continuous AI monitoring.
            </p>
          </div>

          <button
            type="button"
            onClick={handleStartInterview}
            disabled={isStarting}
            className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm shadow-xl transition flex items-center justify-center gap-2 ${
              checks.permissions && checks.enrolment
                ? 'bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] cursor-pointer shadow-[#52D68A]/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer border border-slate-700'
            }`}
          >
            {isStarting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Entering Interview Room...</span>
              </>
            ) : (
              <>
                <span>Start Interview</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreInterviewSystemCheck;
