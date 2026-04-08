import { useState, useEffect, useRef } from 'react';
import { PhoneOff, Mic, MicOff, Volume2, User, Loader2, Globe, Languages, Phone, Sparkles } from 'lucide-react';

const VoiceCallInterface = ({ onClose }) => {
    const [callStatus, setCallStatus] = useState('idle'); // idle, connecting, active, ended
    const [isMuted, setIsMuted] = useState(false);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState(null);
    const [selectedLanguage, setSelectedLanguage] = useState(null); // null = not yet chosen
    const [aiTranscript, setAiTranscript] = useState(''); // last AI spoken text
    const [isAiSpeaking, setIsAiSpeaking] = useState(false);
    const [waveHeights, setWaveHeights] = useState(Array(24).fill(4));

    const clientRef = useRef(null);
    const localAudioTrackRef = useRef(null);
    const timerRef = useRef(null);
    const waveIntervalRef = useRef(null);

    // ── Language Registry ─────────────────────────────────────────────────
    // Matches the backend LANGUAGE_CONFIG exactly
    const LANGUAGES = [
        { code: 'english',   label: 'English',   native: 'English',   flag: '🇬🇧', color: 'from-blue-500 to-indigo-600' },
        { code: 'hindi',     label: 'Hindi',     native: 'हिंदी',      flag: '🇮🇳', color: 'from-orange-500 to-amber-600' },
        { code: 'gujarati',  label: 'Gujarati',  native: 'ગુજરાતી',   flag: '🇮🇳', color: 'from-green-500 to-emerald-600' },
        { code: 'marathi',   label: 'Marathi',   native: 'मराठी',     flag: '🇮🇳', color: 'from-purple-500 to-violet-600' },
        { code: 'tamil',     label: 'Tamil',     native: 'தமிழ்',     flag: '🇮🇳', color: 'from-red-500 to-rose-600' },
        { code: 'malayalam', label: 'Malayalam', native: 'മലയാളം',   flag: '🇮🇳', color: 'from-teal-500 to-cyan-600' },
        { code: 'arabic',    label: 'Arabic',    native: 'العربية',    flag: '🇸🇦', color: 'from-emerald-500 to-green-600' },
    ];

    useEffect(() => {
        return () => {
            leaveCall();
            if (timerRef.current) clearInterval(timerRef.current);
            if (waveIntervalRef.current) clearInterval(waveIntervalRef.current);
        };
    }, []);

    // Animate waveform bars
    useEffect(() => {
        if (callStatus === 'active') {
            waveIntervalRef.current = setInterval(() => {
                setWaveHeights(Array(24).fill(0).map(() =>
                    Math.max(3, Math.floor(Math.random() * 28 + 4))
                ));
            }, 130);
        } else {
            if (waveIntervalRef.current) clearInterval(waveIntervalRef.current);
            setWaveHeights(Array(24).fill(4));
        }
        return () => { if (waveIntervalRef.current) clearInterval(waveIntervalRef.current); };
    }, [callStatus]);

    const startCall = async () => {
        try {
            setCallStatus('connecting');
            console.log('VoiceBot: Connecting to AI Agent via WebSocket...');
            clientRef.current = new WebSocket('ws://localhost:8002/ws/voice-call');

            clientRef.current.onopen = async () => {
                setCallStatus('active');
                startTimer();
                console.log('VoiceBot: Connected to AI Agent.');

                // Send the selected language to the backend as the first message
                if (selectedLanguage) {
                    clientRef.current.send(JSON.stringify({ type: 'language_select', language: selectedLanguage }));
                }

                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
                const source = audioContext.createMediaStreamSource(stream);
                const processor = audioContext.createScriptProcessor(4096, 1, 1);

                source.connect(processor);
                processor.connect(audioContext.destination);

                processor.onaudioprocess = (e) => {
                    if (clientRef.current && clientRef.current.readyState === WebSocket.OPEN) {
                        const float32Data = e.inputBuffer.getChannelData(0);
                        const int16Data = new Int16Array(float32Data.length);
                        for (let i = 0; i < float32Data.length; i++) {
                            const s = Math.max(-1, Math.min(1, float32Data[i]));
                            int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                        }
                        clientRef.current.send(int16Data.buffer);
                    }
                };

                localAudioTrackRef.current = { stream, processor, audioContext };
            };

            // Receive TTS audio bytes back from AI
            clientRef.current.onmessage = async (event) => {
                if (event.data instanceof Blob) {
                    setIsAiSpeaking(true);
                    const audioUrl = URL.createObjectURL(event.data);
                    const audio = new Audio(audioUrl);
                    audio.onended = () => setIsAiSpeaking(false);
                    audio.play();
                } else if (typeof event.data === 'string') {
                    try {
                        const msg = JSON.parse(event.data);
                        if (msg.transcript) setAiTranscript(msg.transcript);
                    } catch { /* binary data, ignore */ }
                }
            };

            clientRef.current.onerror = () => {
                setError('Could not reach the AI agent. Ensure the voice server is running on port 8002.');
                setCallStatus('idle');
            };

            clientRef.current.onclose = () => {
                if (callStatus === 'active') {
                    setCallStatus('ended');
                }
            };
        } catch (err) {
            console.error('Failed to start call:', err);
            setError('Could not connect to the restaurant. Please try again.');
            setCallStatus('idle');
        }
    };

    const leaveCall = () => {
        if (localAudioTrackRef.current) {
            if (localAudioTrackRef.current.stream) {
                localAudioTrackRef.current.stream.getTracks().forEach(track => track.stop());
                localAudioTrackRef.current.processor.disconnect();
                if (localAudioTrackRef.current.audioContext.state !== 'closed') {
                    localAudioTrackRef.current.audioContext.close();
                }
            }
        }
        if (clientRef.current) {
            clientRef.current.close();
        }
        setCallStatus('ended');
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeout(() => { onClose(); }, 1500);
    };

    const startTimer = () => {
        timerRef.current = setInterval(() => {
            setDuration(prev => prev + 1);
        }, 1000);
    };

    const toggleMute = () => {
        if (localAudioTrackRef.current) {
            const track = localAudioTrackRef.current.stream
                ? localAudioTrackRef.current.stream.getAudioTracks()[0]
                : null;
            if (track) {
                track.enabled = isMuted;
            }
            setIsMuted(!isMuted);
        }
    };

    const formatDuration = (s) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleLanguageSelect = (langCode) => {
        setSelectedLanguage(langCode);
        startCall();
    };

    // ══════════════════════════════════════════════════════════════════════
    // LANGUAGE SELECTION SCREEN
    // ══════════════════════════════════════════════════════════════════════
    if (!selectedLanguage) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-2xl">
                <div className="relative bg-zinc-900 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5 flex flex-col items-center p-8">
                    {/* Ambient glow */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-orange-500/10 rounded-full blur-[80px] pointer-events-none"></div>

                    {/* Close */}
                    <button onClick={onClose} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors z-10">
                        <PhoneOff size={18} />
                    </button>

                    {/* Header Icon */}
                    <div className="relative mb-6 mt-2 z-10">
                        <div className="absolute inset-0 bg-orange-500/25 rounded-full blur-3xl animate-pulse"></div>
                        <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-orange-500 to-red-600 flex items-center justify-center border-2 border-zinc-800 shadow-xl shadow-orange-500/30">
                            <Phone size={32} className="text-white" />
                        </div>
                    </div>

                    <h2 className="text-2xl font-black text-white mb-1 z-10">Start Voice Call</h2>
                    <p className="text-zinc-500 text-xs font-medium mb-6 z-10 text-center px-4">Choose your language to begin speaking with our AI ordering assistant</p>

                    {/* Language Grid */}
                    <div className="w-full grid grid-cols-2 gap-2.5 mb-6 z-10">
                        {LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => handleLanguageSelect(lang.code)}
                                className="group relative flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 hover:border-orange-500/60 hover:bg-zinc-800 transition-all duration-300 text-left overflow-hidden"
                            >
                                <div className={`absolute inset-0 bg-gradient-to-r ${lang.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}></div>
                                <span className="text-xl relative z-10">{lang.flag}</span>
                                <div className="flex flex-col min-w-0 relative z-10">
                                    <span className="text-white text-sm font-bold group-hover:text-orange-400 transition-colors truncate">{lang.native}</span>
                                    <span className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider">{lang.label}</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest text-center z-10">
                        Powered by AI Voice Engine • 7 Languages
                    </div>
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════════
    // ACTIVE CALL SCREEN
    // ══════════════════════════════════════════════════════════════════════
    const currentLang = LANGUAGES.find(l => l.code === selectedLanguage);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-2xl">
            <div className="relative bg-zinc-900 w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl border border-white/5 flex flex-col items-center p-8">
                {/* Ambient glow behind card */}
                <div className={`absolute top-[-30%] w-72 h-72 rounded-full blur-[100px] pointer-events-none transition-all duration-1000 ${
                    isAiSpeaking ? 'bg-blue-500/15 scale-125' :
                    callStatus === 'active' ? 'bg-orange-500/10' : 'bg-zinc-800/20'
                }`}></div>

                {/* Header */}
                <div className="w-full flex justify-between items-center mb-6 relative z-10">
                    <div className="flex items-center gap-2.5">
                        <span className="text-lg">{currentLang?.flag}</span>
                        <span className="text-zinc-400 text-xs font-black uppercase tracking-widest">
                            {currentLang?.native || 'AI Call'}
                        </span>
                    </div>
                    <button onClick={leaveCall} className="text-zinc-500 hover:text-red-400 transition-colors">
                        <PhoneOff size={18} />
                    </button>
                </div>

                {/* Profile Visual */}
                <div className="relative mb-8 z-10">
                    <div className={`absolute inset-0 rounded-full blur-3xl transition-all duration-700 ${
                        isAiSpeaking ? 'bg-blue-500/30 scale-125 animate-pulse' :
                        callStatus === 'active' ? 'bg-orange-500/20 animate-pulse' :
                        'bg-zinc-700/20'
                    }`}></div>
                    <div className={`relative w-28 h-28 rounded-full flex items-center justify-center border-4 shadow-xl overflow-hidden transition-all duration-500 ${
                        isAiSpeaking ? 'bg-gradient-to-tr from-blue-500 to-cyan-500 border-blue-700 scale-105' :
                        callStatus === 'active' ? 'bg-gradient-to-tr from-orange-500 to-red-600 border-zinc-800' :
                        'bg-zinc-800 border-zinc-700'
                    }`}>
                        {callStatus === 'active' ? (
                            <div className="flex flex-col items-center">
                                {isAiSpeaking ? (
                                    <>
                                        <Volume2 size={32} className="text-white animate-bounce" />
                                        <span className="text-[9px] font-black text-white/80 mt-0.5 uppercase tracking-tighter">Speaking</span>
                                    </>
                                ) : (
                                    <>
                                        <Mic size={32} className="text-white opacity-60" />
                                        <span className="text-[9px] font-black text-white/80 mt-0.5 uppercase tracking-tighter">Listening</span>
                                    </>
                                )}
                            </div>
                        ) : callStatus === 'connecting' ? (
                            <Loader2 size={32} className="text-white animate-spin" />
                        ) : callStatus === 'ended' ? (
                            <PhoneOff size={32} className="text-zinc-500" />
                        ) : (
                            <User size={40} className="text-zinc-500" />
                        )}
                    </div>
                </div>

                {/* Status & Name */}
                <div className="text-center mb-5 w-full relative z-10">
                    <h2 className="text-xl font-black text-white mb-1.5">PetpoojaBot Agent</h2>
                    {callStatus === 'connecting' ? (
                        <div className="flex items-center justify-center gap-2 text-orange-400">
                            <Loader2 size={14} className="animate-spin" />
                            <span className="text-xs font-bold">Establishing connection...</span>
                        </div>
                    ) : callStatus === 'active' ? (
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-green-500 text-xs font-bold flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                Live Order Line
                            </span>
                            <span className="text-zinc-400 font-mono text-lg tabular-nums">{formatDuration(duration)}</span>
                        </div>
                    ) : callStatus === 'ended' ? (
                        <span className="text-zinc-500 text-xs font-medium">Call ended</span>
                    ) : null}

                    {error && <p className="text-red-500 text-[11px] mt-3 px-4 leading-tight">{error}</p>}
                </div>

                {/* AI Transcript Bubble */}
                {aiTranscript && callStatus === 'active' && (
                    <div className="w-full mb-5 px-2 relative z-10">
                        <div className="bg-zinc-800/60 border border-zinc-700/40 rounded-2xl p-4 relative overflow-hidden">
                            <Volume2 size={60} className="absolute -right-3 -bottom-3 text-zinc-700/10 rotate-[-15deg]" />
                            <p className="text-sm font-semibold text-zinc-300 relative z-10 leading-relaxed">
                                "{aiTranscript}"
                            </p>
                        </div>
                    </div>
                )}

                {/* Audio Waveform Visualizer */}
                {callStatus === 'active' && (
                    <div className="flex items-center gap-[2.5px] mb-5 h-8 relative z-10">
                        {waveHeights.map((h, i) => (
                            <div
                                key={i}
                                className={`w-[2.5px] rounded-full transition-all duration-100 ${
                                    isAiSpeaking ? 'bg-blue-400' : isMuted ? 'bg-zinc-700' : 'bg-orange-400'
                                }`}
                                style={{ height: `${h}px` }}
                            ></div>
                        ))}
                    </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-5 mt-auto relative z-10">
                    <button
                        onClick={toggleMute}
                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                            isMuted
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700/50'
                        }`}
                    >
                        {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                    </button>

                    <button
                        onClick={leaveCall}
                        className="w-18 h-18 p-5 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-red-900/40 transform hover:scale-110 active:scale-95 transition-all"
                    >
                        <PhoneOff size={28} />
                    </button>

                    <button className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 border ${
                        isAiSpeaking
                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                            : 'bg-zinc-800 text-white hover:bg-zinc-700 border-zinc-700/50'
                    }`}>
                        <Volume2 size={22} />
                    </button>
                </div>

                <div className="mt-8 text-zinc-600 text-[10px] font-bold uppercase tracking-widest text-center relative z-10">
                    Speak now to place your food order
                </div>
            </div>
        </div>
    );
};

export default VoiceCallInterface;
