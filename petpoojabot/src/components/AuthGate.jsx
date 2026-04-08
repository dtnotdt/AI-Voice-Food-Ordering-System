import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { User, ShieldCheck, Mail, Phone, ArrowRight, CheckCircle2, AlertTriangle, Loader2, RefreshCw, Code2 } from 'lucide-react';

// ─── Status type constants ──────────────────────────────────────────────────
const STATUS = {
    IDLE:              'idle',
    SENDING:           'sending',
    OTP_SENT_REAL:     'otp_sent_real',
    OTP_SENT_DEV:      'otp_sent_dev',
    OTP_SENT_FALLBACK: 'otp_sent_fallback',
    VERIFYING:         'verifying',
    ERROR:             'error',
    COOLDOWN:          'cooldown',
};

const AuthGate = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [step, setStep] = useState(1);                   // 1: role, 2: details, 3: otp
    const [formData, setFormData] = useState({ fullName: '', phone: '', email: '' });
    const [method, setMethod] = useState('phone');          // 'phone' | 'email'
    const [otp, setOtp] = useState('');
    const [status, setStatus] = useState(STATUS.IDLE);
    const [errorMsg, setErrorMsg] = useState('');
    const [statusMsg, setStatusMsg] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [devOtp, setDevOtp] = useState(null);            // Only set in dev fallback mode
    const [deliveryChannel, setDeliveryChannel] = useState(null);

    const location = useLocation();

    // ── Session check on mount ──────────────────────────────────────────────
    useEffect(() => {
        const token = localStorage.getItem('petpooja_auth_token');
        if (token) setIsAuthenticated(true);
    }, []);

    // ── Countdown timer ─────────────────────────────────────────────────────
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0 && status === STATUS.COOLDOWN) {
            setStatus(status === STATUS.COOLDOWN ? STATUS.OTP_SENT_REAL : status);
        }
    }, [countdown]);

    const isLoading = status === STATUS.SENDING || status === STATUS.VERIFYING;

    // ── Form validation ─────────────────────────────────────────────────────
    const validateDetails = () => {
        if (formData.fullName.trim().length < 2) return 'A valid Full Name (min 2 chars) is required.';

        const rawPhone = formData.phone.replace(/\D/g, '');
        if (rawPhone.length < 10 || rawPhone.length > 15) return 'Enter a valid phone number (10-15 digits).';

        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(formData.email.trim())) return 'Enter a valid email address.';
        return null;
    };

    // ── Send OTP ────────────────────────────────────────────────────────────
    const handleSendOTP = async () => {
        const err = validateDetails();
        if (err) { setErrorMsg(err); return; }

        setErrorMsg('');
        setDevOtp(null);
        setStatus(STATUS.SENDING);
        setStatusMsg('Sending OTP…');

        try {
            const res = await fetch('http://localhost:8000/api/auth/request-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name:            formData.fullName,
                    phone_number:         formData.phone,
                    email_id:             formData.email,
                    verification_method:  method,
                }),
            });

            const data = await res.json();

            if (res.status === 429) {
                // Cooldown response
                setStatus(STATUS.COOLDOWN);
                setErrorMsg(typeof data.detail === 'string' ? data.detail : 'Please wait before requesting a new OTP.');
                const match = (data.detail || '').match(/(\d+) seconds/);
                if (match) setCountdown(parseInt(match[1], 10));
                return;
            }

            if (!res.ok) {
                // Real provider failure
                const detail = data.detail;
                const msg = typeof detail === 'object'
                    ? (detail.error || 'OTP delivery failed.')
                    : (detail || 'OTP delivery failed.');
                setStatus(STATUS.ERROR);
                setErrorMsg(msg);
                return;
            }

            // Success — determine if real or dev fallback
            setCountdown(60);
            setDeliveryChannel(data.channel);

            if (data.is_dev_fallback && data.dev_otp) {
                setDevOtp(data.dev_otp);
                setStatus(STATUS.OTP_SENT_DEV);
                setStatusMsg(`Development fallback active. Your OTP is shown below.`);
            } else if (data.channel === 'email' && method === 'phone') {
                setStatus(STATUS.OTP_SENT_FALLBACK);
                setStatusMsg(`SMS delivery failed. OTP sent to your email instead.`);
            } else {
                setStatus(STATUS.OTP_SENT_REAL);
                setStatusMsg(`OTP sent via ${data.channel === 'sms' ? 'SMS' : 'email'} to ${data.contact}`);
            }
            setStep(3);

        } catch (err) {
            setStatus(STATUS.ERROR);
            setErrorMsg('Cannot reach the server. Make sure the Python backend is running on port 8000.');
        }
    };

    // ── Verify OTP ──────────────────────────────────────────────────────────
    const handleVerifyOTP = async () => {
        if (otp.trim().length < 4) { setErrorMsg('Please enter a valid OTP.'); return; }

        setErrorMsg('');
        setStatus(STATUS.VERIFYING);

        const contactValue = method === 'phone' ? formData.phone : formData.email;

        try {
            const res = await fetch('http://localhost:8000/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contact_value: contactValue, otp: otp.trim() }),
            });

            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('petpooja_auth_token', data.token);
                localStorage.setItem('petpooja_role', 'user');
                if (formData.phone) {
                    localStorage.setItem('petpooja_phone', formData.phone.replace(/\D/g, '').slice(-10));
                }
                setIsAuthenticated(true);
            } else {
                const detail = typeof data.detail === 'string' ? data.detail : 'Invalid OTP.';
                setStatus(step === 3 ? STATUS.OTP_SENT_REAL : STATUS.ERROR);
                setErrorMsg(detail);
            }
        } catch (err) {
            setStatus(STATUS.ERROR);
            setErrorMsg('Server error during verification. Make sure the Python backend is running.');
        }
    };

    // ── Admin bypass ────────────────────────────────────────────────────────
    const handleRoleSelect = (role) => {
        if (role === 'admin') {
            localStorage.setItem('petpooja_auth_token', 'admin_bypass');
            localStorage.setItem('petpooja_role', 'admin');
            setIsAuthenticated(true);
        } else {
            setStep(2);
        }
    };

    // ── Render Guard ────────────────────────────────────────────────────────
    if (isAuthenticated || location.pathname === '/admin') return children;

    return (
        <div className="fixed inset-0 z-[9999] bg-orange-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 my-4">

                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-red-600 p-8 text-center">
                    <h1 className="text-4xl font-extrabold text-white mb-1">PetpoojaBot<span className="text-yellow-300">.</span></h1>
                    <p className="text-orange-100 font-medium text-sm">
                        {step === 1 ? 'Select how you want to access' : step === 2 ? 'Enter your details' : 'Verify your identity'}
                    </p>
                </div>

                <div className="p-8">

                    {/* Global Error Banner */}
                    {errorMsg && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium flex items-start gap-2">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Status Banner (non-error) */}
                    {statusMsg && !errorMsg && (
                        <div className={`mb-4 p-3 rounded-xl text-sm font-medium flex items-start gap-2 ${
                            status === STATUS.OTP_SENT_DEV
                                ? 'bg-yellow-50 border border-yellow-300 text-yellow-800'
                                : status === STATUS.OTP_SENT_FALLBACK
                                ? 'bg-blue-50 border border-blue-200 text-blue-800'
                                : 'bg-green-50 border border-green-200 text-green-700'
                        }`}>
                            {status === STATUS.OTP_SENT_DEV ? <Code2 size={16} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
                            <span>{statusMsg}</span>
                        </div>
                    )}

                    {/* ── Step 1: Role Selection ── */}
                    {step === 1 && (
                        <div className="flex flex-col gap-4">
                            <h2 className="text-xl font-bold text-gray-800 text-center mb-4">Who are you?</h2>

                            <button
                                onClick={() => handleRoleSelect('user')}
                                className="group flex items-center p-4 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-2xl transition-all"
                            >
                                <div className="bg-orange-500 text-white p-3 rounded-full mr-4 group-hover:scale-110 transition-transform">
                                    <User size={24} />
                                </div>
                                <div className="text-left flex-1">
                                    <h3 className="font-bold text-gray-900">Normal User</h3>
                                    <p className="text-xs text-gray-500">Order food with voice &amp; menu</p>
                                </div>
                                <ArrowRight className="text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>

                            <button
                                onClick={() => handleRoleSelect('admin')}
                                className="group flex items-center p-4 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-2xl transition-all"
                            >
                                <div className="bg-zinc-800 text-white p-3 rounded-full mr-4 group-hover:scale-110 transition-transform">
                                    <ShieldCheck size={24} />
                                </div>
                                <div className="text-left flex-1">
                                    <h3 className="font-bold text-gray-900">Admin Side</h3>
                                    <p className="text-xs text-gray-500">Manage restaurant operations</p>
                                </div>
                                <ArrowRight className="text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        </div>
                    )}

                    {/* ── Step 2: Enter Details ── */}
                    {step === 2 && (
                        <div className="flex flex-col gap-4 animate-in slide-in-from-right-4">
                            <h2 className="text-xl font-bold text-gray-800 mb-2">Enter Your Details</h2>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                                <input
                                    type="text"
                                    value={formData.fullName}
                                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                    placeholder="John Doe"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone Number</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                    placeholder="+91 9876543210"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Address</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                    placeholder="john@example.com"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mt-2 mb-1">Send OTP via</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setMethod('phone')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-sm transition-all ${method === 'phone' ? 'bg-orange-100 border-orange-500 text-orange-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                                    >
                                        <Phone size={16} /> Phone
                                    </button>
                                    <button
                                        onClick={() => setMethod('email')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-sm transition-all ${method === 'email' ? 'bg-orange-100 border-orange-500 text-orange-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                                    >
                                        <Mail size={16} /> Email
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleSendOTP}
                                disabled={isLoading}
                                className="mt-4 w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-70 flex justify-center items-center gap-2"
                            >
                                {isLoading ? <><Loader2 size={18} className="animate-spin" /> Sending…</> : 'Send OTP'}
                            </button>

                            <button onClick={() => { setStep(1); setErrorMsg(''); }} className="text-gray-400 text-sm font-medium hover:text-gray-600 mt-2">
                                ← Back
                            </button>
                        </div>
                    )}

                    {/* ── Step 3: Enter OTP ── */}
                    {step === 3 && (
                        <div className="flex flex-col gap-4 animate-in slide-in-from-right-4 text-center">
                            <div className={`mx-auto p-3 rounded-full mb-2 ${status === STATUS.OTP_SENT_DEV ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'}`}>
                                {status === STATUS.OTP_SENT_DEV ? <Code2 size={32} /> : <CheckCircle2 size={32} />}
                            </div>

                            <h2 className="text-2xl font-bold text-gray-800">Enter Verification Code</h2>

                            <p className="text-gray-500 text-sm">
                                {status === STATUS.OTP_SENT_DEV
                                    ? <>Development mode — no provider configured.<br />Your OTP is shown below.</>
                                    : status === STATUS.OTP_SENT_FALLBACK
                                    ? <>SMS failed. OTP sent to <span className="font-bold text-gray-700">{formData.email}</span> instead.</>
                                    : <>OTP sent to <span className="font-bold text-gray-700">{method === 'phone' ? formData.phone : formData.email}</span>{deliveryChannel === 'sms' ? ' via SMS' : ' via Email'}.</>
                                }
                            </p>

                            {/* ── Developer Fallback Box ── */}
                            {status === STATUS.OTP_SENT_DEV && devOtp && (
                                <div className="mt-2 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-2xl text-left">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Code2 size={16} className="text-yellow-600" />
                                        <span className="text-xs font-bold text-yellow-700 uppercase tracking-wider">⚠ Development Fallback Mode</span>
                                    </div>
                                    <p className="text-xs text-yellow-700 mb-3">
                                        No SMS or Email provider is configured. Your OTP is shown here <strong>for testing only</strong>. This box is hidden in production.
                                    </p>
                                    <div className="bg-yellow-100 rounded-xl p-3 text-center">
                                        <p className="text-xs text-yellow-600 font-medium mb-1">Your OTP Code</p>
                                        <p className="text-4xl font-black tracking-[0.4em] text-yellow-900">{devOtp}</p>
                                    </div>
                                    <p className="text-xs text-yellow-600 mt-2">
                                        To use real delivery: set <code className="bg-yellow-200 px-1 rounded">TWILIO_*</code> or <code className="bg-yellow-200 px-1 rounded">SMTP_*</code> env vars, then restart the backend.
                                    </p>
                                </div>
                            )}

                            <input
                                type="text"
                                maxLength={6}
                                value={otp}
                                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                                onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
                                className="w-full text-center text-3xl tracking-[0.5em] font-bold py-4 border-2 border-orange-200 rounded-xl focus:border-orange-500 outline-none transition-colors mt-4"
                                placeholder="------"
                                autoFocus
                            />

                            <button
                                onClick={handleVerifyOTP}
                                disabled={isLoading || otp.length < 4}
                                className="mt-2 w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-70 flex justify-center items-center gap-2"
                            >
                                {status === STATUS.VERIFYING ? <><Loader2 size={18} className="animate-spin" /> Verifying…</> : 'Verify & Continue'}
                            </button>

                            {/* Resend / Cooldown */}
                            <div className="text-sm font-medium mt-2">
                                {countdown > 0 ? (
                                    <span className="text-gray-400">
                                        Resend OTP in <span className="text-orange-600 font-bold">{countdown}s</span>
                                    </span>
                                ) : (
                                    <button
                                        onClick={handleSendOTP}
                                        disabled={isLoading}
                                        className="text-orange-600 hover:text-orange-800 underline flex items-center justify-center gap-1 mx-auto"
                                    >
                                        <RefreshCw size={14} /> Resend OTP
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={() => { setStep(2); setOtp(''); setErrorMsg(''); setDevOtp(null); setStatus(STATUS.IDLE); setStatusMsg(''); }}
                                className="text-gray-400 text-sm font-medium hover:text-gray-600 mt-1"
                            >
                                ← Change Details
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthGate;
