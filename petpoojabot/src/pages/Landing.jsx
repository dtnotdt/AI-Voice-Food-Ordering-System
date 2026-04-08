import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Menu as MenuIcon, ChevronRight, PhoneCall } from 'lucide-react';
import VoiceCallInterface from '../components/VoiceCallInterface';

const Landing = () => {
    const [showModal, setShowModal] = useState(false);
    const [isCalling, setIsCalling] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowModal(true);
        }, 8000); // 8 seconds
        return () => clearTimeout(timer);
    }, []);

    const foodImages = [
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=800",
        "https://images.unsplash.com/photo-1562376552-0d160a2f148c?auto=format&fit=crop&q=80&w=800"
    ];

    return (
        <div className="relative w-full h-screen overflow-hidden bg-black">
            {/* Marquee Sale Banner */}
            <div className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 text-white overflow-hidden h-10 flex items-center">
                <div className="whitespace-nowrap animate-marquee flex gap-16 font-bold text-sm tracking-wide">
                    <span>🔥 Biggest Sale Live Now 🔥</span>
                    <span>🍔 Flat 20% OFF on Combos 🍔</span>
                    <span>🔥 Biggest Sale Live Now 🔥</span>
                    <span>🍕 Free Delivery on Orders Above ₹200 🍕</span>
                    <span>🔥 Biggest Sale Live Now 🔥</span>
                    <span>☕ Buy 1 Get 1 on Beverages ☕</span>
                    <span>🔥 Biggest Sale Live Now 🔥</span>
                    <span>🍔 Flat 20% OFF on Combos 🍔</span>
                </div>
                <style>{`
                    @keyframes marquee {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-50%); }
                    }
                    .animate-marquee {
                        animation: marquee 20s linear infinite;
                    }
                `}</style>
            </div>
            {/* Background Banners */}
            <div className="absolute inset-0 flex transition-transform duration-[10000ms] ease-linear transform hover:scale-110">
                {foodImages.map((src, idx) => (
                    <div key={idx} className="w-1/3 h-full relative">
                        <img src={src} alt="food banner" className="w-full h-full object-cover opacity-60" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                    </div>
                ))}
            </div>

            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center text-white z-10 w-full" style={{top: '38%'}}>
                <h1 className="text-6xl font-extrabold tracking-tight mb-4 drop-shadow-2xl">PetpoojaBot<span className="text-orange-500">.</span></h1>
                <p className="text-2xl font-light drop-shadow-lg">The AI Revenue Copilot for Restaurants.</p>
            </div>

            {/* Auto-Scrolling Food Image Gallery */}
            <div className="absolute z-20 w-full overflow-hidden" style={{bottom: '100px'}}>
                <div className="relative">
                    {/* Left/Right fade edges */}
                    <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-black to-transparent z-10"></div>
                    <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-black to-transparent z-10"></div>
                    <div className="food-gallery-track flex gap-6 hover:[animation-play-state:paused]">
                        {[
                            { src: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=200&h=200", label: "Pizza" },
                            { src: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=200&h=200", label: "Burger" },
                            { src: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=200&h=200", label: "Coffee" },
                            { src: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&q=80&w=200&h=200", label: "Pasta" },
                            { src: "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&q=80&w=200&h=200", label: "Fries" },
                            { src: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&q=80&w=200&h=200", label: "Desserts" },
                            { src: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&q=80&w=200&h=200", label: "Cold Coffee" },
                            // Duplicate set for seamless loop
                            { src: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=200&h=200", label: "Pizza" },
                            { src: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=200&h=200", label: "Burger" },
                            { src: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=200&h=200", label: "Coffee" },
                            { src: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&q=80&w=200&h=200", label: "Pasta" },
                            { src: "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&q=80&w=200&h=200", label: "Fries" },
                            { src: "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&q=80&w=200&h=200", label: "Desserts" },
                            { src: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&q=80&w=200&h=200", label: "Cold Coffee" },
                        ].map((food, idx) => (
                            <div key={idx} className="flex-shrink-0 w-28 h-28 relative rounded-2xl overflow-hidden group cursor-pointer shadow-lg shadow-black/30 border-2 border-white/10 hover:border-orange-400/60 transition-all hover:scale-110">
                                <img src={food.src} alt={food.label} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                                <span className="absolute bottom-1.5 left-0 right-0 text-center text-white text-[10px] font-black uppercase tracking-wider">{food.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <style>{`
                    @keyframes food-scroll {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-50%); }
                    }
                    .food-gallery-track {
                        animation: food-scroll 25s linear infinite;
                        width: max-content;
                    }
                `}</style>
            </div>

            <button
                onClick={() => setShowModal(true)}
                className="absolute bottom-6 left-1/2 transform -translate-x-1/2 px-8 py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-full shadow-2xl transition-all duration-300 ease-in-out hover:scale-105 flex items-center gap-2 z-20"
            >
                Start Ordering <ChevronRight size={20} />
            </button>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl transform transition-all animate-in fade-in zoom-in duration-300">
                        <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center">How would you like to order?</h2>
                        <p className="text-gray-500 text-center mb-8">Choose your preferred experience</p>

                        <div className="flex flex-col gap-4">
                            <button
                                onClick={() => navigate('/voice')}
                                className="group relative flex items-center p-6 bg-gradient-to-r from-orange-50 to-red-50 hover:from-orange-100 hover:to-red-100 border border-orange-200 rounded-2xl transition-all duration-300 overflow-hidden"
                            >
                                <div className="absolute right-0 top-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                                <div className="bg-orange-500 text-white p-4 rounded-full mr-4 shadow-lg">
                                    <Mic size={28} />
                                </div>
                                <div className="text-left z-10">
                                    <h3 className="text-xl font-bold text-gray-800">AI Voice Assistant</h3>
                                    <p className="text-sm text-gray-600">Order by talking in your language</p>
                                </div>
                            </button>

                            <button
                                onClick={() => navigate('/menu')}
                                className="group relative flex items-center p-6 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 rounded-2xl transition-all duration-300 overflow-hidden"
                            >
                                <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                                <div className="bg-blue-600 text-white p-4 rounded-full mr-4 shadow-lg">
                                    <MenuIcon size={28} />
                                </div>
                                <div className="text-left z-10">
                                    <h3 className="text-xl font-bold text-gray-800">Smart Menu</h3>
                                    <p className="text-sm text-gray-600">Browse AI recommended combinations</p>
                                </div>
                            </button>

                            <div className="flex items-center gap-4 my-2">
                                <div className="h-[1px] flex-1 bg-gray-100"></div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">New Experience</span>
                                <div className="h-[1px] flex-1 bg-gray-100"></div>
                            </div>

                            <button
                                onClick={() => setIsCalling(true)}
                                className="group relative flex items-center p-6 bg-gradient-to-r from-zinc-900 to-zinc-800 hover:from-black hover:to-zinc-900 border border-zinc-700 rounded-2xl transition-all duration-300 overflow-hidden"
                            >
                                <div className="absolute right-0 top-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                                <div className="bg-orange-500 text-white p-4 rounded-full mr-4 shadow-lg group-hover:animate-bounce">
                                    <PhoneCall size={28} />
                                </div>
                                <div className="text-left z-10">
                                    <h3 className="text-xl font-bold text-white">Call Restaurant</h3>
                                    <p className="text-sm text-zinc-400">Speak live with our AI Agent</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isCalling && <VoiceCallInterface onClose={() => setIsCalling(false)} />}
        </div>
    );
};

export default Landing;
