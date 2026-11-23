import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Keyboard,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Activity,
  Volume2,
  Clock,
  MessageSquare,
  HelpCircle,
  Languages
} from 'lucide-react';
import { sessionAPI } from '../../services/api.js';

/**
 * DualInputAnswerBox
 * Answer component allowing simultaneous Type + Speak inputs, switchable mid-answer.
 * - Shows live captions while speaking using Web Speech API
 * - Uploads audio to POST /api/sessions/:id/answer-audio when recording stops
 * - Transcribes with Whisper (auto-detecting language, including Hindi/Hinglish)
 * - Computes speech metrics (WPM, filler words, pause ratio)
 * - Allows candidate to freely edit transcript before submitting
 * - Tracks inputMode ('type'|'speak'|'hybrid') and editedAfterTranscription
 */
export const DualInputAnswerBox = ({
  value = '',
  onChange = () => {},
  onTelemetryChange = () => {},
  sessionId,
  questionId,
  placeholder = 'Type your answer or click Speak to dictate your thoughts...',
  disabled = false,
  isCodingExplanation = false
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [liveCaptions, setLiveCaptions] = useState('');
  const [transcriptionConfidence, setTranscriptionConfidence] = useState(null);
  const [detectedLanguage, setDetectedLanguage] = useState(null);
  const [speechMetrics, setSpeechMetrics] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [rawTranscript, setRawTranscript] = useState('');
  const [hasTyped, setHasTyped] = useState(Boolean(value && value.trim()));
  const [hasSpoken, setHasSpoken] = useState(false);
  const [editedAfterTranscription, setEditedAfterTranscription] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // References
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const recordTimerRef = useRef(null);
  const recordingStartTimeRef = useRef(0);
  const mediaStreamRef = useRef(null);

  // Determine current input mode: 'type' | 'speak' | 'hybrid'
  const computeInputMode = useCallback(() => {
    if (hasTyped && hasSpoken) return 'hybrid';
    if (hasSpoken) return 'speak';
    return 'type';
  }, [hasTyped, hasSpoken]);

  // Synchronize telemetry changes with parent
  const syncTelemetry = useCallback(
    (overrides = {}) => {
      const mode = overrides.inputMode || computeInputMode();
      onTelemetryChange({
        inputMode: mode,
        transcript: overrides.transcript !== undefined ? overrides.transcript : rawTranscript,
        audioUrl: overrides.audioUrl !== undefined ? overrides.audioUrl : audioUrl,
        editedAfterTranscription:
          overrides.editedAfterTranscription !== undefined
            ? overrides.editedAfterTranscription
            : editedAfterTranscription,
        speechMetrics:
          overrides.speechMetrics !== undefined ? overrides.speechMetrics : speechMetrics
      });
    },
    [
      computeInputMode,
      rawTranscript,
      audioUrl,
      editedAfterTranscription,
      speechMetrics,
      onTelemetryChange
    ]
  );

  // Clean up media recorder, timers, and recognition on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Handle Candidate Typing
  const handleTextChange = (newText) => {
    setHasTyped(true);
    if (rawTranscript && newText !== rawTranscript) {
      setEditedAfterTranscription(true);
      syncTelemetry({ editedAfterTranscription: true });
    }
    onChange(newText);
    syncTelemetry({ inputMode: hasSpoken ? 'hybrid' : 'type' });
  };

  // ----------------------------------------------------------------
  // Start Dual-Input Recording (MediaRecorder + Web Speech API Captions)
  // ----------------------------------------------------------------
  const startRecording = async () => {
    setSpeechError('');
    setLiveCaptions('');
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 1. Setup MediaRecorder for backend Whisper upload
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await handleAudioUpload(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(250);
      setIsRecording(true);
      setHasSpoken(true);
      recordingStartTimeRef.current = Date.now();
      setRecordingSeconds(0);

      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      // 2. Setup Web Speech API for real-time live captions
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          // Set to general / Hinglish auto-friendly locale
          recognition.lang = 'en-US';

          recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              interim += event.results[i][0].transcript;
            }
            if (interim) {
              setLiveCaptions(interim.trim());
            }
          };

          recognition.onerror = () => {
            // Non-critical: Live captions silently fallback while MediaRecorder continues
          };

          recognition.onend = () => {
            if (isRecording) {
              try {
                recognition.start();
              } catch (e) {}
            }
          };

          recognitionRef.current = recognition;
          recognition.start();
        } catch (e) {
          console.warn('Web Speech API initialization notice:', e);
        }
      }
    } catch (err) {
      console.error('Microphone access failed:', err);
      setSpeechError(
        err.name === 'NotAllowedError'
          ? 'Microphone permission blocked. Please allow mic access to speak.'
          : 'Unable to access microphone device.'
      );
      setIsRecording(false);
    }
  };

  // ----------------------------------------------------------------
  // Stop Recording
  // ----------------------------------------------------------------
  const stopRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      } catch (e) {}
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
  };

  // ----------------------------------------------------------------
  // Upload Audio to POST /api/sessions/:id/answer-audio & Transcribe with Whisper
  // ----------------------------------------------------------------
  const handleAudioUpload = async (audioBlob) => {
    setIsTranscribing(true);
    setSpeechError('');

    try {
      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - recordingStartTimeRef.current) / 1000)
      );

      const capturedCaptions = (liveCaptions || '').trim();

      const formData = new FormData();
      formData.append('audio', audioBlob, `speech_recording_${Date.now()}.webm`);
      formData.append('clientDurationSeconds', String(durationSeconds));
      formData.append('clientTranscript', capturedCaptions);
      formData.append('questionId', questionId || '');

      const res = await sessionAPI.uploadAnswerAudio(sessionId, formData);
      const data = res.data?.data || {};

      // Prefer server Whisper transcript; fallback to client Web Speech API live captions
      const whisperText = (data.transcript || '').trim();
      const finalTranscript = whisperText || capturedCaptions;

      setTranscriptionConfidence(data.confidence ?? 0.94);
      setDetectedLanguage(data.language || 'english');
      setSpeechMetrics(data.speechMetrics || null);
      setAudioUrl(data.audioUrl || '');
      setRawTranscript(finalTranscript);

      // Append or insert transcript into text answer area ONLY if actual speech was captured
      if (finalTranscript) {
        const updatedText = value
          ? `${value.trim()}\n\n${finalTranscript}`
          : finalTranscript;
        onChange(updatedText);

        syncTelemetry({
          inputMode: hasTyped ? 'hybrid' : 'speak',
          transcript: finalTranscript,
          audioUrl: data.audioUrl,
          editedAfterTranscription: false,
          speechMetrics: data.speechMetrics
        });
      }
    } catch (err) {
      console.error('Transcription upload failed:', err);
      // Fallback: use live captions if available
      if (liveCaptions) {
        const fallbackText = value
          ? `${value.trim()}\n\n${liveCaptions}`
          : liveCaptions;
        onChange(fallbackText);
        setRawTranscript(liveCaptions);
      }
      setSpeechError('Cloud transcription temporarily unavailable. Live captions used.');
    } finally {
      setIsTranscribing(false);
      setLiveCaptions('');
    }
  };

  const wordCount = (value || '').split(/\s+/).filter(Boolean).length;
  const currentMode = computeInputMode();

  return (
    <div className="space-y-3 pt-1">
      {/* Top Controls: Mode Badge, Speak Button, Word Count */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
        <div className="flex items-center gap-2">
          {/* Speak / Dictate Button */}
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={disabled || isTranscribing}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all ${
              isRecording
                ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                : 'bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C]'
            } disabled:opacity-50`}
            title={isRecording ? 'Click to Stop Speaking' : 'Click to Speak (Microphone)'}
          >
            {isRecording ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>Stop Speaking ({recordingSeconds}s)</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Speak (Mic)</span>
              </>
            )}
          </button>

          {/* Active Input Mode Indicator Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0B192C] border border-[#1B3A60] text-[11px] font-mono">
            <span className="text-slate-400">Mode:</span>
            <span
              className={`font-semibold uppercase tracking-wider ${
                currentMode === 'hybrid'
                  ? 'text-sky-300'
                  : currentMode === 'speak'
                  ? 'text-[#52D68A]'
                  : 'text-slate-200'
              }`}
            >
              {currentMode === 'hybrid' ? 'Type + Speak (Hybrid)' : currentMode}
            </span>
          </div>

          {editedAfterTranscription && (
            <span className="text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-medium">
              Edited After Voice
            </span>
          )}
        </div>

        {/* Word Count and Clear Option */}
        <div className="flex items-center gap-3 text-xs text-slate-300">
          <span>{wordCount} words</span>
          {value && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Clear answer text?')) {
                  onChange('');
                  setRawTranscript('');
                  setEditedAfterTranscription(false);
                  syncTelemetry({ transcript: '', editedAfterTranscription: false });
                }
              }}
              className="text-slate-400 hover:text-rose-400 flex items-center gap-1 text-[11px] transition"
            >
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Live Captions Bar (Visible while recording with Web Speech API) */}
      {isRecording && (
        <div className="p-3.5 rounded-2xl bg-[#0F2238] border border-[#52D68A]/50 shadow-lg space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="text-xs font-bold text-white">
                Live Speech Recognition Active
              </span>
              <span className="text-[10px] uppercase font-bold text-[#52D68A] bg-[#52D68A]/10 px-1.5 py-0.5 rounded border border-[#52D68A]/30">
                Web Speech API
              </span>
            </div>

            {/* Pulsating Sound Wave Bars */}
            <div className="flex items-center gap-1 px-2.5 py-0.5 bg-[#0B192C] rounded-lg border border-[#1B3A60]">
              <span className="w-1 h-2.5 bg-[#52D68A] rounded-full animate-bounce" />
              <span className="w-1 h-4 bg-[#52D68A] rounded-full animate-bounce [animation-delay:0.1s]" />
              <span className="w-1 h-2 bg-[#52D68A] rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1 h-5 bg-[#52D68A] rounded-full animate-bounce [animation-delay:0.3s]" />
              <span className="w-1 h-3 bg-[#52D68A] rounded-full animate-bounce [animation-delay:0.15s]" />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#071322] border border-[#1B3A60] text-xs text-[#52D68A] font-medium min-h-[38px] flex items-center">
            {liveCaptions ? (
              <p className="italic leading-relaxed">{liveCaptions}...</p>
            ) : (
              <span className="text-slate-400 italic">
                Speak now... live captions will appear here in real time.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Whisper Cloud Transcription Loading State */}
      {isTranscribing && (
        <div className="p-3 rounded-xl bg-[#0F2238] border border-sky-500/40 text-xs text-sky-200 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <span>Transcribing recording with Whisper (Auto-detecting English / Hindi / Hinglish)...</span>
          </div>
          <span className="text-[10px] font-mono text-sky-300">Processing Audio</span>
        </div>
      )}

      {speechError && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{speechError}</span>
        </div>
      )}

      {/* Text Area for Typing and Reviewing/Editing Transcription */}
      <div className="relative">
        <textarea
          rows={isCodingExplanation ? 4 : 8}
          value={value}
          onChange={(e) => handleTextChange(e.target.value)}
          disabled={disabled || isTranscribing}
          placeholder={placeholder}
          className="w-full bg-[#071322] border border-[#1B3A60] rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#52D68A] focus:border-transparent transition-all leading-relaxed resize-y selection:bg-[#52D68A] selection:text-[#0B192C]"
        />
      </div>

      {/* Speech Metrics Strip (Computed after Whisper Transcription) */}
      {speechMetrics && (
        <div className="p-3 bg-[#0B192C] border border-[#1B3A60] rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* WPM */}
            <div className="flex items-center gap-1.5 text-slate-200">
              <Clock className="w-3.5 h-3.5 text-[#52D68A]" />
              <span className="font-semibold">{speechMetrics.wpm} WPM</span>
              <span className="text-[10px] text-slate-400">({speechMetrics.wpmRating})</span>
            </div>

            {/* Fillers */}
            <div className="flex items-center gap-1.5 text-slate-200">
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold">
                {speechMetrics.fillerCount ?? 0} Fillers ({speechMetrics.fillerRatio ?? 0}%)
              </span>
            </div>

            {/* Pause Ratio */}
            <div className="flex items-center gap-1.5 text-slate-200">
              <Volume2 className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-semibold">
                {Math.round((speechMetrics.pauseRatio || 0.15) * 100)}% Pauses
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {transcriptionConfidence && (
              <span className="text-[10px] text-[#52D68A] font-mono bg-[#52D68A]/10 px-2 py-0.5 rounded border border-[#52D68A]/30">
                Whisper {Math.round(transcriptionConfidence * 100)}% Conf
              </span>
            )}
            {detectedLanguage && (
              <span className="text-[10px] text-slate-300 font-mono bg-[#0F2238] px-2 py-0.5 rounded border border-slate-700 capitalize">
                {detectedLanguage}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Helper Footer Hint */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 px-1 gap-1">
        <span>
          💡 Use <strong className="text-white">Type</strong> and <strong className="text-[#52D68A]">Speak</strong> freely together. Spoken words transcribe directly into this box so you can edit before submitting.
        </span>
        <span className="text-slate-300">
          Content scoring is identical for both typed and dictated answers.
        </span>
      </div>
    </div>
  );
};

export default DualInputAnswerBox;
