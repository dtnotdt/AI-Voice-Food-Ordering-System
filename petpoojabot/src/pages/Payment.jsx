import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { ArrowLeft, CreditCard, Smartphone, Banknote, Building2, CheckCircle2, Loader2, XCircle, QrCode, Clock, Shield, Sparkles } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';

// ── Canned UPI ID for testing ──
const UPI_ID = 'petpoojabot@upi';
const UPI_PAYEE_NAME = 'PetpoojaBot Restaurant';

const Payment = () => {
    const navigate = useNavigate();
    const { cart, clearCart, setCurrentOrder, getCartTotals, deliveryAddress } = useStore();
    const { total } = getCartTotals();

    const [selectedMethod, setSelectedMethod] = useState('UPI');
    const [paymentStatus, setPaymentStatus] = useState('idle'); // idle, qr_shown, processing, success, failed
    const [qrVisible, setQrVisible] = useState(false);
    const [countdown, setCountdown] = useState(120); // 2 minutes QR expiry
    const [scanSimulated, setScanSimulated] = useState(false);

    const methods = [
        { id: 'UPI', icon: <Smartphone size={24} className="text-purple-500" />, desc: 'Pay via UPI QR Code' },
        { id: 'Credit/Debit Card', icon: <CreditCard size={24} className="text-blue-500" />, desc: 'Visa, Mastercard, RuPay' },
        { id: 'Net Banking', icon: <Building2 size={24} className="text-indigo-500" />, desc: 'All major banks' },
        { id: 'Cash on Delivery', icon: <Banknote size={24} className="text-green-500" />, desc: 'Pay agent at doorstep' }
    ];

    // ── Generate UPI deep link URI ──
    const generateUpiUri = useCallback(() => {
        const params = new URLSearchParams({
            pa: UPI_ID,              // Payee VPA
            pn: UPI_PAYEE_NAME,     // Payee Name
            am: total.toFixed(2),   // Amount
            cu: 'INR',              // Currency
            tn: `PetpoojaBot Order - ${cart.length} items`,  // Transaction note
        });
        return `upi://pay?${params.toString()}`;
    }, [total, cart.length]);

    // ── QR Countdown timer ──
    useEffect(() => {
        if (paymentStatus !== 'qr_shown') return;
        if (countdown <= 0) {
            setPaymentStatus('idle');
            setQrVisible(false);
            setCountdown(120);
            return;
        }
        const timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [paymentStatus, countdown]);

    // ── Handle "Pay Now" → show QR or process other methods ──
    const handlePayment = () => {
        if (selectedMethod === 'UPI') {
            setPaymentStatus('qr_shown');
            setQrVisible(true);
            setCountdown(120);
            return;
        }
        // For non-UPI, go straight to processing
        processPayment();
    };

    // ── Simulate QR scan success ──
    const simulateQrScan = () => {
        setScanSimulated(true);
        processPayment();
    };

    // ── Process payment (shared for all methods) ──
    const processPayment = () => {
        setPaymentStatus('processing');

        setTimeout(async () => {
            const isSuccess = selectedMethod === 'Cash on Delivery' || Math.random() > 0.1;

            if (isSuccess) {
                setPaymentStatus('success');

                try {
                    const res = await axios.post('http://localhost:3001/api/order', {
                        items: cart,
                        paymentMethod: selectedMethod,
                        paymentStatus: selectedMethod === 'Cash on Delivery' ? 'Pending' : 'Completed',
                        total,
                        delivery: true,
                        address: deliveryAddress
                    });

                    setCurrentOrder(res.data);

                    setTimeout(() => {
                        clearCart();
                        navigate('/tracking');
                    }, 2000);
                } catch (e) {
                    setPaymentStatus('failed');
                }
            } else {
                setPaymentStatus('failed');
            }
        }, 2500);
    };

    // ── Processing screen ──
    if (paymentStatus === 'processing') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="relative">
                    <Loader2 size={64} className="animate-spin text-orange-500 mb-6" />
                    <div className="absolute inset-0 animate-ping opacity-20">
                        <Loader2 size={64} className="text-orange-500" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Payment...</h2>
                <p className="text-gray-500">Please do not close this window or press back.</p>
                <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
                    <Shield size={14} /> <span>256-bit SSL encrypted</span>
                </div>
            </div>
        );
    }

    // ── Success screen ──
    if (paymentStatus === 'success') {
        return (
            <div className="min-h-screen bg-gradient-to-b from-green-50 to-emerald-50 flex flex-col items-center justify-center p-6 text-center">
                <style>{`
                    @keyframes success-ring {
                        0% { transform: scale(0.8); opacity: 0; }
                        50% { transform: scale(1.2); opacity: 0.5; }
                        100% { transform: scale(1); opacity: 1; }
                    }
                    @keyframes confetti-fall {
                        0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
                        100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                    }
                `}</style>
                {/* Confetti particles */}
                {[...Array(12)].map((_, i) => (
                    <div key={i} className="fixed text-2xl pointer-events-none" style={{
                        left: `${10 + (i * 7)}%`,
                        top: '-20px',
                        animation: `confetti-fall ${2 + Math.random() * 2}s ease-in ${i * 0.1}s forwards`,
                    }}>
                        {['🎉', '✨', '🎊', '💰'][i % 4]}
                    </div>
                ))}
                <div className="w-28 h-28 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-green-500/40" style={{ animation: 'success-ring 0.6s ease-out' }}>
                    <CheckCircle2 size={56} className="text-white" />
                </div>
                <h2 className="text-3xl font-extrabold text-gray-900 mb-2 leading-tight">Payment Successful!</h2>
                <p className="text-gray-600 mb-2 max-w-xs">Your order has been placed successfully and sent to the kitchen.</p>
                <p className="text-sm text-green-600 font-bold mb-8">Paid ₹{total.toFixed(2)} via {selectedMethod}</p>
                <div className="bg-white px-8 py-4 rounded-full border border-green-200 text-green-800 font-bold shadow-sm flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Redirecting to Tracking...
                </div>
            </div>
        );
    }

    // ── Failed screen ──
    if (paymentStatus === 'failed') {
        return (
            <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-red-500/30">
                    <XCircle size={48} className="text-white" />
                </div>
                <h2 className="text-3xl font-extrabold text-gray-900 mb-2 leading-tight">Payment Failed</h2>
                <p className="text-gray-600 mb-8 max-w-xs">Something went wrong while processing your payment. Please try again.</p>
                <button onClick={() => { setPaymentStatus('idle'); setQrVisible(false); setScanSimulated(false); }} className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-2xl font-bold transition-colors">
                    Retry Payment
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            <style>{`
                @keyframes qr-appear {
                    0% { transform: scale(0.5) rotateY(90deg); opacity: 0; }
                    60% { transform: scale(1.05) rotateY(-5deg); }
                    100% { transform: scale(1) rotateY(0); opacity: 1; }
                }
                @keyframes pulse-ring {
                    0% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4); }
                    70% { box-shadow: 0 0 0 15px rgba(168, 85, 247, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0); }
                }
            `}</style>
            <div className="bg-white sticky top-0 z-20 shadow-sm border-b px-6 py-4 flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft size={24} className="text-gray-700" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Select Payment Method</h1>
            </div>

            <div className="max-w-xl mx-auto px-6 py-8">
                {/* Amount card */}
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-6 shadow-xl mb-6 flex justify-between items-center text-white">
                    <div>
                        <p className="text-sm text-gray-400 font-medium">Amount to pay</p>
                        <p className="text-4xl font-black">₹{total.toFixed(2)}</p>
                        <p className="text-xs text-gray-500 mt-1">{cart.length} item{cart.length !== 1 ? 's' : ''} • incl. GST</p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-2xl">
                        <Banknote size={32} className="text-white/60" />
                    </div>
                </div>

                <h2 className="text-lg font-bold text-gray-900 mb-4 px-2">Payment Options</h2>

                <div className="space-y-3">
                    {methods.map(method => (
                        <div
                            key={method.id}
                            onClick={() => { setSelectedMethod(method.id); setQrVisible(false); setPaymentStatus('idle'); }}
                            className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer ${selectedMethod === method.id ? 'border-orange-500 bg-orange-50 shadow-md shadow-orange-500/10' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                        >
                            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                {method.icon}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900">{method.id}</h3>
                                <p className="text-xs text-gray-500 mt-0.5">{method.desc}</p>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedMethod === method.id ? 'border-orange-500' : 'border-gray-300'}`}>
                                {selectedMethod === method.id && <div className="w-3 h-3 bg-orange-500 rounded-full"></div>}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── UPI QR Code Display ── */}
                {qrVisible && selectedMethod === 'UPI' && (
                    <div className="mt-8 bg-white rounded-3xl p-8 border-2 border-purple-100 shadow-xl" style={{ animation: 'qr-appear 0.6s ease-out' }}>
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <QrCode size={20} className="text-purple-600" />
                                <h3 className="text-xl font-extrabold text-gray-900">Scan to Pay</h3>
                            </div>
                            <p className="text-sm text-gray-500 mb-6">Scan this QR code with any UPI app to complete payment</p>

                            {/* QR Code with animated ring */}
                            <div className="inline-block p-4 bg-white rounded-2xl border-2 border-purple-200 relative" style={{ animation: 'pulse-ring 2s ease-out infinite' }}>
                                <QRCodeSVG
                                    value={generateUpiUri()}
                                    size={220}
                                    bgColor="#ffffff"
                                    fgColor="#1f2937"
                                    level="H"
                                    includeMargin={true}
                                    imageSettings={{
                                        src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23a855f7'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z'/%3E%3C/svg%3E",
                                        x: undefined,
                                        y: undefined,
                                        height: 30,
                                        width: 30,
                                        excavate: true,
                                    }}
                                />
                            </div>

                            {/* UPI Details */}
                            <div className="mt-6 space-y-2">
                                <div className="bg-purple-50 rounded-xl px-4 py-3 flex items-center justify-between">
                                    <span className="text-sm text-purple-700 font-medium">UPI ID</span>
                                    <span className="text-sm font-bold text-purple-900 font-mono">{UPI_ID}</span>
                                </div>
                                <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
                                    <span className="text-sm text-gray-600 font-medium">Amount</span>
                                    <span className="text-lg font-black text-gray-900">₹{total.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Countdown timer */}
                            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-400">
                                <Clock size={14} />
                                <span>QR expires in <span className={`font-bold ${countdown < 30 ? 'text-red-500' : 'text-gray-600'}`}>{Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}</span></span>
                            </div>

                            {/* Simulate payment button */}
                            <button
                                onClick={simulateQrScan}
                                disabled={scanSimulated}
                                className="mt-6 w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-purple-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Sparkles size={20} />
                                {scanSimulated ? 'Processing...' : 'Simulate QR Scan (Demo)'}
                            </button>

                            <p className="text-[10px] text-gray-400 mt-3 flex items-center justify-center gap-1">
                                <Shield size={10} /> Secured by UPI • 256-bit end-to-end encryption
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom pay button — hidden when QR is shown */}
            {!qrVisible && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-30 flex justify-center">
                    <button
                        onClick={handlePayment}
                        className="w-full max-w-xl bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] select-none text-lg flex items-center justify-center gap-3"
                    >
                        {selectedMethod === 'UPI' && <QrCode size={20} />}
                        {selectedMethod === 'Cash on Delivery' ? 'Confirm Order' :
                         selectedMethod === 'UPI' ? `Show QR • ₹${total.toFixed(2)}` :
                         `Pay ₹${total.toFixed(2)} securely`}
                    </button>
                </div>
            )}
        </div>
    );
};

export default Payment;
