import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api';
import {
  Mic,
  Square,
  Play,
  RotateCcw,
  Upload,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Activity,
  Sparkles,
  MessageSquare,
  Clock,
  ThumbsUp,
  FileText
} from 'lucide-react';

export const VoiceRecorder = ({
  sessionId,
  questionId,
  onVoiceSubmitted,
  submitting = false,
  fallbackToText = () => {}
}) => {
  const [recordingState, setRecordingState] = useState('idle'); // 'idle' | 'recording' | 'stopped'
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [voiceResult, setVoiceResult] = useState(null);
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  // Clean up audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [audioUrl]);

  // Start recording
  const startRecording = async () => {
    setError('');
    setVoiceResult(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        // Stop audio stream tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250); // Slice every 250ms
      setRecordingState('recording');
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Audio capture error:', err);
      setError('Microphone access was denied or is not supported. You can switch to text response.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
      clearInterval(timerIntervalRef.current);
      setRecordingState('stopped');
    }
  };

  // Reset recording
  const resetRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingState('idle');
    setRecordingSeconds(0);
    setVoiceResult(null);
    setError('');
  };

  // Submit audio for Whisper Transcription and Rubric Scoring
  const handleSubmitVoiceAnswer = async () => {
    if (!audioBlob) {
      setError('Please record your verbal response before submitting.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'response.webm');
      formData.append('questionId', questionId);
      formData.append('durationSeconds', String(recordingSeconds || 1));

      const res = await api.post(`/sessions/${sessionId}/voice-answer`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const data = res.data.data;
      setVoiceResult(data);

      if (onVoiceSubmitted) {
        onVoiceSubmitted(data);
      }
    } catch (err) {
      console.error('Voice submission error:', err);
      setError(err.response?.data?.message || 'Failed to transcribe or score audio response.');
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Voice Mode Header & Switcher */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white tracking-wide uppercase">Voice Mode Active</h4>
            <p className="text-[11px] text-slate-400">
              Speak naturally. Whisper AI transcribes and scores your delivery & fluency.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fallbackToText}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1.5 transition"
        >
          <FileText className="w-3.5 h-3.5" />
          Switch to Text Mode
        </button>
      </div>

      {/* Recording Control Studio */}
      <div className="p-6 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col items-center justify-center space-y-4">
        {/* Animated Recording Pulsar */}
        <div className="relative">
          {recordingState === 'recording' && (
            <div className="absolute -inset-3 rounded-full bg-rose-500/20 animate-ping" />
          )}

          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center border-2 transition-all ${
              recordingState === 'recording'
                ? 'bg-rose-500/20 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/20'
                : recordingState === 'stopped'
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                : 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400'
            }`}
          >
            <Mic className={`w-8 h-8 ${recordingState === 'recording' ? 'animate-pulse' : ''}`} />
          </div>
        </div>

        {/* Timer display */}
        <div className="text-center space-y-1">
          <div className="text-2xl font-mono font-bold text-white">
            {formatTime(recordingSeconds)}
          </div>
          <p className="text-xs text-slate-400">
            {recordingState === 'idle' && 'Click Start to record your answer'}
            {recordingState === 'recording' && 'Listening & capturing acoustic speech...'}
            {recordingState === 'stopped' && 'Recording complete. Review or submit.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {recordingState === 'idle' && (
            <button
              type="button"
              onClick={startRecording}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition"
            >
              <Mic className="w-4 h-4" /> Start Recording
            </button>
          )}

          {recordingState === 'recording' && (
            <button
              type="button"
              onClick={stopRecording}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-rose-600/25 flex items-center gap-2 transition animate-pulse"
            >
              <Square className="w-4 h-4 fill-current" /> Stop Recording
            </button>
          )}

          {recordingState === 'stopped' && (
            <>
              <button
                type="button"
                onClick={resetRecording}
                disabled={uploading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Retake
              </button>

              <button
                type="button"
                onClick={handleSubmitVoiceAnswer}
                disabled={uploading || submitting}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Transcribing & Scoring...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" /> Submit Voice Answer
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Audio Player Preview */}
        {audioUrl && recordingState === 'stopped' && (
          <div className="w-full max-w-md pt-2">
            <audio src={audioUrl} controls className="w-full h-10 rounded-xl" />
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Voice Evaluation & Delivery Results Card */}
      {voiceResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>Voice Response Transcribed & Certified</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Delivery Score: <strong className="text-white">{voiceResult.voiceMetrics?.deliveryScore || 85}/100</strong>
            </span>
          </div>

          {/* Transcript Snippet */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Whisper AI Transcript
            </span>
            <p className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-200 leading-relaxed italic">
              "{voiceResult.transcript}"
            </p>
          </div>

          {/* Speech Metrics HUD */}
          {voiceResult.voiceMetrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">Pace (WPM)</span>
                <span className="text-lg font-bold font-mono text-indigo-400">
                  {voiceResult.voiceMetrics.wpm}
                </span>
                <span className="text-[10px] text-slate-400 block capitalize">
                  {voiceResult.voiceMetrics.paceRating}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">Filler Words</span>
                <span className="text-lg font-bold font-mono text-amber-400">
                  {voiceResult.voiceMetrics.fillerCount}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {voiceResult.voiceMetrics.fillerRatio}% ratio
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">Pause Ratio</span>
                <span className="text-lg font-bold font-mono text-purple-400">
                  {voiceResult.voiceMetrics.pauseRatio}%
                </span>
                <span className="text-[10px] text-slate-400 block">Hesitation rate</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] uppercase text-slate-500 block font-semibold">Delivery Score</span>
                <span className="text-lg font-bold font-mono text-emerald-400">
                  {voiceResult.voiceMetrics.deliveryScore}/100
                </span>
                <span className="text-[10px] text-emerald-300 block">Fluency Rating</span>
              </div>
            </div>
          )}

          {/* Filler Word Badges */}
          {voiceResult.voiceMetrics?.detectedFillers && Object.keys(voiceResult.voiceMetrics.detectedFillers).length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Detected Fillers:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(voiceResult.voiceMetrics.detectedFillers).map(([word, cnt]) => (
                  <span
                    key={word}
                    className="px-2 py-0.5 rounded-md text-[11px] bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono"
                  >
                    "{word}": {cnt}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Coaching Recommendations */}
          {voiceResult.voiceMetrics?.coachingTips && voiceResult.voiceMetrics.coachingTips.length > 0 && (
            <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-1.5">
              <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Delivery Coaching Recommendations:
              </span>
              <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                {voiceResult.voiceMetrics.coachingTips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;