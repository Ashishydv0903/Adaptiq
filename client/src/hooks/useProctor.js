/**
 * @file useProctor.js
 * Comprehensive React Hook for AI Proctoring Engine
 * Monitors:
 * 1. Browser Behaviour: tab switch, window blur, fullscreen exit, copy/cut/paste,
 *    right-click, devtools shortcuts, window resize / extra-monitor suspicion, virtual camera check.
 * 2. Typing Pattern Anomalies: large paste burst, uniform keystroke timing, implausibly fast answers.
 * 3. AI-Generated Text Risk Indicator: burstiness heuristic + LLM classifier (risk indicator only).
 * 4. Web Audio API Checks: speech in write mode, lips moving with no audio, two-speaker formant heuristic.
 * 5. Time-Decayed Integrity Score (0-100) & integrityStatus (GREEN/YELLOW/ORANGE/RED).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { proctorConfigs, calculateTimeDecayedIntegrityScore } from '../config/proctorConfig.js';
import { proctorAPI, sessionAPI } from '../services/api.js';
import SimplePeer from '../services/simplePeer.js';
import { initFaceLandmarker, detectFaceLandmarks } from '../services/vision/faceLandmarker.js';
import { initObjectDetector, detectProhibitedObjects } from '../services/vision/objectDetector.js';
import { initFaceIdentity, verify } from '../services/vision/faceIdentity.js';

export function useProctor({
  videoRef,
  sessionId,
  referenceEmbedding = null,
  isEnabled = true,
  isWriteMode = false, // True when candidate is typing code / text answers
  socket = null,
  onWarning = null
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [isModelsLoading, setIsModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState(null);
  const [isLowPerformanceMode, setIsLowPerformanceMode] = useState(false);
  const isLowPerformanceModeRef = useRef(false);
  const [latestWarning, setLatestWarning] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [violationCounts, setViolationCounts] = useState({ yellow: 0, orange: 0, red: 0 });
  const [integrityScore, setIntegrityScore] = useState(100);
  const [integrityStatus, setIntegrityStatus] = useState('GREEN');

  // Dynamic real-time biometric & gaze tracking state
  const [liveFaceInFrame, setLiveFaceInFrame] = useState(true);
  const [liveGaze, setLiveGaze] = useState('centered'); // 'centered' | 'looking_away' | 'no_face'
  const [liveEyeFocus, setLiveEyeFocus] = useState(95);

  // Focus & Tab Tracking Metrics
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [focusStatus, setFocusStatus] = useState('focused'); // 'focused' | 'tab_switched' | 'window_out_of_focus'
  const [facePresenceStatus, setFacePresenceStatus] = useState('face_detected'); // 'face_detected' | 'face_missing' | 'multiple_faces'
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [micAvailable, setMicAvailable] = useState(true);
  const [facePresencePct, setFacePresencePct] = useState(100);
  const [focusRetentionPct, setFocusRetentionPct] = useState(100);
  const [trustDeductions, setTrustDeductions] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [isFaceMissingLong, setIsFaceMissingLong] = useState(false);

  const sessionStartTimeRef = useRef(Date.now());
  const focusLossStartTimeRef = useRef(null);
  const focusLossTypeRef = useRef(null);
  const totalFocusLossMsRef = useRef(0);
  const totalFacePresentMsRef = useRef(0);
  const lastFaceCheckTimeRef = useRef(Date.now());
  const faceMissingStartTimeRef = useRef(null);
  const lastFaceWarningTimeRef = useRef(0);

  // Recruiter Session Control state (warning, pause, terminate)
  const [sessionControlState, setSessionControlState] = useState({
    status: 'in_progress', // 'in_progress' | 'paused' | 'terminated'
    reason: '',
    message: '',
    activeWarning: null
  });

  const workerRef = useRef(null);
  const canvasRef = useRef(null);
  const samplingIntervalRef = useRef(null);
  const lastEmitTimeRef = useRef({});
  const activeStreamRef = useRef(null);

  // Rolling 10-second MediaRecorder buffer
  const rollingMediaRecorderRef = useRef(null);
  const rollingChunksRef = useRef([]);

  // Audio Context & Analyser references
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioSourceRef = useRef(null);
  const spectralCentroidsRef = useRef([]);

  // Keystroke dynamics tracking references
  const keystrokeTimestampsRef = useRef([]);
  const lastKeystrokeEvalRef = useRef(0);

  // Vision loop references
  const lastLandmarkTimeRef = useRef(0);
  const lastObjectTimeRef = useRef(0);
  const lastIdentityTimeRef = useRef(0);
  const rollingInferenceTimesRef = useRef([]);
  const rVFCIdRef = useRef(null);

  // Initialize computer vision models
  const initModels = useCallback(async () => {
    setIsModelsLoading(true);
    setModelsError(null);
    try {
      await Promise.all([
        initFaceLandmarker(),
        initObjectDetector(),
        initFaceIdentity()
      ]);
      setIsModelsLoading(false);
    } catch (err) {
      console.error('Fatal: Proctor vision models failed to load:', err);
      setModelsError(err.message || 'Proctor vision models failed to load');
      setIsModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isEnabled) {
      initModels();
    }
  }, [isEnabled, initModels]);

  // Initialize Offscreen/Hidden Canvas for frame sampling & snapshot generation
  useEffect(() => {
    if (!canvasRef.current && typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      canvasRef.current = canvas;
    }
  }, []);

  // Helper to capture a compressed snapshot for proctor audit logs
  const captureSnapshot = useCallback(() => {
    if (!videoRef?.current || !canvasRef.current) return null;
    try {
      const video = videoRef.current;
      if (video.readyState < 2) return null; // HAVE_CURRENT_DATA
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.5);
    } catch (e) {
      return null;
    }
  }, [videoRef]);

  // Helper to record trust deductions and audit log entries
  const applyTrustDeduction = useCallback((reason, points, eventType, durationMs = 0, metadata = {}) => {
    setTrustDeductions((prev) => [
      ...prev,
      { reason, points, timestamp: new Date().toISOString() }
    ]);

    const newEntry = {
      eventType,
      severity: points >= 10 ? 'WARNING' : 'INFO',
      durationMs,
      deduction: points,
      source: metadata?.source || 'vision',
      timestamp: new Date().toISOString(),
      metadata: { ...metadata, reason }
    };

    setAuditLog((prev) => [newEntry, ...prev.slice(0, 49)]);

    if (sessionId) {
      sessionAPI.recordAuditEvent(sessionId, newEntry).catch(() => {});
    }
  }, [sessionId]);

  // Dispatch proctor event over Socket.io with throttling
  const emitProctorEvent = useCallback(
    (eventData) => {
      if (!sessionId || !eventData?.type) return;

      const now = Date.now();
      const lastSent = lastEmitTimeRef.current[eventData.type] || 0;
      // Throttle identical events by at least 1500ms unless high severity or changed condition
      if (now - lastSent < 1500 && eventData.severity === 'yellow') {
        return;
      }
      lastEmitTimeRef.current[eventData.type] = now;

      const snapshot = captureSnapshot();
      const payload = {
        sessionId,
        type: eventData.type,
        severity: eventData.severity,
        confidence: eventData.confidence ?? 0.9,
        durationMs: eventData.durationMs || 0,
        source: eventData.source || 'vision',
        metadata: {
          ...(eventData.metadata || {}),
          source: eventData.source || 'vision'
        },
        snapshot,
        timestamp: eventData.timestamp || new Date().toISOString()
      };

      if (socket && socket.connected) {
        socket.emit('proctor:event', payload);
      }

      // Evidence handling: Upload rolling 10s buffer + snapshot ONLY when Orange or Red alert fires
      if (eventData.severity === 'orange' || eventData.severity === 'red') {
        try {
          const tenSecondsAgo = Date.now() - 10000;
          const recentChunks = rollingChunksRef.current
            .filter((c) => c.timestamp >= tenSecondsAgo && c.data && c.data.size > 0)
            .map((c) => c.data);

          const formData = new FormData();
          formData.append('sessionId', sessionId);
          formData.append('alertId', `alert_${Date.now()}`);
          formData.append('eventType', eventData.type);
          formData.append('severity', eventData.severity);
          formData.append('durationSeconds', '10');
          if (snapshot) {
            formData.append('snapshot', snapshot);
          }

          if (recentChunks.length > 0 && typeof Blob !== 'undefined') {
            const mimeType = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus'))
              ? 'video/webm'
              : 'video/mp4';
            const videoBlob = new Blob(recentChunks, { type: mimeType });
            formData.append('videoBuffer', videoBlob, `alert_${Date.now()}.webm`);
          }

          proctorAPI.uploadEvidence(formData).catch((err) => {
            console.warn('Evidence upload notice:', err.message);
          });
        } catch (e) {
          console.warn('Evidence packaging notice:', e);
        }
      }
    },
    [sessionId, socket, captureSnapshot]
  );

  // Initialize Web Worker
  useEffect(() => {
    if (!isEnabled || typeof window === 'undefined') return;

    try {
      const worker = new Worker(new URL('../workers/proctor.worker.js', import.meta.url), {
        type: 'module'
      });

      worker.onmessage = (e) => {
        const { type, detectedEvents = [] } = e.data || {};
        if (type === 'PROCTOR_EVALUATION' && detectedEvents.length > 0) {
          detectedEvents.forEach((event) => {
            emitProctorEvent(event);
          });
        }
      };

      workerRef.current = worker;
      setIsRunning(true);
    } catch (err) {
      console.warn('Failed to start proctor Web Worker:', err);
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      setIsRunning(false);
    };
  }, [isEnabled, emitProctorEvent]);

  // Initialize Web Audio API Analyser connected to active video/audio stream
  useEffect(() => {
    if (!isEnabled || typeof window === 'undefined') return;

    const setupAudioAnalyser = () => {
      try {
        const stream = videoRef?.current?.srcObject;
        if (!stream || stream.getAudioTracks().length === 0) return;

        if (!audioContextRef.current) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            audioContextRef.current = new AudioContextClass();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
          }
        }

        if (audioContextRef.current && analyserRef.current && !audioSourceRef.current) {
          audioSourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
          audioSourceRef.current.connect(analyserRef.current);
        }
      } catch (e) {
        // Audio analyser setup fallback
      }
    };

    setupAudioAnalyser();

    return () => {
      if (audioSourceRef.current) {
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [isEnabled, videoRef]);

  // Check Virtual Camera device labels
  useEffect(() => {
    if (!isEnabled || typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    const checkVirtualCameraDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        const virtualKeywords = proctorConfigs.thresholds.browser?.virtualCameraKeywords || [
          'obs',
          'virtual',
          'manycam',
          'v4l2loopback',
          'droidcam',
          'fake',
          'camo',
          'xsplit',
          'ndi'
        ];

        for (const dev of videoDevices) {
          const label = (dev.label || '').toLowerCase();
          if (virtualKeywords.some((keyword) => label.includes(keyword))) {
            emitProctorEvent({
              type: 'VIRTUAL_CAMERA',
              severity: 'orange',
              confidence: 0.98,
              metadata: { deviceLabel: dev.label, deviceId: dev.deviceId }
            });
            break;
          }
        }
      } catch (err) {
        // Device check ignored
      }
    };

    checkVirtualCameraDevices();
  }, [isEnabled, emitProctorEvent]);

  // -------------------------------------------------------------
  // Real Computer Vision Sampling Loop: MediaPipe, COCO-SSD, Face-API
  // Uses requestVideoFrameCallback (with fallback to setInterval)
  // Landmarks: ~2-4 fps (~300ms) | Objects: ~0.5 fps (~2000ms) | Identity: ~0.2 fps (~5000ms)
  // -------------------------------------------------------------
  const isAnalyzingRef = useRef(false);

  const runVisionSampling = useCallback(
    async (nowMs = performance.now()) => {
      const video = videoRef?.current;
      const worker = workerRef?.current;

      if (!video || !worker || video.readyState < 2 || isModelsLoading || modelsError) {
        return;
      }
      if (isAnalyzingRef.current) return;
      isAnalyzingRef.current = true;

      try {
        // Track media stream status
        if (video.srcObject && video.srcObject !== activeStreamRef.current) {
          activeStreamRef.current = video.srcObject;
          const tracks = video.srcObject.getVideoTracks();
          tracks.forEach((track) => {
            track.onended = () => {
              emitProctorEvent({
                type: 'DEVICE_DISCONNECTED',
                severity: 'orange',
                confidence: 1.0,
                metadata: { reason: 'Camera track ended' }
              });
            };
          });
        }

        const isLowPerf = isLowPerformanceModeRef.current;
        const landmarkInterval = isLowPerf ? 600 : 300; // ~1.6 fps (low-perf) or ~3.3 fps (normal)
        const objectInterval = 2000; // ~0.5 fps
        const identityInterval = 5000; // ~0.2 fps

        // Only run when landmark interval has elapsed
        if (nowMs - lastLandmarkTimeRef.current >= landmarkInterval) {
          lastLandmarkTimeRef.current = nowMs;
          const t0 = performance.now();

          // 1. Real MediaPipe Face Landmarks & Head Pose
          let landmarkResult = null;
          try {
            landmarkResult = detectFaceLandmarks(video, nowMs);
          } catch (e) {
            // Frame detection error
          }

          if (landmarkResult) {
            const hasFace = landmarkResult.faceCount > 0;
            const isLookingAway = landmarkResult.isLookingAway;

            setLiveFaceInFrame(hasFace);
            setLiveGaze(
              landmarkResult.faceCount === 0
                ? 'no_face'
                : isLookingAway
                ? 'looking_away'
                : 'centered'
            );
            setLiveEyeFocus(
              landmarkResult.faceCount === 0 ? 0 : isLookingAway ? 40 : 95
            );
            setFacePresenceStatus(
              landmarkResult.faceCount === 0
                ? 'face_missing'
                : landmarkResult.faceCount > 1
                ? 'multiple_faces'
                : 'face_detected'
            );

            // Continuous face missing tracking
            if (landmarkResult.faceCount === 0) {
              if (!faceMissingStartTimeRef.current) {
                faceMissingStartTimeRef.current = Date.now();
              }
              const missingDurationMs = Date.now() - faceMissingStartTimeRef.current;
              if (missingDurationMs >= 3000) {
                setIsFaceMissingLong(true);
              }
            } else {
              faceMissingStartTimeRef.current = null;
              setIsFaceMissingLong(false);
              totalFacePresentMsRef.current += landmarkInterval;
            }

            // 2. Real COCO-SSD Object Detection (~0.5 fps, skipped in low performance mode)
            let prohibitedObjects = [];
            if (!isLowPerf && nowMs - lastObjectTimeRef.current >= objectInterval) {
              lastObjectTimeRef.current = nowMs;
              try {
                const objResult = await detectProhibitedObjects(video, 0.5);
                prohibitedObjects = objResult.prohibitedDetections || [];
              } catch (e) {
                // Object detection error
              }
            }

            // 3. Real Face-API Biometric Identity Verification (~0.2 fps)
            let identityResult = null;
            if (
              referenceEmbedding &&
              landmarkResult.faceCount === 1 &&
              nowMs - lastIdentityTimeRef.current >= identityInterval
            ) {
              lastIdentityTimeRef.current = nowMs;
              try {
                identityResult = await verify(
                  video,
                  referenceEmbedding,
                  proctorConfigs.thresholds?.identity?.maxEmbeddingDistance || 0.5
                );
              } catch (e) {
                // Identity verification error
              }
            }

            // Measure inference latency & check for low performance mode (>400ms)
            const inferenceTime = performance.now() - t0;
            rollingInferenceTimesRef.current.push(inferenceTime);
            if (rollingInferenceTimesRef.current.length > 5) {
              rollingInferenceTimesRef.current.shift();
            }

            const avgInference =
              rollingInferenceTimesRef.current.reduce((a, b) => a + b, 0) /
              rollingInferenceTimesRef.current.length;

            if (avgInference > 400 && !isLowPerformanceModeRef.current) {
              isLowPerformanceModeRef.current = true;
              setIsLowPerformanceMode(true);
              setLatestWarning({
                type: 'LOW_PERFORMANCE_MODE',
                severity: 'yellow',
                message:
                  '⚡ Low Performance Mode: Inference latency exceeded 400ms. Reduced frame rate and skipped object detection to preserve device stability.',
                timestamp: new Date().toISOString()
              });
            }

            // 4. Web Audio API Spectral & Voice Formant Analysis
            let audioVolume = 0;
            let speechDetected = false;
            let twoSpeakerVariance = 0;

            if (analyserRef.current) {
              const bufferLength = analyserRef.current.frequencyBinCount;
              const dataArray = new Uint8Array(bufferLength);
              analyserRef.current.getByteFrequencyData(dataArray);

              let sum = 0;
              let weightedSum = 0;
              for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
                weightedSum += dataArray[i] * i;
              }

              const avgVolume = sum / bufferLength;
              audioVolume = Number((avgVolume / 128).toFixed(3));
              speechDetected =
                audioVolume >= (proctorConfigs.thresholds.audio?.speechThresholdRatio || 0.16);

              if (speechDetected && sum > 0) {
                const centroid = weightedSum / sum;
                spectralCentroidsRef.current.push(centroid);
                if (spectralCentroidsRef.current.length > 8) {
                  spectralCentroidsRef.current.shift();
                }

                if (spectralCentroidsRef.current.length >= 4) {
                  const centroids = spectralCentroidsRef.current;
                  const meanCentroid = centroids.reduce((a, b) => a + b, 0) / centroids.length;
                  const variance =
                    centroids.reduce((acc, c) => acc + Math.pow(c - meanCentroid, 2), 0) /
                    centroids.length;
                  const normalizedVariance = variance / (meanCentroid || 1);
                  twoSpeakerVariance = Number(normalizedVariance.toFixed(3));
                }
              }
            }

            // Send real vision results to web worker for rules & escalation
            worker.postMessage({
              type: 'ANALYZE_PROCTOR_DATA',
              payload: {
                faceCount: landmarkResult.faceCount,
                yaw: landmarkResult.yaw,
                pitch: landmarkResult.pitch,
                roll: landmarkResult.roll,
                irisOffset: landmarkResult.irisOffset,
                isLookingAway: landmarkResult.isLookingAway,
                objects: prohibitedObjects,
                identityResult,
                audioMetrics: {
                  volume: audioVolume,
                  speechDetected,
                  twoSpeakerVariance,
                  isWriteMode
                },
                timestamp: Date.now()
              }
            });
          }
        }
      } catch (err) {
        // Frame analysis error
      } finally {
        isAnalyzingRef.current = false;
      }
    },
    [videoRef, isModelsLoading, modelsError, isWriteMode, referenceEmbedding, emitProctorEvent]
  );

  // Sampling driver using requestVideoFrameCallback (with fallback to setInterval)
  useEffect(() => {
    if (!isRunning || !isEnabled || isModelsLoading || modelsError) {
      if (samplingIntervalRef.current) clearInterval(samplingIntervalRef.current);
      return;
    }

    let isCancelled = false;
    const video = videoRef?.current;

    if (video && typeof video.requestVideoFrameCallback === 'function') {
      const onFrame = (now) => {
        if (isCancelled) return;
        runVisionSampling(now);
        if (videoRef?.current && typeof videoRef.current.requestVideoFrameCallback === 'function') {
          rVFCIdRef.current = videoRef.current.requestVideoFrameCallback(onFrame);
        }
      };
      rVFCIdRef.current = video.requestVideoFrameCallback(onFrame);
    } else {
      // Fallback to setInterval
      samplingIntervalRef.current = setInterval(() => {
        if (isCancelled) return;
        runVisionSampling(performance.now());
      }, 250);
    }

    return () => {
      isCancelled = true;
      if (video && rVFCIdRef.current && typeof video.cancelVideoFrameCallback === 'function') {
        video.cancelVideoFrameCallback(rVFCIdRef.current);
      }
      if (samplingIntervalRef.current) {
        clearInterval(samplingIntervalRef.current);
      }
    };
  }, [isRunning, isEnabled, isModelsLoading, modelsError, runVisionSampling, videoRef]);

  // ----------------------------------------------------------------
  // Browser-Behaviour Listeners (Tab switch, blur, fullscreen, devtools, right-click, resize)
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!isEnabled || typeof window === 'undefined') return;

    // 1. Tab Switch (visibilitychange) & Window Focus Detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        focusLossStartTimeRef.current = Date.now();
        focusLossTypeRef.current = 'TAB_SWITCH';
        setFocusStatus('tab_switched');
      } else {
        // Returned to tab
        if (focusLossStartTimeRef.current) {
          const durationMs = Date.now() - focusLossStartTimeRef.current;
          totalFocusLossMsRef.current += durationMs;
          const durationSec = (durationMs / 1000).toFixed(1);

          setTabSwitchCount((prev) => {
            const newCount = prev + 1;
            const points = newCount === 1 ? 3 : newCount === 2 ? 6 : 10;
            applyTrustDeduction(
              `Tab switch #${newCount} (${durationSec}s away)`,
              points,
              'TAB_SWITCH',
              durationMs,
              { count: newCount, durationMs }
            );

            setLatestWarning({
              type: 'TAB_SWITCH',
              severity: newCount > 1 ? 'orange' : 'yellow',
              message: `⚠️ Tab Switched: You left the interview window for ${durationSec}s. Repeated violations reduce your trust score. (Logged #${newCount})`,
              timestamp: new Date().toISOString()
            });

            return newCount;
          });

          emitProctorEvent({
            type: 'TAB_SWITCH',
            severity: 'yellow',
            confidence: 1.0,
            durationMs,
            metadata: {
              reason: `Candidate returned after tab switch (${durationSec}s)`,
              durationMs
            }
          });

          focusLossStartTimeRef.current = null;
          focusLossTypeRef.current = null;
        }
        setFocusStatus('focused');
      }
    };

    // 2. Window Blur (lost focus to other applications / minimized)
    const handleWindowBlur = () => {
      if (!document.hidden && !focusLossStartTimeRef.current) {
        focusLossStartTimeRef.current = Date.now();
        focusLossTypeRef.current = 'WINDOW_BLUR';
        setFocusStatus('window_out_of_focus');
      }
    };

    const handleWindowFocus = () => {
      if (focusLossStartTimeRef.current && focusLossTypeRef.current === 'WINDOW_BLUR') {
        const durationMs = Date.now() - focusLossStartTimeRef.current;
        totalFocusLossMsRef.current += durationMs;
        const durationSec = (durationMs / 1000).toFixed(1);

        setTabSwitchCount((prev) => {
          const newCount = prev + 1;
          const points = newCount === 1 ? 2 : 5;
          applyTrustDeduction(
            `Window lost focus #${newCount} (${durationSec}s)`,
            points,
            'WINDOW_BLUR',
            durationMs,
            { count: newCount, durationMs }
          );

          setLatestWarning({
            type: 'WINDOW_BLUR',
            severity: 'yellow',
            message: `⚠️ Window Out of Focus: Interview window lost focus for ${durationSec}s. (Logged #${newCount})`,
            timestamp: new Date().toISOString()
          });

          return newCount;
        });

        emitProctorEvent({
          type: 'WINDOW_BLUR',
          severity: 'yellow',
          confidence: 1.0,
          durationMs,
          metadata: {
            reason: `Interview window regained focus after ${durationSec}s`,
            durationMs
          }
        });

        focusLossStartTimeRef.current = null;
        focusLossTypeRef.current = null;
      }
      setFocusStatus('focused');
    };

    // 3. Mandatory Fullscreen Exit
    const handleFullscreenChange = () => {
      const activeFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(activeFullscreen);

      if (!activeFullscreen) {
        emitProctorEvent({
          type: 'FULLSCREEN_EXIT',
          severity: 'orange',
          confidence: 1.0,
          metadata: { reason: 'Fullscreen mode exited by candidate' }
        });
      }
    };

    // 4. Copy / Cut / Paste Actions
    const handleCopy = () => {
      emitProctorEvent({
        type: 'CLIPBOARD_ACTION',
        severity: 'yellow',
        confidence: 1.0,
        metadata: { action: 'copy' }
      });
    };

    const handleCut = () => {
      emitProctorEvent({
        type: 'CLIPBOARD_ACTION',
        severity: 'yellow',
        confidence: 1.0,
        metadata: { action: 'cut' }
      });
    };

    const handlePaste = (e) => {
      const pastedData = e.clipboardData?.getData('text') || '';
      const charCount = pastedData.length;
      if (charCount >= (proctorConfigs.thresholds.browser?.largePasteChars || 80)) {
        emitProctorEvent({
          type: 'TYPING_ANOMALY_LARGE_PASTE',
          severity: 'orange',
          confidence: 0.95,
          metadata: {
            charCount,
            preview: pastedData.slice(0, 50)
          }
        });
      } else {
        emitProctorEvent({
          type: 'CLIPBOARD_ACTION',
          severity: 'yellow',
          confidence: 0.9,
          metadata: { action: 'paste', charCount }
        });
      }
    };

    // 5. Context Menu / Right-Click restriction
    const handleContextMenu = (e) => {
      e.preventDefault();
      emitProctorEvent({
        type: 'RIGHT_CLICK',
        severity: 'yellow',
        confidence: 1.0,
        metadata: { reason: 'Right-click context menu restricted' }
      });
    };

    // 6. DevTools Shortcuts & Keystroke Dynamics
    const handleKeyDown = (e) => {
      const isF12 = e.key === 'F12' || e.keyCode === 123;
      const isCtrlShiftI =
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key);
      const isCtrlU = (e.ctrlKey || e.metaKey) && ['U', 'u'].includes(e.key);

      if (isF12 || isCtrlShiftI || isCtrlU) {
        e.preventDefault();
        emitProctorEvent({
          type: 'DEVTOOLS_SHORTCUT',
          severity: 'orange',
          confidence: 1.0,
          metadata: {
            key: e.key,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            shiftKey: e.shiftKey
          }
        });
      }

      // Record keystroke timestamp for uniform cadence anomaly detection
      const now = Date.now();
      keystrokeTimestampsRef.current.push(now);
      if (keystrokeTimestampsRef.current.length > 25) {
        keystrokeTimestampsRef.current.shift();
      }

      // Evaluate IKIs when we have at least 15 keystrokes
      if (
        keystrokeTimestampsRef.current.length >= 15 &&
        now - lastKeystrokeEvalRef.current >= 4000
      ) {
        lastKeystrokeEvalRef.current = now;
        const stamps = keystrokeTimestampsRef.current;
        const ikis = [];
        for (let i = 1; i < stamps.length; i++) {
          ikis.push(stamps[i] - stamps[i - 1]);
        }
        const meanIki = ikis.reduce((a, b) => a + b, 0) / ikis.length;
        const variance =
          ikis.reduce((acc, iki) => acc + Math.pow(iki - meanIki, 2), 0) / ikis.length;
        const stdDevIki = Math.sqrt(variance);

        // Near-zero variation (< 12ms) indicates automated/scripted keystroke injection
        if (stdDevIki < (proctorConfigs.thresholds.typing?.uniformIkiStdDevMs || 12)) {
          emitProctorEvent({
            type: 'TYPING_ANOMALY_UNIFORM_KEYSTROKES',
            severity: 'orange',
            confidence: 0.94,
            metadata: {
              meanIkiMs: Math.round(meanIki),
              stdDevIkiMs: Math.round(stdDevIki),
              sampleCount: ikis.length
            }
          });
        }
      }
    };

    // 7. Window Resize & Multi-Monitor Suspicion
    const handleResize = () => {
      const screenWidth = window.screen?.width || 1920;
      const isMultiScreen =
        window.screen?.isExtended ||
        window.screenLeft < 0 ||
        window.screenLeft > screenWidth;

      emitProctorEvent({
        type: 'WINDOW_RESIZE_EXTRA_MONITOR',
        severity: 'orange',
        confidence: 0.88,
        metadata: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          screenWidth,
          isMultiScreen: Boolean(isMultiScreen)
        }
      });
    };

    // 8. Device changes
    const handleDeviceChange = () => {
      emitProctorEvent({
        type: 'DEVICE_DISCONNECTED',
        severity: 'orange',
        confidence: 0.9,
        metadata: { reason: 'Media device configuration changed' }
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);

      if (navigator.mediaDevices) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      }
    };
  }, [isEnabled, emitProctorEvent, applyTrustDeduction]);

  // Real-Time Integrity Metrics Calculation Loop (Every 1000ms)
  useEffect(() => {
    if (!isEnabled) return;

    const interval = setInterval(() => {
      const elapsed = Math.max(1000, Date.now() - sessionStartTimeRef.current);
      const currentLoss = focusLossStartTimeRef.current ? Date.now() - focusLossStartTimeRef.current : 0;
      const totalLoss = totalFocusLossMsRef.current + currentLoss;
      const retPct = Math.max(0, Math.min(100, Math.round(((elapsed - totalLoss) / elapsed) * 100)));
      setFocusRetentionPct(retPct);

      const presentMs = totalFacePresentMsRef.current + (!faceMissingStartTimeRef.current ? 1000 : 0);
      const facePct = Math.max(0, Math.min(100, Math.round((presentMs / elapsed) * 100)));
      setFacePresencePct(facePct);

      // Check camera & mic stream availability
      const stream = videoRef?.current?.srcObject;
      const vTrack = stream?.getVideoTracks?.()[0];
      const aTrack = stream?.getAudioTracks?.()[0];
      const camOk = Boolean(vTrack && vTrack.readyState === 'live' && vTrack.enabled);
      const micOk = Boolean(aTrack && aTrack.readyState === 'live' && aTrack.enabled);
      setCameraAvailable(camOk);
      setMicAvailable(micOk);
    }, 1000);

    return () => clearInterval(interval);
  }, [isEnabled, videoRef]);

  // Handle Candidate-Side Warning events from Socket.io (proctor:warning)
  useEffect(() => {
    if (!socket) return;

    const handleProctorWarning = (warningPayload) => {
      setLatestWarning(warningPayload);
      setWarnings((prev) => [warningPayload, ...prev.slice(0, 19)]);

      if (warningPayload.counts) {
        setViolationCounts(warningPayload.counts);
      }
      if (warningPayload.integrityScore !== undefined) {
        setIntegrityScore(warningPayload.integrityScore);
      }
      if (warningPayload.integrityStatus) {
        setIntegrityStatus(warningPayload.integrityStatus);
      }

      if (onWarning) {
        onWarning(warningPayload);
      }

      // Auto dismiss yellow warnings after 6 seconds; keep orange/red longer
      if (warningPayload.severity === 'yellow') {
        setTimeout(() => {
          setLatestWarning((current) =>
            current?.timestamp === warningPayload.timestamp ? null : current
          );
        }, 6000);
      }
    };

    socket.on('proctor:warning', handleProctorWarning);

    return () => {
      socket.off('proctor:warning', handleProctorWarning);
    };
  }, [socket, onWarning]);

  // ----------------------------------------------------------------
  // Helper: Detect Implausibly Fast Answer Velocity
  // ----------------------------------------------------------------
  const checkAnswerSpeed = useCallback(
    ({ text = '', durationSeconds = 1 }) => {
      const chars = text.trim().length;
      const minChars = proctorConfigs.thresholds.typing?.fastAnswerMinChars || 100;
      const maxSecs = proctorConfigs.thresholds.typing?.fastAnswerMaxSeconds || 3;

      if (chars >= minChars && durationSeconds <= maxSecs) {
        emitProctorEvent({
          type: 'IMPLAUSIBLY_FAST_ANSWER',
          severity: 'orange',
          confidence: 0.92,
          metadata: {
            charCount: chars,
            durationSeconds,
            calculatedWpm: Math.round(((chars / 5) / Math.max(1, durationSeconds)) * 60)
          }
        });
      }
    },
    [emitProctorEvent]
  );

  // ----------------------------------------------------------------
  // Helper: Check AI-Generated Text Risk Indicator (burstiness + LLM)
  // Labelled as a risk indicator only
  // ----------------------------------------------------------------
  const checkAITextRisk = useCallback(
    async (text, questionContext = '') => {
      if (!text || text.trim().length < 80) return null;
      try {
        const res = await proctorAPI.checkTextAIRisk({ text, questionContext });
        const analysis = res.data?.data;
        if (analysis?.isRiskIndicator) {
          emitProctorEvent({
            type: 'AI_TEXT_RISK_INDICATOR',
            severity: 'orange',
            confidence: analysis.confidence || 0.85,
            metadata: {
              riskScore: analysis.riskScore,
              riskLevel: analysis.riskLevel,
              burstiness: analysis.burstiness,
              rationale: analysis.rationale,
              disclaimer: analysis.disclaimer
            }
          });
        }
        return analysis;
      } catch (err) {
        return null;
      }
    },
    [emitProctorEvent]
  );

  // ----------------------------------------------------------------
  // Rolling 10-Second MediaRecorder Buffer
  // Slices video every 1000ms and retains rolling buffer for alert-only upload
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!isEnabled || typeof window === 'undefined') return;
    const stream = videoRef?.current?.srcObject;
    if (!stream || typeof MediaRecorder === 'undefined') return;

    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      rollingMediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          const now = Date.now();
          rollingChunksRef.current.push({ data: e.data, timestamp: now });
          // Purge chunks older than 11 seconds to keep rolling 10-second buffer
          const cutoff = now - 11000;
          rollingChunksRef.current = rollingChunksRef.current.filter((c) => c.timestamp >= cutoff);
        }
      };

      recorder.start(1000);
    } catch (err) {
      console.warn('Rolling MediaRecorder setup notice:', err);
    }

    return () => {
      if (rollingMediaRecorderRef.current && rollingMediaRecorderRef.current.state !== 'inactive') {
        try {
          rollingMediaRecorderRef.current.stop();
        } catch (e) {}
        rollingMediaRecorderRef.current = null;
      }
    };
  }, [isEnabled, videoRef]);

  // ----------------------------------------------------------------
  // WebRTC Live Video Stream Responder (SimplePeer)
  // Connects candidate camera feed directly to recruiter on request
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!socket || !isEnabled) return;

    let peer = null;

    const handleFeedRequested = ({ sessionId: reqSessionId, recruiterSocketId }) => {
      if (reqSessionId !== sessionId) return;
      const stream = videoRef?.current?.srcObject;
      if (!stream) return;

      if (peer) peer.destroy();

      peer = new SimplePeer({
        initiator: false,
        stream,
        trickle: true
      });

      peer.on('signal', (signal) => {
        socket.emit('webrtc:signal', {
          to: recruiterSocketId,
          signal,
          sessionId
        });
      });

      peer.on('error', (err) => {
        console.warn('Candidate WebRTC signal error:', err);
      });
    };

    const handleWebRTCSignal = ({ signal, sessionId: sigSessionId }) => {
      if (sigSessionId === sessionId && peer) {
        peer.signal(signal);
      }
    };

    const handleFeedStopped = ({ sessionId: stopSessionId }) => {
      if (stopSessionId === sessionId && peer) {
        peer.destroy();
        peer = null;
      }
    };

    socket.on('webrtc:feed_requested', handleFeedRequested);
    socket.on('webrtc:signal', handleWebRTCSignal);
    socket.on('webrtc:feed_stopped', handleFeedStopped);

    return () => {
      socket.off('webrtc:feed_requested', handleFeedRequested);
      socket.off('webrtc:signal', handleWebRTCSignal);
      socket.off('webrtc:feed_stopped', handleFeedStopped);
      if (peer) peer.destroy();
    };
  }, [socket, sessionId, isEnabled, videoRef]);

  // ----------------------------------------------------------------
  // Recruiter Session Control Listener (session:control)
  // Handles warning, pause, resume, and terminate actions from recruiter
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    const handleSessionControl = (payload) => {
      const { action, message, reason } = payload || {};
      if (action === 'warning') {
        setSessionControlState((prev) => ({
          ...prev,
          activeWarning: message || 'Proctor Warning: Please maintain focus on the exam.'
        }));
      } else if (action === 'pause') {
        setSessionControlState((prev) => ({
          ...prev,
          status: 'paused',
          reason: reason || 'Interview session has been paused by the proctor for integrity review.'
        }));
      } else if (action === 'resume') {
        setSessionControlState((prev) => ({
          ...prev,
          status: 'in_progress',
          reason: '',
          activeWarning: null
        }));
      } else if (action === 'terminate') {
        setSessionControlState((prev) => ({
          ...prev,
          status: 'terminated',
          reason: reason || 'Interview session has been terminated by the proctor.'
        }));
      }
    };

    socket.on('session:control', handleSessionControl);
    return () => {
      socket.off('session:control', handleSessionControl);
    };
  }, [socket]);

  // Dismiss currently visible warning banner
  const dismissWarning = useCallback(() => {
    setLatestWarning(null);
    setSessionControlState((prev) => ({ ...prev, activeWarning: null }));
  }, []);

  // Request fullscreen trigger
  const requestFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (err) {
      console.warn('Fullscreen request denied:', err);
    }
  }, []);

  // Inject demo violation events carrying source: 'demo' (viva fallback)
  const injectDemoEvent = useCallback((demoType) => {
    const now = new Date().toISOString();
    let demoEvent = null;

    if (demoType === 'phone') {
      demoEvent = {
        type: 'PROHIBITED_OBJECT',
        severity: 'red',
        confidence: 0.99,
        source: 'demo',
        metadata: {
          detectedObjects: [{ class: 'cell phone', score: 0.99 }],
          source: 'demo',
          isSimulated: true
        },
        timestamp: now
      };
    } else if (demoType === 'second_face') {
      demoEvent = {
        type: 'MULTIPLE_FACES',
        severity: 'red',
        confidence: 0.98,
        source: 'demo',
        metadata: {
          faceCount: 2,
          source: 'demo',
          isSimulated: true
        },
        timestamp: now
      };
    } else if (demoType === 'identity_mismatch') {
      demoEvent = {
        type: 'IDENTITY_MISMATCH',
        severity: 'red',
        confidence: 0.96,
        source: 'demo',
        metadata: {
          distance: 0.78,
          threshold: 0.50,
          source: 'demo',
          isSimulated: true
        },
        timestamp: now
      };
    }

    if (demoEvent) {
      emitProctorEvent(demoEvent);
      applyTrustDeduction(`[SIMULATED] ${demoEvent.type}`, 15, demoEvent.type, 0, demoEvent.metadata);
      setLatestWarning({
        type: demoEvent.type,
        severity: demoEvent.severity,
        message: `[SIMULATED] Test violation injected: ${demoEvent.type}`,
        timestamp: now
      });
    }
  }, [emitProctorEvent, applyTrustDeduction]);

  const totalDeductions = trustDeductions.reduce((sum, d) => sum + (d.points || 0), 0);
  const calculatedTrustScore = Math.max(0, Math.min(100, 100 - totalDeductions));

  return {
    isRunning,
    isModelsLoading,
    modelsError,
    isLowPerformanceMode,
    retryModels: initModels,
    injectDemoEvent,
    latestWarning,
    warnings,
    dismissWarning,
    violationCounts,
    integrityScore: calculatedTrustScore,
    trustScore: calculatedTrustScore,
    integrityStatus,
    sessionControlState,
    isFullscreen,
    requestFullscreen,
    captureSnapshot,
    checkAnswerSpeed,
    checkAITextRisk,
    liveFaceInFrame,
    liveGaze,
    liveEyeFocus,
    // Real-Time Integrity & Authentication Metrics
    tabSwitchCount,
    focusStatus,
    facePresenceStatus,
    cameraAvailable,
    micAvailable,
    facePresencePct,
    focusRetentionPct,
    trustDeductions,
    auditLog,
    isFaceMissingLong,
    realtimeMetrics: {
      facePresencePct,
      focusRetentionPct,
      tabSwitchCount,
      cameraAvailable,
      micAvailable,
      focusStatus,
      facePresenceStatus,
      trustScore: calculatedTrustScore,
      trustDeductions
    }
  };
}

export default useProctor;
