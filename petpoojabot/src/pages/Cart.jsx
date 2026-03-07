import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { Minus, Plus, Trash2, ArrowLeft, Receipt, Sparkles } from 'lucide-react';
import axios from 'axios';

const Cart = () => {
    const { cart, updateQuantity, removeFromCart, addToCart, getCartTotals } = useStore();
    const navigate = useNavigate();

    const [upsellSuggestion, setUpsellSuggestion] = useState(null);
    const [showUpsell, setShowUpsell] = useState(false);
    const [isProceeding, setIsProceeding] = useState(false);
    const [hasSeenUpsell, setHasSeenUpsell] = useState(false);

    const { subtotal, tax, deliveryFee, total } = getCartTotals();

    const handleProceed = async () => {
        if (hasSeenUpsell) {
            navigate('/address');
            return;
        }

        setIsProceeding(true);
        try {
            const res = await axios.post('http://localhost:3001/api/ai/upsell', { cart });
            if (res.data.suggestion) {
                setUpsellSuggestion(res.data.suggestion);
                setShowUpsell(true);
            } else {
                navigate('/address');
            }
        } catch (error) {
            console.error(error);
            navigate('/address');
        }
        setIsProceeding(false);
    };

    if (cart.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
                <Receipt size={64} className="text-gray-300 mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Your cart is empty</h2>
                <p className="text-gray-500 mb-8">Looks like you haven't added anything yet.</p>
                <button
                    onClick={() => navigate('/menu')}
                    className="px-8 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors"
                >
                    Browse Menu
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            <div className="bg-white sticky top-0 z-20 shadow-sm border-b px-6 py-4 flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft size={24} className="text-gray-700" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Review Order</h1>
            </div>

            <div className="max-w-3xl mx-auto px-6 py-8">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm">1</span>
                        Order Items
                    </h2>

                    <div className="space-y-6">
                        {cart.map(item => (
                            <div key={item.id} className="flex gap-4 items-center">
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900">{item.name}</h3>
                                    <p className="text-orange-500 font-bold mb-1">₹{item.price}</p>
                                    {item.instructions && (
                                        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-[11px] px-2 py-0.5 rounded italic w-max">
                                            Note: {item.instructions}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
                                        <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-gray-600 hover:bg-gray-200 hover:text-gray-900 shadow-sm transition-colors">
                                            <Minus size={16} strokeWidth={3} />
                                        </button>
                                        <span className="font-bold text-gray-900 w-6 text-center">{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-gray-600 hover:bg-gray-200 hover:text-gray-900 shadow-sm transition-colors">
                                            <Plus size={16} strokeWidth={3} />
                                        </button>
                                    </div>
                                    <span className="font-extrabold text-gray-900 w-16 text-right">₹{item.price * item.quantity}</span>
                                    <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 transition-colors p-2">
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm">2</span>
                        Bill Details
                    </h2>

                    <div className="space-y-4 text-gray-600">
                        <div className="flex justify-between">
                            <span>Item Total</span>
                            <span className="font-medium text-gray-900">₹{subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Taxes & GST (5%)</span>
                            <span className="font-medium text-gray-900">₹{tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="flex items-center gap-2">
                                Delivery Fee
                                {deliveryFee === 0 && <span className="text-green-600 font-bold text-[10px] bg-green-100 px-2 py-0.5 rounded-md border border-green-200 uppercase tracking-widest">Free for orders &gt; ₹200</span>}
                            </span>
                            <span className="font-medium text-gray-900 flex items-center gap-2">
                                {deliveryFee === 0 ? (
                                    <>
                                        <span className="text-gray-400 line-through text-sm font-normal">₹30</span>
                                        <span className="text-green-600 font-black">₹0</span>
                                    </>
                                ) : (
                                    <span>₹{deliveryFee.toFixed(2)}</span>
                                )}
                            </span>
                        </div>
                        <div className="h-px bg-gray-200 my-4"></div>
                        <div className="flex justify-between text-xl font-black text-gray-900">
                            <span>To Pay</span>
                            <span>₹{total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-30">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-gray-500">Amount to pay</p>
                        <p className="text-2xl font-black text-gray-900">₹{total.toFixed(2)}</p>
                    </div>
                    <button
                        onClick={handleProceed}
                        disabled={isProceeding}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-orange-500/20 transition-all hover:scale-105 select-none disabled:opacity-50"
                    >
                        {isProceeding ? 'Checking...' : 'Proceed to Payment'}
                    </button>
                </div>
            </div>

            {showUpsell && upsellSuggestion && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => navigate('/address')}></div>
                    <div className="relative bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                            <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                                <Sparkles size={40} className="text-orange-500" />
                            </div>
                        </div>
                        <div className="mt-8 text-center">
                            <h3 className="text-2xl font-black text-gray-900 mb-2">Wait! Pair it up?</h3>
                            <p className="text-gray-500 mb-6">Others who ordered this also added:</p>

                            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex items-center gap-4 mb-8 text-left">
                                <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center text-orange-500 font-bold text-xl">
                                    AI
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900">{upsellSuggestion.name}</h4>
                                    <p className="text-orange-500 font-bold">₹{upsellSuggestion.price}</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        addToCart({ ...upsellSuggestion, quantity: 1 });
                                        setHasSeenUpsell(true);
                                        setShowUpsell(false);
                                    }}
                                    className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30"
                                >
                                    Add & Continue
                                </button>
                                <button
                                    onClick={() => navigate('/address')}
                                    className="w-full bg-gray-100 text-gray-700 font-bold py-4 rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    No thanks, Pay Now
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Cart;
