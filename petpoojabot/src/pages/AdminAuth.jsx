import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ShieldCheck, ArrowRight } from 'lucide-react';
import AdminDashboard from './AdminDashboard';

const AdminAuth = () => {
    const navigate = useNavigate();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [mode, setMode] = useState(null); // 'guest' or 'admin'
    const [credentials, setCredentials] = useState({ id: '', password: '' });
    const [error, setError] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();
        // Fixed credentials per requirement
        if (credentials.id === 'pb100' && credentials.password === 'p@ssw0rd') {
            setIsAuthenticated(true);
            setError('');
        } else {
            setError('Invalid Admin ID or Password');
        }
    };

    const handleGuestSelect = () => {
        navigate('/');
    };

    // If authenticated, render the actual dashboard
    if (isAuthenticated) {
        return <AdminDashboard />;
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-sans">
            <div className="max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-900 text-white shadow-xl mb-4">
                        <ShieldCheck size={32} />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 mb-2">System Portal</h1>
                    <p className="text-gray-500 font-medium text-sm">Select your access level to continue</p>
                </div>

                {!mode ? (
                    /* Initial Selection Screen */
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <button
                            onClick={handleGuestSelect}
                            className="w-full bg-white border border-gray-200 p-6 rounded-3xl flex items-center justify-between group hover:border-orange-500 hover:shadow-lg hover:shadow-orange-500/10 transition-all text-left"
                        >
                            <div className="flex items-center gap-4">
                                <div className="bg-orange-50 text-orange-600 p-3 rounded-xl group-hover:scale-110 transition-transform">
                                    <User size={24} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Guest User</h2>
                                    <p className="text-sm font-medium text-gray-500 mt-1">Access the public ordering app</p>
                                </div>
                            </div>
                            <ArrowRight className="text-gray-300 group-hover:text-orange-500 transition-colors" />
                        </button>

                        <button
                            onClick={() => setMode('admin')}
                            className="w-full bg-gray-900 border border-gray-800 p-6 rounded-3xl flex items-center justify-between group hover:bg-black hover:shadow-xl transition-all text-left"
                        >
                            <div className="flex items-center gap-4">
                                <div className="bg-white/10 text-white p-3 rounded-xl group-hover:scale-110 transition-transform">
                                    <Lock size={24} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">Admin Login</h2>
                                    <p className="text-sm font-medium text-gray-400 mt-1">Access intelligence & analytics</p>
                                </div>
                            </div>
                            <ArrowRight className="text-gray-600 group-hover:text-white transition-colors" />
                        </button>
                    </div>
                ) : (
                    /* Admin Login Form */
                    <div className="bg-white border border-gray-100 p-8 rounded-3xl shadow-xl shadow-gray-200/50 animate-in fade-in zoom-in-95 duration-300 relative">
                        <button
                            onClick={() => setMode(null)}
                            className="absolute top-6 left-6 text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors"
                        >
                            &larr; Back
                        </button>

                        <div className="text-center mb-8 mt-4">
                            <h2 className="text-2xl font-black text-gray-900">Admin Login</h2>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold text-center">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Admin ID</label>
                                <input
                                    type="text"
                                    required
                                    value={credentials.id}
                                    onChange={(e) => setCredentials({ ...credentials, id: e.target.value })}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all font-medium"
                                    placeholder="Enter Admin ID"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Password</label>
                                <input
                                    type="password"
                                    required
                                    value={credentials.password}
                                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all font-medium"
                                    placeholder="••••••••"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-gray-900 hover:bg-black text-white rounded-xl py-4 font-bold tracking-wide transition-all shadow-lg active:scale-[0.98] mt-2"
                            >
                                Secure Login
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminAuth;
