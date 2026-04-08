import React, { useState, useEffect, useRef } from 'react';
import { Mic, Send, ShoppingCart, Volume2, Globe, CheckCircle2, Star, Sparkles, Languages, MicOff, Loader2, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import axios from 'axios';

// ── Language Registry ─────────────────────────────────────────────────────
// Centralized language configuration matching backend LANGUAGE_CONFIG
const LANGUAGES = [
    { code: 'en-IN', label: 'English',   native: 'English',   flag: '🇬🇧', greeting: "Hi! I'm PetpoojaBot. What can I get for you today?", speechCode: 'en-IN' },
    { code: 'hi-IN', label: 'Hindi',     native: 'हिंदी',      flag: '🇮🇳', greeting: 'नमस्ते! मैं पेटपूजा बॉट हूँ। आज आप क्या ऑर्डर करना चाहेंगे?', speechCode: 'hi-IN' },
    { code: 'gu-IN', label: 'Gujarati',  native: 'ગુજરાતી',   flag: '🇮🇳', greeting: 'નમસ્તે! હું પેટપૂજા બોટ છું. તમે શું ઓર્ડર કરવા માંગો છો?', speechCode: 'gu-IN' },
    { code: 'mr-IN', label: 'Marathi',   native: 'मराठी',     flag: '🇮🇳', greeting: 'नमस्कार! मी पेटपूजा बॉट आहे. आज तुम्हाला काय ऑर्डर करायचे आहे?', speechCode: 'mr-IN' },
    { code: 'ta-IN', label: 'Tamil',     native: 'தமிழ்',     flag: '🇮🇳', greeting: 'வணக்கம்! நான் பெட்பூஜா போட். இன்று நீங்கள் என்ன ஆர்டர் செய்ய விரும்புகிறீர்கள்?', speechCode: 'ta-IN' },
    { code: 'ml-IN', label: 'Malayalam', native: 'മലയാളം',   flag: '🇮🇳', greeting: 'നമസ്കാരം! ഞാൻ പെറ്റ്‌പൂജ ബോട്ട് ആണ്. ഇന്ന് നിങ്ങൾ എന്താണ് ഓർഡർ ചെയ്യാൻ ആഗ്രഹിക്കുന്നത്?', speechCode: 'ml-IN' },
    { code: 'ar-SA', label: 'Arabic',    native: 'العربية',    flag: '🇸🇦', greeting: '!مرحباً! أنا بوت بيت بوجا. ماذا تريد أن تطلب اليوم؟', speechCode: 'ar-SA' },
];

const VoiceOrdering = () => {
    const navigate = useNavigate();
    const { cart, addToCart, removeFromCart, updateQuantity } = useStore();

    const [language, setLanguage] = useState(null); // null = not yet chosen
    const [messages, setMessages] = useState([]);
    const [menu, setMenu] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [inputText, setInputText] = useState('');
    const [isBotSpeaking, setIsBotSpeaking] = useState(false);

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const synth = window.speechSynthesis;
    const waveIntervalRef = useRef(null);
    const [waveHeights, setWaveHeights] = useState(Array(20).fill(4));

    useEffect(() => {
        axios.get('http://localhost:3001/api/menu').then(res => setMenu(res.data.items));
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, cart]);

    // Animate waveform bars
    useEffect(() => {
        if (isListening || isBotSpeaking) {
            waveIntervalRef.current = setInterval(() => {
                setWaveHeights(Array(20).fill(0).map(() =>
                    Math.max(4, Math.floor(Math.random() * 32 + 4))
                ));
            }, 120);
        } else {
            clearInterval(waveIntervalRef.current);
            setWaveHeights(Array(20).fill(4));
        }
        return () => clearInterval(waveIntervalRef.current);
    }, [isListening, isBotSpeaking]);

    // Setup Speech Recognition per language
    useEffect(() => {
        if (!language) return;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = language;

            recognition.onstart = () => setIsListening(true);

            recognition.onresult = async (event) => {
                const text = event.results[event.resultIndex][0].transcript;
                setIsListening(false);
                await handleUserCommand(text);
            };

            recognition.onerror = (event) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
            };

            recognition.onend = () => setIsListening(false);
            recognitionRef.current = recognition;
        }
    }, [language, cart]);

    const speak = (text) => {
        if (synth.speaking) synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const langObj = LANGUAGES.find(l => l.code === language);
        utterance.lang = langObj?.speechCode || 'en-IN';
        utterance.rate = 1.0;
        setIsBotSpeaking(true);
        utterance.onend = () => setIsBotSpeaking(false);
        utterance.onerror = () => setIsBotSpeaking(false);
        synth.speak(utterance);
    };

    const handleUserCommand = async (text) => {
        if (!text.trim()) return;
        setMessages(prev => [...prev, { id: Date.now(), text, sender: 'user' }]);
        setInputText('');

        if (text.toLowerCase().includes('confirm order') || text.toLowerCase().includes('checkout')) {
            if (cart.length === 0) {
                const reply = 'Your cart is empty. Please add items.';
                setMessages(prev => [...prev, { id: Date.now() + 1, text: reply, sender: 'ai' }]);
                speak(reply);
                return;
            }
            const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const itemsReadout = cart.map(c => `${c.quantity} ${c.name}`).join(' and ');
            const confReply = `You ordered ${itemsReadout}. Total is ₹${subtotal}. Redirecting to payment.`;
            setMessages(prev => [...prev, { id: Date.now() + 1, text: confReply, sender: 'ai' }]);
            speak(confReply);
            setTimeout(() => navigate('/cart'), 2000);
            return;
        }

        try {
            const res = await axios.post('http://localhost:3001/api/ai/intent', { text, language });
            const { intent, reply } = res.data;

            if (intent && intent.action !== 'unknown') {
                const { action, itemData, itemId, quantity } = intent;

                if (action === 'add' && itemData) {
                    for (let i = 0; i < quantity; i++) addToCart(itemData);
                } else if (action === 'remove' && itemId) {
                    removeFromCart(itemId);
                } else if (action === 'increase' && itemId) {
                    updateQuantity(itemId, quantity || 1);
                } else if (action === 'decrease' && itemId) {
                    updateQuantity(itemId, -(quantity || 1));
                } else if (action === 'nav_cart' || action === 'checkout') {
                    navigate('/cart');
                    return;
                }
            }

            setMessages(prev => [...prev, { id: Date.now() + 1, text: reply, sender: 'ai' }]);
            speak(reply);

        } catch (err) {
            console.error(err);
            const errReply = "Sorry, there was an error processing that.";
            setMessages(prev => [...prev, { id: Date.now() + 1, text: errReply, sender: 'ai' }]);
            speak(errReply);
        }
    };

    const toggleListen = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            if (recognitionRef.current) {
                recognitionRef.current.lang = language;
                recognitionRef.current.start();
            }
        }
    };

    const handleLanguageSelect = (lang) => {
        const langObj = LANGUAGES.find(l => l.code === lang);
        setLanguage(lang);
        setMessages([{ id: Date.now(), text: langObj.greeting, sender: 'ai' }]);
        setTimeout(() => speak(langObj.greeting), 300);
    };

    const currentLang = LANGUAGES.find(l => l.code === language);

    // ══════════════════════════════════════════════════════════════════════
    // LANGUAGE SELECTION SPLASH SCREEN
    // ══════════════════════════════════════════════════════════════════════
    if (!language) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-6 relative overflow-hidden">
                {/* Animated background orbs */}
                <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-orange-600/10 rounded-full blur-[120px] animate-pulse pointer-events-none"></div>
                <div className="absolute bottom-[-15%] right-[-10%] w-[400px] h-[400px] bg-red-600/10 rounded-full blur-[100px] animate-pulse pointer-events-none" style={{ animationDelay: '1s' }}></div>

                <div className="relative z-10 bg-zinc-900/80 backdrop-blur-2xl rounded-[3rem] p-10 max-w-lg w-full shadow-2xl border border-white/5">
                    {/* Back button */}
                    <button
                        onClick={() => navigate('/')}
                        className="absolute top-6 right-7 text-zinc-500 hover:text-white text-sm font-semibold transition-colors"
                    >
                        ✕ Close
                    </button>

                    {/* Header icon */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="relative mb-4">
                            <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 to-red-500 rounded-full blur-2xl opacity-30 animate-pulse"></div>
                            <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-orange-500 to-red-600 flex items-center justify-center border-2 border-orange-300/20 shadow-xl shadow-orange-500/30">
                                <Languages size={36} className="text-white" />
                            </div>
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight">Choose Your Language</h1>
                        <p className="text-zinc-500 text-sm font-medium mt-2">Speak in your language — PetpoojaBot understands</p>
                    </div>

                    {/* Language Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-8">
                        {LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => handleLanguageSelect(lang.code)}
                                className="group relative flex items-center gap-3.5 px-5 py-4 rounded-2xl bg-zinc-800/70 border border-zinc-700/50 hover:border-orange-500/60 hover:bg-zinc-800 transition-all duration-300 text-left overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 to-orange-500/0 group-hover:from-orange-500/10 group-hover:to-red-500/5 transition-all duration-500"></div>
                                <span className="text-2xl relative z-10 drop-shadow-md">{lang.flag}</span>
                                <div className="flex flex-col min-w-0 relative z-10">
                                    <span className="text-white text-sm font-extrabold group-hover:text-orange-400 transition-colors truncate">{lang.native}</span>
                                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest group-hover:text-orange-400/60 transition-colors">{lang.label}</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="text-center">
                        <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.2em]">Powered by AI Voice Engine • 7 Languages</p>
                    </div>
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════════
    // ACTIVE VOICE ORDERING INTERFACE
    // ══════════════════════════════════════════════════════════════════════
    // Dynamic image helper (same as SmartMenu)
    const getDynamicImage = (name, category) => {
        const query = encodeURIComponent(name.replace(/[^a-zA-Z0-9\s]/g, '').trim() + ' ' + (category || '') + ' food');
        return `https://tse2.mm.bing.net/th?q=${query}&w=400&h=300&c=7&rs=1&p=0&dpr=2&pid=1.7&mkt=en-IN&adlt=moderate`;
    };

    return (
        <div className="h-screen flex bg-zinc-950 overflow-hidden font-sans">
            {/* ── Left Panel: AI Voice Chat ────────────────────────────────── */}
            <div className="w-[45%] h-full flex flex-col bg-zinc-900 border-r border-zinc-800 relative">
                {/* Header */}
                <div className="p-5 bg-gradient-to-r from-orange-600 via-orange-500 to-red-600 flex justify-between items-center text-white shadow-xl shadow-orange-500/10 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div
                            className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm border border-white/10 hover:bg-white/30 transition-all cursor-pointer"
                            onClick={() => setLanguage(null)}
                        >
                            <Globe size={22} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black flex items-center gap-2">
                                Copilot Voice
                                <span className="text-[9px] bg-white/25 backdrop-blur-sm text-white px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">AI</span>
                            </h1>
                            <p className="text-orange-100/80 text-xs font-semibold flex items-center gap-2 mt-0.5">
                                <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-400 animate-pulse' : isBotSpeaking ? 'bg-blue-400 animate-pulse' : 'bg-white/40'}`}></span>
                                {currentLang?.flag} {currentLang?.native}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/menu')} className="relative z-10 text-xs font-bold bg-white/15 hover:bg-white/25 px-4 py-2 rounded-xl transition-all backdrop-blur-sm border border-white/10">
                        Smart Menu →
                    </button>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-zinc-950/50 relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/50 to-zinc-950/80 pointer-events-none"></div>
                    {messages.map((msg, i) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} relative z-10`}
                        >
                            {msg.sender === 'ai' && (
                                <div className="w-8 h-8 bg-gradient-to-tr from-orange-500 to-red-600 rounded-full flex items-center justify-center mr-3 flex-shrink-0 mt-1 shadow-lg shadow-orange-500/20">
                                    <Sparkles size={14} className="text-white" />
                                </div>
                            )}
                            <div className={`max-w-[80%] px-5 py-4 rounded-[1.5rem] text-[15px] font-medium leading-relaxed shadow-md ${
                                msg.sender === 'user'
                                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-br-lg shadow-orange-500/20'
                                    : 'bg-zinc-800/80 text-zinc-100 rounded-bl-lg border border-zinc-700/50 backdrop-blur-sm'
                            }`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Audio Waveform */}
                <div className="px-6 py-3 bg-zinc-900/80 border-t border-zinc-800/50">
                    <div className="flex items-center justify-center gap-[3px] h-8">
                        {waveHeights.map((h, i) => (
                            <div
                                key={i}
                                className={`w-[3px] rounded-full transition-all duration-100 ${
                                    isBotSpeaking ? 'bg-blue-400' :
                                    isListening ? 'bg-orange-400' : 'bg-zinc-700'
                                }`}
                                style={{ height: `${h}px` }}
                            ></div>
                        ))}
                    </div>
                    <p className="text-center text-[10px] font-bold uppercase tracking-widest mt-1.5 text-zinc-500">
                        {isBotSpeaking ? '🔊 AI Speaking...' : isListening ? '🎙️ Listening...' : '● Ready'}
                    </p>
                </div>

                {/* Input Area */}
                <div className="p-5 bg-zinc-900 border-t border-zinc-800">
                    <div className="relative flex items-center bg-zinc-800/80 rounded-2xl border border-zinc-700/50 p-1.5 shadow-inner">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUserCommand(inputText)}
                            placeholder="Type your order or use voice..."
                            className="w-full p-3 pl-5 bg-transparent outline-none font-medium text-zinc-200 placeholder:text-zinc-500 text-sm"
                        />
                        <div className="flex items-center gap-2 pr-1">
                            <button
                                onClick={toggleListen}
                                className={`p-3.5 rounded-xl transition-all duration-300 flex items-center justify-center ${
                                    isListening
                                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/40 animate-pulse scale-105'
                                        : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-white border border-zinc-600/50'
                                }`}
                            >
                                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                            </button>
                            <button
                                onClick={() => handleUserCommand(inputText)}
                                className="p-3.5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl hover:shadow-lg hover:shadow-orange-500/30 transition-all duration-300 active:scale-95"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Right Panel: Scrollable Live Menu ──────────────────────── */}
            <div className="w-[55%] h-full flex flex-col bg-zinc-950 relative">
                {/* Cart Status Bar */}
                <div className="absolute top-0 w-full z-20 p-4 bg-gradient-to-b from-zinc-950 to-transparent pointer-events-none">
                    <div className="max-w-md mx-auto bg-zinc-800/90 backdrop-blur-xl rounded-2xl p-4 shadow-2xl flex items-center justify-between border border-zinc-700/50 pointer-events-auto cursor-pointer hover:bg-zinc-700/80 transition-colors" onClick={() => navigate('/cart')}>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-orange-500/20 rounded-xl text-orange-400">
                                <ShoppingCart size={22} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Live Order</p>
                                <p className="font-extrabold text-white">{cart.reduce((a, c) => a + c.quantity, 0)} Items</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total</p>
                            <p className="text-xl font-black text-orange-400">₹{cart.reduce((sum, item) => sum + item.price * item.quantity, 0)}</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pt-28 pb-10 space-y-6 flex flex-col">
                    <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-2">
                        <Sparkles size={24} className="text-orange-400" /> Interactive Menu
                    </h2>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {menu.map(item => (
                            <div key={item.id} className="bg-zinc-800/60 rounded-2xl overflow-hidden shadow-md hover:shadow-xl hover:shadow-orange-500/5 transition-all duration-500 border border-zinc-700/40 group flex flex-col backdrop-blur-sm">
                                <div className="relative h-36 overflow-hidden bg-zinc-700/30">
                                    <img
                                        src={getDynamicImage(item.name, item.category)}
                                        alt={`Image of ${item.name}`}
                                        loading="lazy"
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                        onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400"; }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/70 to-transparent pointer-events-none"></div>
                                    <div className="absolute top-3 left-3 flex gap-2">
                                        {item.isVeg ? (
                                            <span className="bg-zinc-900/80 backdrop-blur-sm text-green-400 text-[10px] px-2.5 py-1 rounded-lg font-black shadow-sm flex items-center gap-1 border border-green-500/30 uppercase">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]"></div> Veg
                                            </span>
                                        ) : (
                                            <span className="bg-zinc-900/80 backdrop-blur-sm text-red-400 text-[10px] px-2.5 py-1 rounded-lg font-black shadow-sm flex items-center gap-1 border border-red-500/30 uppercase">
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]"></div> Non-Veg
                                            </span>
                                        )}
                                        {item.engineCategory === 'Star ⭐' && (
                                            <span className="bg-yellow-500/90 text-zinc-900 text-[10px] px-2.5 py-1 rounded-lg font-black shadow-sm uppercase">
                                                ★ Best
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 flex flex-col flex-grow">
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="text-base font-bold text-white leading-tight">
                                            <span className="text-zinc-600 mr-1.5 text-sm">#{item.id}</span>
                                            {item.name}
                                        </h3>
                                        <span className="text-base font-black text-orange-400 ml-2 bg-orange-500/10 px-2 py-0.5 rounded-lg">₹{item.price}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mb-4">
                                        {item.tags?.slice(0, 2).map(t => t && (
                                            <span key={t} className="bg-zinc-700/60 text-zinc-400 text-[10px] px-2 py-0.5 rounded-md uppercase font-bold tracking-wider">{t}</span>
                                        ))}
                                    </div>
                                    <div className="mt-auto">
                                        {cart.find(c => c.id === item.id) ? (
                                            <div className="flex flex-col gap-2 bg-orange-500/10 p-2 rounded-xl border border-orange-500/20">
                                                <div className="flex items-center justify-between">
                                                    <button onClick={() => updateQuantity(item.id, -1)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-700 text-orange-400 font-black shadow-sm hover:bg-orange-500 hover:text-white transition-colors text-lg">-</button>
                                                    <span className="font-black text-lg w-8 text-center text-orange-400">{cart.find(c => c.id === item.id).quantity}</span>
                                                    <button onClick={() => addToCart(item)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-700 text-orange-400 font-black shadow-sm hover:bg-orange-500 hover:text-white transition-colors text-lg">+</button>
                                                </div>
                                                {cart.find(c => c.id === item.id).instructions && (
                                                    <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[11px] px-2 py-1 rounded-md italic font-medium w-full text-center">
                                                        Note: {cart.find(c => c.id === item.id).instructions}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => addToCart({ ...item, quantity: 1 })}
                                                className="w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 bg-zinc-700/60 text-zinc-200 border border-zinc-600/50 hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-600 hover:text-white hover:border-transparent hover:shadow-lg hover:shadow-orange-500/20 active:scale-95"
                                            >
                                                Add Item
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VoiceOrdering;
