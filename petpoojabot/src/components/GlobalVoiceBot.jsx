import React, { useState, useEffect, useRef } from 'react';
import { Mic, Globe, X, Volume2, MapPin, CheckCircle2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store';
import axios from 'axios';

const GlobalVoiceBot = () => {
    const { cart, addToCart, removeFromCart, updateQuantity, deliveryAddress, setDeliveryAddress, setCurrentOrder, clearCart, setLastVoiceAddedId } = useStore();
    const navigate = useNavigate();
    const location = useLocation();

    const [isOpen, setIsOpen] = useState(false);
    const [language, setLanguage] = useState('en-IN'); // en-IN, hi-IN, gu-IN
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [botReply, setBotReply] = useState('Hi! Select your language or just start speaking.');

    // ── Conversation state machine ────────────────────────────────────
    // idle → upselling → addressing → address_confirm → final
    const [flowState, setFlowState] = useState('idle');
    const [pendingAddress, setPendingAddress] = useState(null);
    const [upsellSuggestions, setUpsellSuggestions] = useState([]);

    const recognitionRef = useRef(null);
    const synth = window.speechSynthesis;

    // Initialize SpeechRecognition
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onstart = () => setIsListening(true);

            recognition.onresult = async (event) => {
                const current = event.resultIndex;
                const text = event.results[current][0].transcript;
                setTranscript(text);
                setIsListening(false);
                await processVoiceInput(text);
            };

            recognition.onerror = (event) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
                setBotReply('Sorry, I didn\'t catch that. Please try again.');
                speak('Sorry, I didn\'t catch that. Please try again.');
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        } else {
            setBotReply('Voice ordering is not supported in this browser.');
        }
    }, [language]);

    // Read out text using TTS
    const speak = (text) => {
        if (synth.speaking) synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language;
        utterance.rate = 1.0;
        synth.speak(utterance);
    };

    // ── Failure sound effect (Web Audio API buzzer) ────────────────────
    const playFailureSound = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'square';
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            osc.frequency.setValueAtTime(150, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        } catch (e) {
            console.warn('[VoiceBot] Could not play failure sound:', e);
        }
    };

    // ── Success sound effect ──────────────────────────────────────────
    const playSuccessSound = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523, ctx.currentTime);
            osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
            osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
            osc.start();
            osc.stop(ctx.currentTime + 0.35);
        } catch (e) {
            console.warn('[VoiceBot] Could not play success sound:', e);
        }
    };

    // ── State label for UI ────────────────────────────────────────────
    const getStateLabel = () => {
        switch (flowState) {
            case 'upselling': return '🛒 Upsell Suggestions';
            case 'addressing': return '📍 Delivery Address';
            case 'address_confirm': return '📍 Confirm Location';
            case 'final': return '✅ Final Confirmation';
            default: return null;
        }
    };

    // ── Main voice input router (based on flowState) ──────────────────
    const processVoiceInput = async (text) => {
        setBotReply('Processing...');
        console.log(`[VoiceBot] State: ${flowState}, Input: "${text}"`);

        try {
            switch (flowState) {
                case 'upselling':
                    await handleUpsellResponse(text);
                    break;
                case 'addressing':
                    await handleAddressInput(text);
                    break;
                case 'address_confirm':
                    await handleAddressConfirm(text);
                    break;
                case 'final':
                    await handleFinalConfirm(text);
                    break;
                default:
                    await handleIdleInput(text);
                    break;
            }
        } catch (err) {
            console.error('[VoiceBot] Error:', err);
            const errReply = 'Sorry, there was an error processing your request.';
            setBotReply(errReply);
            speak(errReply);
        }
    };

    // ── IDLE state: normal ordering + confirm detection ────────────────
    const handleIdleInput = async (text) => {
        // Comprehensive confirm phrases across all 7 languages
        const confirmPhrases = [
            // English
            'confirm order', 'place order', 'complete order', 'checkout',
            'order done', 'finish order', 'confirm my order', 'place my order',
            'yes confirm', "that's all", 'i\'m done', 'done ordering',
            // Hindi (romanized)
            'confirm karo', 'order confirm karo', 'confirm kar do',
            'order kar do', 'bas ho gaya', 'aur nahi chahiye',
            // Hindi (Devanagari)
            'ऑर्डर कन्फर्म करो', 'मेरा ऑर्डर कन्फर्म करो',
            'ऑर्डर प्लेस करो', 'ऑर्डर पूरा करो', 'बस ऑर्डर कर दो',
            'ऑर्डर कर दो', 'कन्फर्म करो', 'ऑर्डर कन्फर्म कर दो',
            'बस हो गया', 'कन्फर्म',
            // Gujarati
            'ઓર્ડર કન્ફર્મ કરો', 'મારું ઓર્ડર કન્ફર્મ કરો',
            'ઓર્ડર મૂકો', 'ઓર્ડર પૂરો કરો',
            'કન્ફર્મ કરો', 'ઓર્ડર કરો', 'બસ થઈ ગયું', 'કન્ફર્મ',
            // Tamil
            'ஆர்டர் உறுதிப்படுத்து', 'ஆர்டர் செய்', 'உறுதிப்படுத்து',
            'முடிந்தது', 'போதும்',
            // Malayalam
            'ഓർഡർ ഉറപ്പാക്കുക', 'ഓർഡർ ചെയ്യുക', 'ഉറപ്പാക്കുക',
            'മതി', 'കഴിഞ്ഞു',
            // Marathi
            'ऑर्डर कन्फर्म करा', 'ऑर्डर द्या', 'कन्फर्म करा',
            'बस झालं', 'पूर्ण',
            // Arabic
            'تأكيد الطلب', 'أكد الطلب', 'تأكيد', 'خلاص', 'انتهيت',
        ];

        // Remove phrases across all 7 languages
        const removePhrases = [
            'remove', 'delete', 'cancel item',
            'हटाओ', 'हटा दो', 'निकालो', 'कार्ट से हटाओ',
            'hatao', 'hata do', 'nikalo',
            'કાઢો', 'કાઢી', 'કાર્ટમાંથી કાઢો', 'દૂર કરો',
            'kadho', 'door karo',
            // Tamil
            'நீக்கு', 'அகற்று',
            // Malayalam
            'നീക്കം ചെയ്യുക', 'മാറ്റുക',
            // Marathi
            'काढा', 'हटवा',
            // Arabic
            'احذف', 'ازل', 'شيل',
        ];
        
        const lower = text.toLowerCase();
        const isConfirmIntent = confirmPhrases.some(p => lower.includes(p) || text.includes(p));
        const isRemoveIntent = removePhrases.some(p => lower.includes(p) || text.includes(p));

        // ── Enhanced Logging ──
        console.log(`%c[VoiceBot Debug]`, 'color: #ff6600; font-weight: bold;');
        console.log(`  Transcript: "${text}"`);
        console.log(`  Language: ${language}`);
        console.log(`  Detected: confirm=${isConfirmIntent}, remove=${isRemoveIntent}`);
        console.log(`  Cart State: ${cart.length} items [${cart.map(c => c.name).join(', ')}]`);

        if (isConfirmIntent) {
            if (cart.length === 0) {
                playFailureSound();
                const emptyCartMessages = {
                    'hi-IN': 'आपका कार्ट खाली है। पहले कुछ आइटम जोड़ें।',
                    'gu-IN': 'તમારું કાર્ટ ખાલી છે. પહેલા કેટલીક વસ્તુઓ ઉમેરો.',
                    'ta-IN': 'உங்கள் கார்ட் காலியாக உள்ளது. முதலில் சில பொருட்களைச் சேர்க்கவும்.',
                    'ml-IN': 'നിങ്ങളുടെ കാർട്ട് ശൂന്യมാണ്. ആദ്യം ചില ഐറ്റങ്ങൾ ചേർക്കുക.',
                    'mr-IN': 'तुमचा कार्ट रिकामा आहे. कृपया आधी काही आयटम जोडा.',
                    'ar-SA': 'سلة التسوق فارغة. أضف بعض العناصر أولاً.',
                };
                const reply = emptyCartMessages[language] || 'Your cart is empty. Please add some items first.';
                setBotReply(reply);
                speak(reply);
                return;
            }
            await startConfirmFlow();
            return;
        }

        // ── Smart Menu Q&A Detection ──
        // Detect menu-query phrases before hitting the ordering intent API
        const menuQueryTriggers = [
            'menu', 'what do you have', 'what do you serve', 'what items', 'available',
            'do you have', 'hai kya', 'milega', 'price of', 'how much', 'ka price',
            'show me', 'batao', 'kya hai', 'popular', 'best item', 'recommend',
            'veg option', 'veg item', 'breakfast', 'snacks', 'drinks', 'combo', 'special',
            'spicy', 'affordable', 'sasta', 'cheap', "what's your", 'what is your',
        ];
        const isMenuQuery = menuQueryTriggers.some(t => lower.includes(t));
        
        if (isMenuQuery) {
            try {
                const mqRes = await axios.post('http://localhost:3001/api/ai/menu-query', { text, language });
                const { reply: mqReply } = mqRes.data;
                if (mqReply) {
                    // Convert markdown bold (**text**) to plain text for TTS
                    const plainReply = mqReply.replace(/\*\*/g, '');
                    setBotReply(plainReply);
                    speak(plainReply);
                    return;
                }
            } catch (mqErr) {
                console.warn('[VoiceBot] Menu Q&A failed, falling through to intent API', mqErr.message);
            }
        }

        // Normal intent processing (add/remove items)
        const res = await axios.post('http://localhost:3001/api/ai/intent', { text, language });
        const { intent, reply } = res.data;

        console.log(`  Intent: action=${intent?.action}, item=${intent?.itemData?.name || 'None'}, qty=${intent?.quantity || 1}`);

        if (intent && intent.action !== 'unknown') {
            const { action, itemData, itemId, quantity, instructions } = intent;

            if (action === 'add' && itemData) {
                playSuccessSound();
                for (let i = 0; i < quantity; i++) addToCart({ ...itemData, instructions });
                setLastVoiceAddedId(itemData.id);
            } else if (action === 'remove' && itemId) {
                // Check if item is actually in the cart
                const inCart = cart.find(c => c.id === itemId);
                if (inCart) {
                    playSuccessSound();
                    removeFromCart(itemId);
                } else {
                    playFailureSound();
                    const notInCartMessages = {
                        'hi-IN': 'वह आइटम आपके कार्ट में नहीं है।',
                        'gu-IN': 'તે આઇટમ તમારા કાર્ટમાં નથી.',
                        'ta-IN': 'அந்த பொருள் உங்கள் கார்ட்டில் இல்லை.',
                        'ml-IN': 'ആ ഐറ്റം നിങ്ങളുടെ കാർട്ടിൽ ഇല്ല.',
                        'mr-IN': 'तो आयटम तुमच्या कार्टमध्ये नाही.',
                        'ar-SA': 'هذا العنصر ليس في سلة التسوق الخاصة بك.',
                    };
                    const notInCartReply = notInCartMessages[language] || 'That item is not in your cart.';
                    setBotReply(notInCartReply);
                    speak(notInCartReply);
                    return;
                }
            } else if (action === 'increase' && itemId) {
                updateQuantity(itemId, quantity || 1);
            } else if (action === 'decrease' && itemId) {
                updateQuantity(itemId, -(quantity || 1));
            } else if (action === 'nav_cart' || action === 'checkout') {
                navigate('/cart');
            } else if (action === 'address' && instructions) {
                setDeliveryAddress({
                    ...deliveryAddress,
                    flat: instructions,
                    street: 'Entered via Voice',
                    area: instructions,
                    lat: 28.4700,
                    lng: 77.0700,
                    storeId: 'S1'
                });
                navigate('/address');
            }
        } else {
            // Unknown/failed command → play failure sound
            playFailureSound();
        }

        setBotReply(reply);
        speak(reply);
    };

    // ── Start confirm flow: summarize cart + get upsell ────────────────
    const startConfirmFlow = async () => {
        const cartData = cart.map(c => ({
            name: c.name,
            quantity: c.quantity,
            price: c.price
        }));

        const res = await axios.post('http://localhost:3001/api/voice/confirm', {
            cart_items: cartData,
            language
        });

        const { reply, upsell_suggestions } = res.data;
        setUpsellSuggestions(upsell_suggestions || []);
        
        if (upsell_suggestions && upsell_suggestions.length > 0) {
            setFlowState('upselling');
            setBotReply(reply);
            speak(reply);
        } else {
            // No upsell, skip to address
            setFlowState('addressing');
            const addressPrompt = 'Great! Please tell me your delivery address.';
            setBotReply(addressPrompt);
            speak(addressPrompt);
        }
    };

    // ── UPSELLING state: handle accept/decline ────────────────────────
    const handleUpsellResponse = async (text) => {
        const res = await axios.post('http://localhost:3001/api/voice/upsell-response', {
            text,
            language,
            state: 'upselling'
        });

        const { intent, item } = res.data;

        if (intent === 'upsell_accept' && item) {
            addToCart({ ...item, quantity: 1 });
            const reply = `Added ${item.name} to your cart! Now, please tell me your delivery address.`;
            setBotReply(reply);
            speak(reply);
        } else {
            const reply = 'No problem! Please tell me your delivery address.';
            setBotReply(reply);
            speak(reply);
        }

        setFlowState('addressing');
    };

    // ── ADDRESSING state: capture and geocode address ─────────────────
    const handleAddressInput = async (text) => {
        setBotReply('Looking up your address...');
        
        const res = await axios.post('http://localhost:3001/api/voice/address', {
            text,
            language
        });

        const { success, geocoded, validation, reply } = res.data;

        if (success && geocoded) {
            setPendingAddress(geocoded);
            
            if (validation && !validation.within_range) {
                // Outside delivery range
                setBotReply(reply);
                speak(reply);
                const retryMsg = 'Please provide a different address within our delivery area.';
                setTimeout(() => {
                    setBotReply(reply + ' ' + retryMsg);
                    speak(retryMsg);
                }, 3000);
                return; // Stay in addressing state
            }

            // Valid address — ask for confirmation
            setFlowState('address_confirm');
            setBotReply(reply);
            speak(reply);
        } else {
            setBotReply(reply || "Sorry, I couldn't find that address. Please try again.");
            speak(reply || "Sorry, I couldn't find that address. Please try again.");
            // Stay in addressing state
        }
    };

    // ── ADDRESS_CONFIRM state: confirm/reject location ────────────────
    const handleAddressConfirm = async (text) => {
        const lower = text.toLowerCase();
        const confirmWords = ['yes', 'correct', 'right', 'confirm', 'sahi', 'theek', 'haan', 'ha'];
        const rejectWords = ['no', 'wrong', 'change', 'galat', 'nahi'];
        
        const isConfirm = confirmWords.some(w => lower.includes(w));
        const isReject = rejectWords.some(w => lower.includes(w));

        if (isReject) {
            setFlowState('addressing');
            setPendingAddress(null);
            const reply = 'Okay, please tell me your correct delivery address.';
            setBotReply(reply);
            speak(reply);
            return;
        }

        if (isConfirm && pendingAddress) {
            // Save address to store
            setDeliveryAddress({
                flat: pendingAddress.display_name,
                street: pendingAddress.area,
                area: pendingAddress.area,
                lat: pendingAddress.lat,
                lng: pendingAddress.lng,
                storeId: 'S1'
            });

            // Move to final confirmation
            setFlowState('final');
            const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const itemsReadout = cart.map(c => `${c.quantity} ${c.name}`).join(', ');
            const reply = `Perfect! Your order: ${itemsReadout}. Total: ₹${subtotal}. Delivering to ${pendingAddress.area}. Say "confirm" to place your order.`;
            setBotReply(reply);
            speak(reply);
        }
    };

    // ── FINAL state: place the order ──────────────────────────────────
    const handleFinalConfirm = async (text) => {
        const lower = text.toLowerCase();
        const cancelWords = ['no', 'cancel', 'nahi', 'stop'];
        
        if (cancelWords.some(w => lower.includes(w))) {
            setFlowState('idle');
            setPendingAddress(null);
            const reply = 'Order cancelled. You can continue adding items.';
            setBotReply(reply);
            speak(reply);
            return;
        }

        // Place the order
        setBotReply('Placing your order...');
        
        const cartData = cart.map(c => ({
            id: c.id,
            name: c.name,
            quantity: c.quantity,
            price: c.price
        }));

        // Get phone_number from localStorage session (set after OTP auth) or use guest placeholder
        const sessionPhone = localStorage.getItem('petpooja_phone') || '0000000000';
        const res = await axios.post('http://localhost:3001/api/voice/final-confirm', {
            cart: cartData,
            address: pendingAddress || { area: 'Voice Address' },
            phone_number: sessionPhone,
            language
        });

        const { reply, order_id, order } = res.data;
        
        if (order) {
            setCurrentOrder(order);
        }

        // Reset flow
        setFlowState('idle');
        setPendingAddress(null);
        setUpsellSuggestions([]);
        clearCart();

        setBotReply(reply || `Order ${order_id} placed successfully!`);
        speak(reply || `Order ${order_id} placed successfully!`);

        // Navigate to tracking after a delay
        setTimeout(() => {
            setIsOpen(false);
            navigate('/tracking');
        }, 3000);
    };

    const toggleListen = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            if (recognitionRef.current) {
                recognitionRef.current.lang = language;
                recognitionRef.current.start();
                setTranscript('');
                setBotReply('Listening...');
            }
        }
    };

    const resetFlow = () => {
        setFlowState('idle');
        setPendingAddress(null);
        setUpsellSuggestions([]);
        setBotReply('Flow reset. You can start fresh.');
    };

    // Do not show voice bot on Admin dashboard
    if (location.pathname === '/admin') return null;

    return (
        <>
            {/* Floating Action Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-gradient-to-tr from-orange-500 to-red-600 rounded-full flex items-center justify-center text-white shadow-2xl shadow-orange-500/40 hover:scale-110 active:scale-95 transition-all outline-none border-4 border-white/20"
            >
                <Mic size={28} />
            </button>

            {/* Voice Assistant Overlay Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)}></div>

                    <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-10 duration-500">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="absolute top-6 right-6 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex flex-col items-center mt-4">
                            <div className="w-full flex gap-3 mb-6 overflow-x-auto pb-2 px-1 scrollbar-hide snap-x">
                                {[
                                    { code: 'en-IN', label: 'English', native: 'English', flag: '🇬🇧' },
                                    { code: 'hi-IN', label: 'Hindi', native: 'हिंदी', flag: '🇮🇳' },
                                    { code: 'gu-IN', label: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳' },
                                    { code: 'ta-IN', label: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
                                    { code: 'ml-IN', label: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
                                    { code: 'mr-IN', label: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
                                    { code: 'ar-SA', label: 'Arabic', native: 'العربية', flag: '🇸🇦' },
                                ].map((lang) => (
                                    <button
                                        key={lang.code}
                                        onClick={() => setLanguage(lang.code)}
                                        className={`snap-center flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300 text-left ${
                                            language === lang.code
                                                ? 'border-orange-500 bg-orange-50 shadow-md ring-2 ring-orange-100 scale-105'
                                                : 'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300'
                                        }`}
                                    >
                                        <span className="text-2xl drop-shadow-sm">{lang.flag}</span>
                                        <div className="flex flex-col min-w-0 pr-2">
                                            <span className={`text-sm font-extrabold truncate ${language === lang.code ? 'text-orange-700' : 'text-gray-700'}`}>
                                                {lang.native}
                                            </span>
                                            <span className={`text-[10px] uppercase tracking-widest font-bold mt-0.5 ${language === lang.code ? 'text-orange-500/80' : 'text-gray-400'}`}>
                                                {lang.label}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Flow State Indicator */}
                            {flowState !== 'idle' && (
                                <div className="w-full mb-4 flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 text-xs font-bold rounded-xl">
                                        {getStateLabel()}
                                    </span>
                                    <button
                                        onClick={resetFlow}
                                        className="text-xs text-gray-400 hover:text-red-500 font-semibold transition-colors"
                                    >
                                        Reset
                                    </button>
                                </div>
                            )}

                            <div className="relative mb-6">
                                <div className={`absolute inset-0 bg-orange-500 rounded-full blur-2xl transition-opacity duration-500 ${isListening ? 'opacity-40 animate-pulse' : 'opacity-0'}`}></div>
                                <button
                                    onClick={toggleListen}
                                    className={`relative w-28 h-28 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 outline-none ${isListening ? 'bg-red-500 scale-110 shadow-red-500/40' : 'bg-gradient-to-tr from-orange-500 to-red-600 shadow-orange-500/40 hover:scale-105'}`}
                                >
                                    <Mic size={48} className={isListening ? 'animate-pulse' : ''} />
                                </button>
                            </div>

                            <div className="w-full text-center space-y-3">
                                {transcript && (
                                    <div className="inline-block bg-gray-50 px-6 py-3 rounded-2xl border border-gray-100 shadow-sm text-gray-900 font-medium max-w-full truncate">
                                        "{transcript}"
                                    </div>
                                )}

                                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6 relative overflow-hidden">
                                    <Volume2 size={120} className="absolute -right-6 -bottom-6 text-orange-500/5 rotate-[-15deg]" />
                                    <p className="text-lg font-bold text-orange-800 relative z-10 leading-snug">
                                        {botReply}
                                    </p>
                                </div>

                                {/* Address confirmation with map pin */}
                                {flowState === 'address_confirm' && pendingAddress && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3 text-left">
                                        <MapPin size={20} className="text-blue-500 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="font-bold text-sm text-blue-800">{pendingAddress.area}</p>
                                            <p className="text-xs text-blue-600 mt-1 line-clamp-2">{pendingAddress.display_name}</p>
                                            <p className="text-xs text-blue-400 mt-1">📍 {pendingAddress.lat?.toFixed(4)}, {pendingAddress.lng?.toFixed(4)}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Upsell suggestions display */}
                                {flowState === 'upselling' && upsellSuggestions.length > 0 && (
                                    <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-left">
                                        <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-2">Suggested Add-ons</p>
                                        {upsellSuggestions.map((s, i) => (
                                            <div key={i} className="flex items-center justify-between py-1.5">
                                                <span className="font-semibold text-sm text-green-800">{s.name}</span>
                                                <span className="text-xs text-green-500">{s.reason}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {cart.length > 0 && (
                                <div className="w-full mt-5 bg-white border-2 border-dashed border-gray-200 rounded-2xl p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => { setIsOpen(false); navigate('/cart'); }}>
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Live Cart</p>
                                        <p className="font-extrabold text-gray-900">{cart.reduce((a, c) => a + c.quantity, 0)} Items Added</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total</p>
                                        <p className="font-extrabold text-orange-500 text-lg">₹{cart.reduce((a, c) => a + (c.price * c.quantity), 0)}</p>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default GlobalVoiceBot;
