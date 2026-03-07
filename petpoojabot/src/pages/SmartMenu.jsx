import React, { useEffect, useState } from 'react';
import { ShoppingCart, Star, TrendingUp, Sparkles, Coffee, Leaf, Info, Plus, Minus, Trash2, X } from 'lucide-react';
import axios from 'axios';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';

const SmartMenu = () => {
    const navigate = useNavigate();
    const { cart, addToCart, removeFromCart, updateQuantity, vegOnly, toggleVegOnly, filters, toggleFilter, lastVoiceAddedId } = useStore();
    const [menu, setMenu] = useState([]);
    const [activeTab, setActiveTab] = useState('AI RecommendedItems');
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [highlightedItemId, setHighlightedItemId] = useState(null);

    const tabs = [
        { id: 'Starters', icon: <Sparkles size={18} />, label: 'Starters' },
        { id: 'Main Course', icon: <Star size={18} />, label: 'Main Course' },
        { id: 'Combos', icon: <Coffee size={18} />, label: 'Combos' },
        { id: 'Beverages', icon: <Coffee size={18} />, label: 'Beverages' },
        { id: 'Desserts', icon: <TrendingUp size={18} />, label: 'Desserts' },
        { id: 'Sides', icon: <Sparkles size={18} />, label: 'Sides' },
    ];

    const availableFilters = ['Spicy', 'Sweet', 'Cold', 'Cheesy', '⭐ Bestseller'];

    useEffect(() => {
        axios.get('http://localhost:3001/api/menu').then(res => {
            setMenu(res.data.items);
            setActiveTab('Starters'); // Set an explicit default tab
        });
    }, []);

    // Listen for voice-added items to trigger highlight
    useEffect(() => {
        if (lastVoiceAddedId) {
            setHighlightedItemId(lastVoiceAddedId);
            const timer = setTimeout(() => setHighlightedItemId(null), 2500);
            return () => clearTimeout(timer);
        }
    }, [lastVoiceAddedId]);

    const getFilteredItems = () => {
        let items = menu.filter(m => m.category === activeTab);

        if (vegOnly) {
            items = items.filter(m => m.isVeg);
        }

        if (filters.length > 0) {
            items = items.filter(m => {
                if (filters.includes('⭐ Bestseller') && m.engineCategory !== 'Star ⭐') return false;
                const tagFilters = filters.filter(f => f !== '⭐ Bestseller');
                if (tagFilters.length > 0 && !tagFilters.some(tf => m.tags.includes(tf))) return false;
                return true;
            });
        }

        return items;
    };

    // ── Star Rating Component (handles half-stars + animation) ──────────
    const StarRating = ({ rating, size = 14 }) => {
        const fullStars = Math.floor(rating);
        const hasHalf = rating - fullStars >= 0.3 && rating - fullStars < 0.8;
        const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
        return (
            <div className="flex items-center gap-0.5">
                {[...Array(fullStars)].map((_, i) => (
                    <span key={`f${i}`} className="text-amber-400" style={{ fontSize: size, animationDelay: `${i * 60}ms` }}>
                        <span className="inline-block animate-[star-pop_0.3s_ease-out_both]" style={{ animationDelay: `${i * 60}ms` }}>★</span>
                    </span>
                ))}
                {hasHalf && (
                    <span className="relative text-gray-300" style={{ fontSize: size }}>
                        <span className="inline-block animate-[star-pop_0.3s_ease-out_both]" style={{ animationDelay: `${fullStars * 60}ms` }}>★</span>
                        <span className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                            <span className="text-amber-400">★</span>
                        </span>
                    </span>
                )}
                {[...Array(emptyStars)].map((_, i) => (
                    <span key={`e${i}`} className="text-gray-300" style={{ fontSize: size }}>
                        <span className="inline-block animate-[star-pop_0.3s_ease-out_both]" style={{ animationDelay: `${(fullStars + (hasHalf ? 1 : 0) + i) * 60}ms` }}>★</span>
                    </span>
                ))}
                <span className="text-xs text-gray-500 font-bold ml-1">{rating.toFixed(1)}</span>
            </div>
        );
    };

    // Food images pool — each item gets a unique image based on its ID
    const foodImagePool = [
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=400",
    ];
    const getItemImage = (id) => foodImagePool[id % foodImagePool.length];

    const dummyImage = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400";
    const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return (
        <div className="min-h-screen bg-gray-50 pb-24 font-sans selection:bg-orange-100">
            {/* Star animation keyframes */}
            <style>{`
                @keyframes star-pop {
                    0% { transform: scale(0) rotate(-45deg); opacity: 0; }
                    60% { transform: scale(1.3) rotate(5deg); }
                    100% { transform: scale(1) rotate(0); opacity: 1; }
                }
            `}</style>
            <div className="bg-white sticky top-0 z-30 shadow-sm border-b">
                <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 flex items-center gap-2">
                            Smart Menu <span className="text-sm font-semibold bg-orange-100 text-orange-600 px-2 py-1 rounded-full uppercase tracking-wider hidden md:inline-block">Powered by AI</span>
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">Discover dynamic combos and high-margin recommendations.</p>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Veg Only Toggle */}
                        <div className={`flex items-center gap-3 px-4 py-2 rounded-full border transition-all cursor-pointer select-none ${vegOnly ? 'bg-green-50 border-green-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]' : 'bg-white border-gray-200 hover:bg-gray-50'}`} onClick={toggleVegOnly}>
                            <span className={`text-sm font-bold ${vegOnly ? 'text-green-700' : 'text-gray-500'}`}>Veg Only</span>
                            <div className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${vegOnly ? 'bg-green-500' : 'bg-gray-300'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform duration-300 shadow-sm ${vegOnly ? 'translate-x-7' : 'translate-x-1'}`}></div>
                            </div>
                        </div>

                        <div className="relative cursor-pointer bg-gray-100 p-3 rounded-full hover:bg-gray-200 transition transform hover:scale-105" onClick={() => setIsCartOpen(true)}>
                            <ShoppingCart size={24} className="text-gray-800" />
                            {cart.length > 0 && (
                                <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-md animate-in zoom-in duration-300 border-2 border-white">
                                    {cart.reduce((acc, c) => acc + c.quantity, 0)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto px-6 overflow-x-auto no-scrollbar py-4 border-t border-gray-100 bg-gray-50/50 backdrop-blur-md">
                    <div className="flex flex-col gap-4">
                        {/* Category Tabs */}
                        <div className="flex gap-3">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl whitespace-nowrap text-sm font-bold transition-all duration-300 ${activeTab === tab.id
                                        ? 'bg-gray-900 text-white shadow-xl shadow-gray-900/20 scale-105'
                                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                                        }`}
                                >
                                    {tab.icon} {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Filter Chips */}
                        <div className="flex gap-2">
                            <span className="text-sm text-gray-400 font-medium py-1 px-2 flex items-center gap-1"><Info size={14} /> Filters:</span>
                            {availableFilters.map(f => (
                                <button
                                    key={f}
                                    onClick={() => toggleFilter(f)}
                                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${filters.includes(f)
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm'
                                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                        }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Dynamic Combo Suggestion Banner */}
                {cart.length === 1 && (
                    <div className="mb-10 bg-gradient-to-r from-orange-100 via-orange-50 to-red-50 border border-orange-200 rounded-[2rem] p-8 flex items-center justify-between shadow-lg shadow-orange-100/50 relative overflow-hidden group">
                        <div className="absolute right-0 top-0 w-64 h-64 bg-orange-200/40 rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-700"></div>
                        <div className="z-10 relative">
                            <div className="flex items-center gap-2 text-orange-600 font-bold mb-2 uppercase tracking-wider text-xs bg-orange-200/50 w-max px-3 py-1 rounded-full">
                                <Sparkles size={14} /> AI Combo Engine
                            </div>
                            <h3 className="text-2xl font-extrabold text-gray-900">People who ordered {cart[0].name} also added Cold Coffee.</h3>
                            <p className="text-gray-600 mt-2 font-medium">Add for ₹149 <span className="text-green-600 bg-green-100 px-2 py-0.5 rounded-md text-sm ml-2">Save 25%</span></p>
                        </div>
                        <button
                            onClick={() => {
                                const coffee = menu.find(m => m.name.includes("Coffee"));
                                if (coffee) addToCart({ ...coffee, price: 149 });
                                setIsCartOpen(true);
                            }}
                            className="z-10 relative bg-orange-500 text-white px-8 py-4 rounded-2xl font-bold hover:bg-orange-600 shadow-xl shadow-orange-500/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                        >
                            Add Combo <Plus size={20} />
                        </button>
                    </div>
                )}

                {/* Menu Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {getFilteredItems().map(item => {
                        const isHighlighted = highlightedItemId === item.id;
                        return (
                        <div key={item.id} className={`bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border group transform hover:-translate-y-2 flex flex-col h-full relative ${isHighlighted ? 'border-orange-400 shadow-orange-400/30 shadow-2xl scale-[1.03] ring-2 ring-orange-400/50' : 'border-gray-100/80'}`}>

                            {/* Voice highlight glow overlay */}
                            {isHighlighted && (
                                <div className="absolute inset-0 z-20 pointer-events-none rounded-3xl overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-t from-orange-500/20 to-transparent animate-pulse"></div>
                                    <div className="absolute top-3 right-3 bg-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg animate-bounce">
                                        ✓ Added via Voice
                                    </div>
                                </div>
                            )}

                            <div className="relative h-56 overflow-hidden">
                                <img src={getItemImage(item.id)} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                                <div className="absolute top-4 left-4 flex flex-col gap-2">
                                    {!vegOnly && (
                                        item.isVeg ? (
                                            <span className="bg-white/95 backdrop-blur-md text-green-700 text-xs px-3 py-1.5 rounded-lg font-black shadow-md flex items-center gap-1 border border-green-100">
                                                <div className="w-2 h-2 rounded-full bg-green-500"></div> Veg
                                            </span>
                                        ) : (
                                            <span className="bg-white/95 backdrop-blur-md text-red-700 text-xs px-3 py-1.5 rounded-lg font-black shadow-md flex items-center gap-1 border border-red-100">
                                                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-red-500 rounded-sm"></div> Non-Veg
                                            </span>
                                        )
                                    )}
                                    {item.engineCategory === 'Star ⭐' && (
                                        <span className="bg-yellow-400 text-yellow-900 text-xs px-3 py-1.5 rounded-lg font-black shadow-md flex items-center gap-1 border border-yellow-300">
                                            ⭐ Bestseller
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 flex flex-col flex-grow">
                                <div className="flex justify-between items-start mb-1 gap-2">
                                    <h3 className="text-xl font-bold text-gray-900 leading-tight">
                                        <span className="text-gray-400 mr-2 text-lg">#{item.id}</span>
                                        {item.name}
                                    </h3>
                                    <span className="text-xl font-black text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">₹{item.price}</span>
                                </div>

                                {/* Star Rating */}
                                <div className="mb-3">
                                    <StarRating rating={item.rating || 4.0} size={14} />
                                </div>

                                <p className="text-gray-500 text-sm mb-5 line-clamp-2 pb-2 border-b border-gray-50 flex-grow">
                                    A delicious offering crafted with the finest ingredients to satisfy your cravings. Prepared fresh on order.
                                </p>

                                <div className="flex flex-wrap gap-2 mb-6">
                                    {item.tags?.map(t => t && (
                                        <span key={t} className="bg-gray-100 text-gray-600 text-[10px] px-2.5 py-1 rounded-md uppercase font-bold tracking-wider hover:bg-gray-200 transition-colors cursor-default">{t}</span>
                                    ))}
                                </div>

                                <button
                                    onClick={() => addToCart({ ...item, quantity: 1 })}
                                    className="w-full py-3.5 rounded-2xl font-bold transition-all duration-300 bg-gray-50 text-gray-900 hover:bg-gray-900 hover:text-white border border-gray-200 hover:border-transparent hover:shadow-xl hover:shadow-gray-900/20 active:scale-[0.98] mt-auto"
                                >
                                    Add to Cart
                                </button>
                            </div>
                        </div>
                        );
                    })}
                </div>

                {getFilteredItems().length === 0 && (
                    <div className="py-20 text-center">
                        <div className="text-6xl mb-4">🍽️</div>
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">No items found</h3>
                        <p className="text-gray-500">Try adjusting your filters or Veg Only settings.</p>
                    </div>
                )}
            </div>

            {/* Modern Cart Sidebar */}
            {isCartOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>

                    <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <h2 className="text-2xl font-black flex items-center gap-2">
                                <ShoppingCart size={24} className="text-orange-500" /> Your Cart
                            </h2>
                            <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500 hover:text-gray-900">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    <ShoppingCart size={64} className="mb-4 opacity-50" />
                                    <p className="text-lg font-medium">Your cart is empty</p>
                                    <p className="text-sm">Add some delicious items to get started!</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} className="flex gap-4 p-4 border border-gray-100 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
                                        <img src={dummyImage} alt={item.name} className="w-20 h-20 object-cover rounded-xl" />
                                        <div className="flex-1 flex flex-col">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-gray-900 line-clamp-1">{item.name}</h4>
                                                <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            <p className="text-orange-500 font-bold">₹{item.price}</p>

                                            {item.instructions && (
                                                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs px-2 py-1.5 rounded-md mt-2 flex items-start gap-1">
                                                    <Info size={12} className="mt-0.5 flex-shrink-0" />
                                                    <span className="font-medium italic leading-tight">{item.instructions}</span>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between mt-auto pt-3">
                                                <div className="flex items-center gap-3 bg-gray-50 p-1 rounded-xl border border-gray-100">
                                                    <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-gray-600 hover:bg-gray-200 hover:text-gray-900 shadow-sm transition-colors">
                                                        <Minus size={14} strokeWidth={3} />
                                                    </button>
                                                    <span className="font-bold text-gray-900 w-4 text-center">{item.quantity}</span>
                                                    <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-gray-600 hover:bg-gray-200 hover:text-gray-900 shadow-sm transition-colors">
                                                        <Plus size={14} strokeWidth={3} />
                                                    </button>
                                                </div>
                                                <span className="font-extrabold text-gray-900">₹{item.price * item.quantity}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {cart.length > 0 && (
                            <div className="p-6 bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                                <div className="space-y-3 mb-6">
                                    <div className="flex justify-between text-gray-500 font-medium">
                                        <span>Subtotal</span>
                                        <span>₹{cartTotal}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigate('/cart')}
                                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-2xl font-extrabold text-lg shadow-xl shadow-orange-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] flex justify-between items-center px-6"
                                >
                                    <span>Checkout</span>
                                    <span>₹{cartTotal}</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SmartMenu;
