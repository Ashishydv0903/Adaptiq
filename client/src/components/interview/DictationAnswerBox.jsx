import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Keyboard,
  Volume2,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Radio
} from 'lucide-react';
import { VoiceRecorder } from './VoiceRecorder';

/**
 * DictationAnswerBox
 * Allows candidates to write their answers or dictate them naturally using real-time speech-to-text.
 */
export const DictationAnswerBox = ({
  answer,
  onChange,
  roundType = 'technical',
  placeholder = 'Type your answer or click Dictate to speak naturally...',
  sessionId,
  questionId,
  onVoiceSubmitted = () => {},
  submitting = false
}) => {
  // Input mode: 'write' | 'dictate' | 'audio-record'
  const [activeMode, setActiveMode] = useState('write');
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [dictationError, setDictationError] = useState('');

  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startDictation = () => {
    setDictationError('');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setActiveMode('audio-record');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript('');
      };

      recognition.onresult = (event) => {
        let finalChunk = '';
        let interimChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptText = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalChunk += transcriptText + ' ';
          } else {
            interimChunk += transcriptText;
          }
        }

        if (finalChunk) {
          onChange((prev) => (prev ? prev + ' ' + finalChunk.trim() : finalChunk.trim()));
        }
        setInterimTranscript(interimChunk);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition event error:', event.error);
        if (event.error === 'not-allowed') {
          setDictationError('Microphone permission blocked. Please allow mic access to dictate.');
        } else if (event.error === 'no-speech') {
          // Normal timeout if user was thinking
        } else {
          setDictationError(`Dictation notice: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error('Failed to start dictation:', err);
      setDictationError('Unable to start speech recognition. Switching to keyboard input.');
      setIsListening(false);
    }
  };

  const stopDictation = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  };

  const toggleDictation = () => {
    if (isListening) {
      stopDictation();
    } else {
      startDictation();
    }
  };

  const handleModeChange = (mode) => {
    if (isListening && mode !== 'dictate') {
      stopDictation();
    }
    setActiveMode(mode);
    if (mode === 'dictate' && !isListening) {
      startDictation();
    }
  };

  const wordCount = (answer || '').split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-3 pt-2">
      {/* Mode Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1B3A60] pb-2.5">
        <div className="flex items-center gap-1.5 bg-[#0B192C] p-1 rounded-xl border border-[#1B3A60]">
          <button
            type="button"
            onClick={() => handleModeChange('write')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeMode === 'write'
                ? 'bg-[#52D68A] text-[#0B192C] shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            Write Answer
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('dictate')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeMode === 'dictate'
                ? 'bg-[#52D68A] text-[#0B192C] shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            Dictate (Speak to Type)
            {isListening && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('audio-record')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeMode === 'audio-record'
                ? 'bg-[#52D68A] text-[#0B192C] shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Audio Recording Mode
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-300">
          <span>{wordCount} words</span>
          {answer && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Clear your answer text?')) onChange('');
              }}
              className="text-slate-400 hover:text-rose-400 flex items-center gap-1 text-[11px] transition"
            >
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {dictationError && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{dictationError}</span>
        </div>
      )}

      {/* Audio Recording Mode View */}
      {activeMode === 'audio-record' ? (
        <div className="space-y-3">
          <div className="p-3 bg-[#0B192C] border border-[#1B3A60] rounded-xl text-xs text-slate-300">
            Speak your answer directly. Your audio will be transcribed with high-accuracy speech AI.
          </div>
          <VoiceRecorder
            sessionId={sessionId}
            questionId={questionId}
            onVoiceSubmitted={onVoiceSubmitted}
            submitting={submitting}
            fallbackToText={() => setActiveMode('write')}
          />
        </div>
      ) : (
        /* Write & Dictate Shared Text Area View */
        <div className="space-y-2">
          {/* Active Dictation Visual Bar */}
          {activeMode === 'dictate' && (
            <div className="p-3 rounded-2xl bg-[#0B192C] border border-[#52D68A]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in shadow-inner">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleDictation}
                  className={`p-2.5 rounded-full shadow-lg transition-all ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-[#52D68A] text-[#0B192C] hover:bg-[#45C07A]'
                  }`}
                  title={isListening ? 'Pause Dictation' : 'Start Dictation'}
                >
                  {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      {isListening ? 'Listening to your voice...' : 'Dictation Paused'}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-[#52D68A] bg-[#52D68A]/10 px-1.5 py-0.5 rounded border border-[#52D68A]/30">
                      Speech-to-Text
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {isListening
                      ? 'Speak naturally — your words will automatically type into the box below.'
                      : 'Click the microphone button to resume speaking.'}
                  </p>
                </div>
              </div>

              {/* Sound Wave Animation when speaking */}
              {isListening && (
                <div className="flex items-center gap-1 px-3 py-1 bg-[#071322] rounded-xl border border-[#1B3A60]">
                  <span className="w-1 h-3 bg-[#52D68A] rounded-full animate-bounce" />
                  <span className="w-1 h-5 bg-[#52D68A] rounded-full animate-bounce [animation-delay:0.1s]" />
                  <span className="w-1 h-2 bg-[#52D68A] rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1 h-6 bg-[#52D68A] rounded-full animate-bounce [animation-delay:0.3s]" />
                  <span className="w-1 h-4 bg-[#52D68A] rounded-full animate-bounce [animation-delay:0.15s]" />
                  <span className="text-[11px] text-[#52D68A] font-semibold ml-1">Live Audio</span>
                </div>
              )}
            </div>
          )}

          {/* Text Area */}
          <div className="relative">
            <textarea
              rows={8}
              value={answer}
              onChange={(e) => onChange(e.target.value)}
              disabled={submitting}
              placeholder={placeholder}
              className="w-full bg-[#071322] border border-[#1B3A60] rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#52D68A] focus:border-transparent transition-all leading-relaxed resize-y selection:bg-[#52D68A] selection:text-[#0B192C]"
            />

            {/* Interim live preview text badge */}
            {interimTranscript && (
              <div className="absolute bottom-3 left-4 right-4 bg-[#0B192C]/90 border border-[#52D68A]/40 text-[#52D68A] text-xs p-2 rounded-xl backdrop-blur-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#52D68A] animate-ping" />
                <span className="italic truncate">{interimTranscript}...</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center text-[11px] text-slate-400 px-1">
            <span>
              💡 You can dictate parts of your answer and type edits with your keyboard anytime.
            </span>
            <span className="font-medium text-slate-300">
              {roundType === 'behavioral' ? 'STAR format recommended' : 'Plain English technical response'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DictationAnswerBox;
