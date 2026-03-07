import React, { useState, useEffect, useRef } from 'react';
import { Mic, Send, ShoppingCart, Volume2, Globe, CheckCircle2, Star, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import axios from 'axios';

const VoiceOrdering = () => {
    const navigate = useNavigate();
    const { cart, addToCart, removeFromCart, updateQuantity } = useStore();

    const [language, setLanguage] = useState('en-IN');
    const [messages, setMessages] = useState([
        { id: Date.now(), text: "Hello! I am PetpoojaBot. I'm ready to take your order.", sender: 'ai' }
    ]);
    const [menu, setMenu] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [inputText, setInputText] = useState('');

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const synth = window.speechSynthesis;

    useEffect(() => {
        axios.get('http://localhost:3001/api/menu').then(res => setMenu(res.data.items));
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, cart]);

    // Setup Speech Recognition
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;

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
        utterance.lang = language;
        utterance.rate = 1.0;
        synth.speak(utterance);
    };

    const handleUserCommand = async (text) => {
        if (!text.trim()) return;

        // Add user message to chat
        setMessages(prev => [...prev, { id: Date.now(), text, sender: 'user' }]);
        setInputText('');

        // Special Checkout Flow handling locally
        if (text.toLowerCase().includes('confirm order') || text.toLowerCase().includes('checkout')) {
            if (cart.length === 0) {
                const reply = language === 'hi-IN' ? 'आपका कार्ट खाली है।' : language === 'gu-IN' ? 'તમારું કાર્ટ ખાલી છે.' : 'Your cart is empty. Please add items.';
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

    const handleLanguageChange = (lang, greeting) => {
        setLanguage(lang);
        setHasStarted(true);
        setMessages([{ id: Date.now(), text: greeting, sender: 'ai' }]);
        speak(greeting);
    };

    // Splash Screen for Language Selection
    if (!hasStarted) {
        return (
            <div className="h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-10 max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
                    <Globe className="w-16 h-16 text-orange-500 mx-auto mb-6" />
                    <h2 className="text-2xl font-black text-center mb-2">Select Language</h2>
                    <p className="text-gray-500 text-center mb-8">PetpoojaBot speaks your language</p>
                    <div className="space-y-3">
                        <button onClick={() => handleLanguageChange('en-IN', "Hi, I am PetpoojaBot. What can I get for you today?")} className="w-full py-4 px-6 rounded-2xl border-2 border-transparent bg-gray-50 hover:border-orange-500 hover:bg-orange-50 font-bold text-gray-700 hover:text-orange-600 transition-all">English</button>
                        <button onClick={() => handleLanguageChange('hi-IN', 'नमस्ते! मैं पेटपूजा बॉट हूँ। मैं आपकी क्या मदद कर सकता हूँ?')} className="w-full py-4 px-6 rounded-2xl border-2 border-transparent bg-gray-50 hover:border-orange-500 hover:bg-orange-50 font-bold text-gray-700 hover:text-orange-600 transition-all">हिंदी (Hindi)</button>
                        <button onClick={() => handleLanguageChange('gu-IN', 'નમસ્તે! હું પેટપૂજા બોટ છું. હું તમારા માટે શું ઓર્ડર કરું?')} className="w-full py-4 px-6 rounded-2xl border-2 border-transparent bg-gray-50 hover:border-orange-500 hover:bg-orange-50 font-bold text-gray-700 hover:text-orange-600 transition-all">ગુજરાતી (Gujarati)</button>
                    </div>
                </div>
            </div>
        );
    }

    const dummyImage = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400";

    return (
        <div className="h-screen flex bg-gray-100 overflow-hidden font-sans">
            {/* Left Side: Voice Assistant Panel */}
            <div className="w-[45%] h-full flex flex-col bg-white border-r shadow-2xl z-10">
                <div className="p-6 bg-gradient-to-r from-orange-500 to-red-600 flex justify-between items-center text-white shadow-md">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm border border-white/20 hover:scale-105 transition-transform cursor-pointer" onClick={() => setHasStarted(false)}>
                            <Globe size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black flex items-center gap-2">Copilot Voice <span className="text-xs bg-white text-orange-600 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">AI</span></h1>
                            <p className="text-orange-100 text-sm font-medium flex items-center gap-2 mt-1">
                                <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-400 animate-pulse' : 'bg-gray-300'}`}></span>
                                {language === 'en-IN' ? 'English' : language === 'hi-IN' ? 'हिंदी' : 'ગુજરાતી'}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/menu')} className="text-sm font-bold bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl transition-colors backdrop-blur-sm">
                        Smart Menu
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto w-full p-6 space-y-6 bg-[url('https://www.transparenttextures.com/patterns/food.png')] bg-gray-50 bg-blend-soft-light relative">
                    {messages.map((msg, i) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 fade-in duration-300`} style={{ animationDelay: `${i * 50}ms` }}>
                            <div className={`max-w-[85%] p-5 rounded-[2rem] text-[16px] font-medium leading-relaxed shadow-sm ${msg.sender === 'user' ? 'bg-orange-500 text-white rounded-br-md shadow-orange-500/20' : 'bg-white text-gray-800 rounded-bl-md border border-gray-100'}`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-6 bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] pb-8">
                    <div className="relative flex items-center bg-gray-50 rounded-full border border-gray-200 p-2 shadow-inner">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUserCommand(inputText)}
                            placeholder="Type or use your voice..."
                            className="w-full p-3 pl-6 bg-transparent outline-none font-medium text-gray-700 placeholder:text-gray-400"
                        />
                        <div className="flex items-center gap-2 pr-2">
                            <button
                                onClick={toggleListen}
                                className={`p-4 rounded-full transition-all duration-300 shadow-md flex items-center justify-center ${isListening ? 'bg-red-500 text-white shadow-red-500/40 animate-pulse scale-110' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
                            >
                                <Mic size={22} className={isListening ? 'animate-bounce' : ''} />
                            </button>
                            <button
                                onClick={() => handleUserCommand(inputText)}
                                className="p-4 bg-gray-900 text-white rounded-full hover:bg-black transition-all duration-300 shadow-md active:scale-95"
                            >
                                <Send size={20} className="ml-1" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side: Scrollable Live Menu */}
            <div className="w-[55%] h-full flex flex-col bg-gray-50 relative">
                {/* Cart Status Bar */}
                <div className="absolute top-0 w-full z-20 p-4 bg-gradient-to-b from-gray-900/90 to-transparent pointer-events-none">
                    <div className="max-w-md mx-auto bg-white/90 backdrop-blur-md rounded-2xl p-4 shadow-2xl flex items-center justify-between border border-white/20 pointer-events-auto cursor-pointer hover:bg-white transition-colors" onClick={() => navigate('/cart')}>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 rounded-xl text-orange-600">
                                <ShoppingCart size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Live Order</p>
                                <p className="font-extrabold text-gray-900">{cart.reduce((a, c) => a + c.quantity, 0)} Items</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total</p>
                            <p className="text-xl font-black text-orange-500">₹{cart.reduce((sum, item) => sum + item.price * item.quantity, 0)}</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pt-28 pb-10 space-y-6 flex flex-col">
                    <h2 className="text-2xl font-black text-gray-900 mb-2 flex items-center gap-2">
                        <Sparkles size={24} className="text-orange-500" /> Interactive Menu
                    </h2>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {menu.map(item => (
                            <div key={item.id} className="bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-100 group flex flex-col">
                                <div className="relative h-40 overflow-hidden">
                                    <img src={dummyImage} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                    <div className="absolute top-3 left-3 flex gap-2">
                                        {item.isVeg ? (
                                            <span className="bg-white/90 backdrop-blur-sm text-green-700 text-[10px] px-2.5 py-1 rounded-lg font-black shadow-sm flex items-center gap-1 border border-green-100 uppercase">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Veg
                                            </span>
                                        ) : (
                                            <span className="bg-white/90 backdrop-blur-sm text-red-700 text-[10px] px-2.5 py-1 rounded-lg font-black shadow-sm flex items-center gap-1 border border-red-100 uppercase">
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> Non-Veg
                                            </span>
                                        )}
                                        {item.engineCategory === 'Star ⭐' && (
                                            <span className="bg-yellow-400 text-yellow-900 text-[10px] px-2.5 py-1 rounded-lg font-black shadow-sm flex items-center gap-1 uppercase">
                                                Bestseller
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="p-5 flex flex-col flex-grow">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-lg font-bold text-gray-900 leading-tight">
                                            <span className="text-gray-400 mr-1.5 text-base">#{item.id}</span>
                                            {item.name}
                                        </h3>
                                        <span className="text-lg font-black text-orange-500 ml-2">₹{item.price}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mb-4">
                                        {item.tags?.slice(0, 2).map(t => t && (
                                            <span key={t} className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-md uppercase font-bold tracking-wider">{t}</span>
                                        ))}
                                    </div>
                                    <div className="mt-auto">
                                        {cart.find(c => c.id === item.id) ? (
                                            <div className="flex flex-col gap-2 bg-orange-50 p-2 rounded-[1rem] border border-orange-100">
                                                <div className="flex items-center justify-between">
                                                    <button onClick={() => updateQuantity(item.id, -1)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white text-orange-600 font-black shadow-sm hover:bg-orange-600 hover:text-white transition-colors text-xl">-</button>
                                                    <span className="font-black text-lg w-8 text-center text-orange-700">{cart.find(c => c.id === item.id).quantity}</span>
                                                    <button onClick={() => addToCart(item)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white text-orange-600 font-black shadow-sm hover:bg-orange-600 hover:text-white transition-colors text-xl">+</button>
                                                </div>
                                                {cart.find(c => c.id === item.id).instructions && (
                                                    <div className="bg-yellow-100/70 border border-yellow-200 text-yellow-800 text-[11px] px-2 py-1 rounded-md italic font-medium w-full text-center">
                                                        Note: {cart.find(c => c.id === item.id).instructions}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => addToCart({ ...item, quantity: 1 })}
                                                className="w-full py-3 rounded-[1rem] font-bold text-sm transition-all duration-300 bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-900 hover:text-white hover:border-transparent hover:shadow-lg active:scale-95"
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
