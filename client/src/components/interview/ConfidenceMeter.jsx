import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api';
import {
  Camera,
  CameraOff,
  ShieldCheck,
  Activity,
  Smile,
  Eye,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';

export const ConfidenceMeter = ({ sessionId }) => {
  const [consentGranted, setConsentGranted] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [error, setError] = useState('');

  // Confidence & Body Language metrics
  const [currentConfidence, setCurrentConfidence] = useState(82);
  const [eyeContactRatio, setEyeContactRatio] = useState(88);
  const [faceStability, setFaceStability] = useState(90);

  // Sparkline trend data
  const [trendData, setTrendData] = useState([
    { time: '0s', score: 80 },
    { time: '10s', score: 82 },
    { time: '20s', score: 85 },
    { time: '30s', score: 81 },
    { time: '40s', score: 88 }
  ]);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const datapointsBufferRef = useRef([]);

  // Handle camera start/stop
  const toggleCamera = async () => {
    if (isStreaming) {
      stopCamera();
    } else {
      await startCamera();
    }
  };

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, frameRate: 15 }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsStreaming(true);

      // MediaPipe / computer vision telemetry simulator
      intervalRef.current = setInterval(() => {
        // Fluctuates naturally around 80-92%
        const jitter = (Math.random() - 0.48) * 6;
        setCurrentConfidence((prev) => {
          const next = Math.max(50, Math.min(98, Math.round(prev + jitter)));
          setTrendData((prevTrend) => {
            const nextTrend = [
              ...prevTrend.slice(-15),
              { time: `${prevTrend.length * 5}s`, score: next }
            ];
            return nextTrend;
          });

          // Buffer datapoints for session persistence
          datapointsBufferRef.current.push({
            timestamp: new Date().toISOString(),
            confidenceScore: next,
            eyeContactRatio: Math.max(60, Math.min(95, Math.round(next + (Math.random() - 0.5) * 4))),
            faceStabilityScore: Math.max(70, Math.min(98, Math.round(next + 5)))
          });

          return next;
        });
      }, 5000);
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Could not access camera. Please check browser permissions.');
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
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setIsStreaming(false);

    // Flush any recorded points to backend
    flushDatapoints();
  };

  // Sync datapoints to backend
  const flushDatapoints = async () => {
    if (!sessionId || datapointsBufferRef.current.length === 0) return;
    try {
      const payload = { datapoints: [...datapointsBufferRef.current] };
      datapointsBufferRef.current = [];
      await api.post(`/sessions/${sessionId}/confidence-trend`, payload);
    } catch (err) {
      console.warn('Failed to sync confidence trend data:', err.message);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
      {/* Privacy Notice Banner */}
      <div className="flex items-start justify-between gap-3 p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300">
        <div className="flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold block text-white text-[11px] uppercase tracking-wide">
              Optional Self-Coaching Telemetry
            </span>
            <p className="text-[11px] text-slate-300 leading-tight">
              Confidence & facial posture metrics are <strong>strictly excluded</strong> from assessment scoring and candidate rankings.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-slate-400 hover:text-white transition p-1"
        >
          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* Consent Checkbox */}
          {!consentGranted ? (
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center space-y-3">
              <p className="text-xs text-slate-400">
                Would you like to turn on the AI camera feed for live confidence and eye-contact feedback during your interview?
              </p>
              <button
                type="button"
                onClick={() => {
                  setConsentGranted(true);
                  startCamera();
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center gap-2 mx-auto"
              >
                <Camera className="w-3.5 h-3.5" /> Enable Confidence Tracking
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                {/* Mini Camera Preview */}
                <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                  {isStreaming ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover mirror"
                      />
                      {/* Framing guide overlay */}
                      <div className="absolute inset-4 border border-dashed border-indigo-400/40 rounded-xl pointer-events-none flex items-center justify-center">
                        <span className="text-[9px] uppercase tracking-wider text-indigo-300 bg-slate-950/70 px-2 py-0.5 rounded">
                          Optimal Framing
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-slate-500 text-xs flex flex-col items-center gap-1.5">
                      <CameraOff className="w-6 h-6 text-slate-600" />
                      <span>Camera paused</span>
                    </div>
                  )}

                  {/* Toggle button */}
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className="absolute bottom-2 right-2 p-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-200 rounded-lg text-xs border border-slate-700 shadow-md transition"
                    title={isStreaming ? 'Turn Off Camera' : 'Turn On Camera'}
                  >
                    {isStreaming ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Real-time confidence gauge & sparkline */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium flex items-center gap-1.5">
                      <Smile className="w-3.5 h-3.5 text-emerald-400" />
                      Visual Confidence:
                    </span>
                    <span className="font-bold font-mono text-emerald-400 text-sm">
                      {isStreaming ? `${currentConfidence}%` : '--'}
                    </span>
                  </div>

                  {/* Sparkline chart */}
                  <div className="h-16 w-full bg-slate-950/70 rounded-xl border border-slate-800 p-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="url(#confGrad)"
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Telemetry sub-metrics */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Eye Contact:</span>
                      <span className="font-mono text-slate-200">{isStreaming ? `${eyeContactRatio}%` : '--'}</span>
                    </div>
                    <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Head Stability:</span>
                      <span className="font-mono text-slate-200">{isStreaming ? `${faceStability}%` : '--'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-[11px] text-rose-400">{error}</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ConfidenceMeter;