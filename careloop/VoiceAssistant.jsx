import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * VoiceAssistant - Standalone Elderly-Friendly Healthcare Companion
 * 
 * Native Audio Recording with Groq Whisper Engine:
 * - Replaces Web Speech API with native navigator.mediaDevices.getUserMedia and MediaRecorder
 * - Works 100% on privacy-focused browsers like Brave, Firefox, Chrome, Edge, Safari
 * - Transcribes via Groq Whisper API (whisper-large-v3) with ultra-low latency (<250ms)
 * - Automatically sends transcript to Groq Completions (openai/gpt-oss-20b)
 * - Reads response aloud via window.speechSynthesis
 */

const GROQ_API_KEY = (typeof window !== 'undefined' && (window.CARELOOP_GROQ_KEY || localStorage.getItem('careloop_groq_key'))) || process.env.REACT_APP_GROQ_API_KEY || "";
const SYSTEM_PROMPT = "You are a warm, patient, and friendly companion for an elderly user in India. Keep all answers under two short sentences. Use simple, everyday language. You are not a doctor. If the user asks for medical advice, gently remind them to ask their family or caregiver. Never say 'I am an AI.' Always be encouraging.";

export default function VoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [textInput, setTextInput] = useState("");

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);

  // 5. TEXT-TO-SPEECH (Browser native speech synthesis)
  const speakText = useCallback((textToSpeak) => {
    if (!('speechSynthesis' in window)) {
      console.warn("Speech synthesis is not supported on this browser.");
      return;
    }

    // Always cancel ongoing speech to prevent queue lockup
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = "en-IN";
    utterance.rate = 0.9; // Clear, slower cadence for seniors

    const voices = window.speechSynthesis.getVoices();
    const indianVoice = voices.find(v => v.lang === 'en-IN' || v.lang.includes('IN'));
    if (indianVoice) {
      utterance.voice = indianVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      console.error("Speech synthesis error:", e);
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  // 4. GROQ CHAT COMPLETION HANDLER (Shared by voice and typed inputs)
  const sendMessage = useCallback(async (userText) => {
    const query = userText ? userText.trim() : "";
    if (!query) return;

    setTranscript(query);
    setTextInput(query);
    setIsLoading(true);
    setErrorMessage("");
    setAiResponse("");

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: query }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detailedMsg = errorData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
        throw new Error(detailedMsg);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content?.trim();

      if (!reply) {
        throw new Error("Received empty response from AI model.");
      }

      setAiResponse(reply);
      speakText(reply);
    } catch (err) {
      console.error("Groq API Fetch Error:", err);
      const displayErr = `API Request Failed: ${err.message || "Network Error"}`;
      setErrorMessage(displayErr);

      const failAudioMsg = "I am having trouble connecting right now. Please try again in a moment.";
      setAiResponse(failAudioMsg);

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const failUtterance = new SpeechSynthesisUtterance(failAudioMsg);
        failUtterance.lang = "en-IN";
        failUtterance.rate = 0.9;
        window.speechSynthesis.speak(failUtterance);
      }
    } finally {
      setIsLoading(false);
    }
  }, [speakText]);

  // Clean up media streams and audio context on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch (_) {}
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // 3. GROQ WHISPER TRANSCRIPTION API CALL
  const transcribeAudio = async (audioBlob, mimeType) => {
    setIsTranscribing(true);
    setErrorMessage("");

    try {
      const formData = new FormData();
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      formData.append('file', audioBlob, `audio.${ext}`);
      formData.append('model', 'whisper-large-v3');
      formData.append('prompt', 'Elderly care, medicine, health symptoms, fever, daily routines');
      formData.append('language', 'en');

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Whisper HTTP ${response.status}`);
      }

      const data = await response.json();
      const transcribedText = data.text ? data.text.trim() : '';

      if (!transcribedText) {
        setErrorMessage("Could not detect clear speech. Please tap the microphone and speak again.");
        return;
      }

      // 4. Update the "YOU SAID:" box and automatically invoke Groq completion
      setTranscript(transcribedText);
      setTextInput(transcribedText);
      sendMessage(transcribedText);

    } catch (err) {
      console.error("Whisper Transcription Error:", err);
      setErrorMessage("Speech transcription error: " + (err.message || "Network Error"));
    } finally {
      setIsTranscribing(false);
    }
  };

  // Stop recording helper
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("Error stopping recorder:", e);
      }
    }
  };

  // 1 & 2. NATIVE MICROPHONE RECORDING HANDLER (getUserMedia + MediaRecorder)
  const handleMicButtonClick = async () => {
    setErrorMessage("");

    // Prevent audio feedback: Cancel speech synthesis first
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (isSpeaking) {
      setIsSpeaking(false);
    }

    // Toggle: if currently listening, stop recording on second tap
    if (isListening) {
      stopRecording();
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone access is not supported in this browser.");
      }

      // 1. getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      // Determine supported MIME type
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = '';
        }
      }

      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // 2. Collect audio data chunks on ondataavailable
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        setIsListening(true);
        setTranscript("");
        setAiResponse("");

        // Setup silence auto-stop via AudioContext
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) {
            const audioCtx = new AudioCtx();
            audioContextRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);

            const buffer = new Uint8Array(analyser.frequencyBinCount);
            let hasSpoken = false;
            let silenceStartTime = Date.now();

            const checkAudioCadence = () => {
              if (mediaRecorder.state !== 'recording') return;
              analyser.getByteFrequencyData(buffer);
              let sum = 0;
              for (let i = 0; i < buffer.length; i++) sum += buffer[i];
              const avg = sum / buffer.length;

              if (avg > 12) {
                hasSpoken = true;
                silenceStartTime = Date.now();
              } else if (hasSpoken && (Date.now() - silenceStartTime > 1800)) {
                // Auto-stop after 1.8s of silence once user finishes speaking
                stopRecording();
                return;
              }
              requestAnimationFrame(checkAudioCadence);
            };
            requestAnimationFrame(checkAudioCadence);
          }
        } catch (_) {}
      };

      // 3. When recording stops, package audio Blob and call Groq Whisper
      mediaRecorder.onstop = async () => {
        setIsListening(false);

        // Stop stream hardware tracks
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(t => t.stop());
          mediaStreamRef.current = null;
        }

        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          try { audioContextRef.current.close(); } catch (_) {}
        }

        const chunks = audioChunksRef.current;
        if (chunks.length === 0) {
          setErrorMessage("No audio was recorded. Tap to try again.");
          return;
        }

        const actualMime = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(chunks, { type: actualMime });

        if (audioBlob.size < 500) {
          setErrorMessage("Voice sample was too short. Please speak clearly.");
          return;
        }

        await transcribeAudio(audioBlob, actualMime);
      };

      mediaRecorder.onerror = (e) => {
        console.error("MediaRecorder error:", e);
        setIsListening(false);
        setErrorMessage("Audio recording error. Please tap again.");
      };

      mediaRecorder.start(250);

    } catch (err) {
      console.error("Mic error:", err);
      setIsListening(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage("Microphone blocked! Please click 'Allow' in your browser address bar.");
      } else {
        setErrorMessage("Microphone error: " + (err.message || "Failed to access mic"));
      }
    }
  };

  // Typed Text Form Submit
  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    sendMessage(textInput);
  };

  // Visual button states
  let buttonBg = "bg-teal-600 hover:bg-teal-700 text-white";
  let buttonLabel = "Tap to Talk";
  let pulseAnimation = "";

  if (isListening) {
    buttonBg = "bg-red-600 hover:bg-red-700 text-white";
    buttonLabel = "Listening... (Tap to finish)";
    pulseAnimation = "animate-pulse ring-8 ring-red-300";
  } else if (isTranscribing) {
    buttonBg = "bg-amber-600 text-white";
    buttonLabel = "Transcribing voice...";
    pulseAnimation = "animate-pulse";
  } else if (isSpeaking) {
    buttonBg = "bg-blue-600 hover:bg-blue-700 text-white";
    buttonLabel = "Speaking...";
    pulseAnimation = "ring-8 ring-blue-300";
  } else if (isLoading) {
    buttonBg = "bg-teal-800 text-white";
    buttonLabel = "Companion is thinking...";
    pulseAnimation = "animate-pulse";
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 flex flex-col items-center justify-center font-sans antialiased">
      {/* HEADER */}
      <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2 text-center tracking-tight">
        Voice Companion
      </h2>
      <p className="text-lg sm:text-xl text-gray-600 mb-6 text-center font-medium">
        Speak into the microphone or type below.
      </p>

      {/* ERROR BANNER */}
      {errorMessage && (
        <div 
          className="w-full mb-6 p-5 bg-red-100 border-2 border-red-600 rounded-2xl text-red-900 text-lg sm:text-xl font-bold text-center flex items-center justify-center gap-3 shadow-lg transition-all"
          role="alert"
        >
          <svg className="w-8 h-8 text-red-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="leading-snug">{errorMessage}</span>
        </div>
      )}

      {/* MASSIVE CIRCULAR BUTTON (Min 150x150px) */}
      <div className="my-5 flex items-center justify-center">
        <button
          onClick={handleMicButtonClick}
          className={`w-44 h-44 sm:w-48 sm:h-48 rounded-full shadow-2xl flex flex-col items-center justify-center transition-all duration-300 transform active:scale-95 cursor-pointer select-none focus:outline-none ${buttonBg} ${pulseAnimation}`}
          aria-label={buttonLabel}
          type="button"
        >
          {isSpeaking ? (
            <svg className="w-16 h-16 sm:w-20 sm:h-20 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          ) : (
            <svg className="w-16 h-16 sm:w-20 sm:h-20 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}

          <span className="text-base sm:text-lg font-black tracking-wide text-center px-3 leading-tight">
            {buttonLabel}
          </span>
        </button>
      </div>

      {/* EXPLICIT TEXT INPUT & SEND BUTTON */}
      <form onSubmit={handleTextSubmit} className="w-full mb-6 flex items-center gap-2 bg-gray-50 border-2 border-gray-300 focus-within:border-teal-600 rounded-2xl p-1.5 shadow-sm transition-all">
        <input 
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Or type your question here..."
          className="flex-1 bg-transparent px-3 py-2 text-base text-gray-900 font-medium outline-none placeholder:text-gray-400"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={isLoading || isTranscribing || !textInput.trim()}
          className={`bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer ${isLoading || isTranscribing || !textInput.trim() ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <span>Send</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </form>

      {/* TWO LARGE HIGH-CONTRAST TEXT BOXES */}
      <div className="w-full space-y-5">
        {/* 1. USER TRANSCRIPT (YOU SAID) */}
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-amber-900 font-extrabold text-sm tracking-wider uppercase">
            <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>YOU SAID (Transcript):</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 min-h-[56px] leading-relaxed">
            {isTranscribing ? (
              <span className="text-amber-800 font-medium flex items-center gap-2 animate-pulse">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8" strokeWidth="4" className="opacity-75"></path></svg>
                Transcribing your voice with Groq Whisper...
              </span>
            ) : transcript ? (
              transcript
            ) : (
              <span className="text-gray-400 font-normal italic">
                Tap the microphone or type above. Your words will appear here...
              </span>
            )}
          </p>
        </div>

        {/* 2. COMPANION AI RESPONSE */}
        <div className="bg-teal-50 border-2 border-teal-500 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-teal-900 font-extrabold text-sm tracking-wider uppercase">
              <svg className="w-5 h-5 text-teal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span>Companion AI Response:</span>
            </div>
            <div className="flex items-center gap-2">
              {aiResponse && !isLoading && (
                <button
                  type="button"
                  onClick={() => speakText(aiResponse)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                  title="Hear Again"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                  <span>Hear Again</span>
                </button>
              )}
              {isLoading && (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black bg-teal-200 text-teal-900 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-teal-700 animate-ping"></span>
                  Companion is thinking...
                </span>
              )}
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-teal-950 min-h-[56px] leading-relaxed">
            {isLoading ? (
              <span className="text-teal-700 font-bold flex items-center gap-2 animate-pulse">
                <svg className="animate-spin h-6 w-6 text-teal-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Companion is thinking...
              </span>
            ) : aiResponse ? (
              aiResponse
            ) : (
              <span className="text-gray-400 font-normal italic">
                The companion will reply here in simple, encouraging words.
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
