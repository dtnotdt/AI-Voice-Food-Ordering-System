import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ZAxis, BarChart, Bar } from 'recharts';
import { 
    Activity, TrendingUp, TrendingDown, Package, ShieldCheck, 
    BrainCircuit, DollarSign, RefreshCw, AlertTriangle, ArrowUpRight, ArrowDownRight,
    Crosshair, Star
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const AdminDashboard = () => {
    const [analytics, setAnalytics] = useState(null);
    const [activeTab, setActiveTab] = useState('profitability');
    const [menuWithRatings, setMenuWithRatings] = useState([]);
    const [ratingSearch, setRatingSearch] = useState('');
    const [ratingToast, setRatingToast] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    // Fetch menu items with ratings for the ratings tab
    useEffect(() => {
        const fetchMenu = async () => {
            try {
                const res = await axios.get('http://localhost:3001/api/menu');
                setMenuWithRatings(res.data.items);
            } catch (err) { console.error('Failed to load menu', err); }
        };
        fetchMenu();
    }, []);

    // Admin: update a single item's rating
    const updateRating = async (id, newRating) => {
        try {
            const res = await axios.put(`http://localhost:3001/api/admin/ratings/${id}`, { rating: newRating });
            // Update local state
            setMenuWithRatings(prev => prev.map(item => item.id === id ? { ...item, rating: res.data.rating } : item));
            setRatingToast(`⭐ ${res.data.name} → ${res.data.rating}`);
            setTimeout(() => setRatingToast(null), 2000);
        } catch (err) {
            console.error('Failed to update rating', err);
        }
    };

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const res = await axios.get('http://localhost:3001/api/admin/analytics');
                setAnalytics(res.data);
            } catch (err) {
                console.error("Failed to load analytics", err);
            }
        };
        fetchAnalytics();
        const interval = setInterval(fetchAnalytics, 5000);
        return () => clearInterval(interval);
    }, []);

    const logout = () => {
        // Since we secure via memory state in AdminAuth, refreshing or navigating out clears it
        navigate('/');
        window.location.reload();
    };

    if (!analytics) return (
        <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
            <RefreshCw size={48} className="animate-spin text-orange-500 mb-4" />
            <span className="font-bold text-xl text-gray-800">Booting Revenue Engine...</span>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 pb-12 font-sans">
            <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-30 px-6 py-4 flex justify-between items-center text-white">
                <div className="flex items-center gap-3 relative group">
                    <div className="bg-gradient-to-tr from-orange-500 to-red-600 p-2.5 rounded-xl text-white shadow-lg shadow-orange-500/20">
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-wide text-white">Admin Intelligence</h1>
                        <p className="text-orange-400 text-xs font-bold tracking-widest uppercase mt-0.5">Revenue Engine Active</p>
                    </div>
                </div>
                <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-2 bg-green-500/10 text-green-400 px-4 py-2 rounded-xl font-bold text-sm border border-green-500/20">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        System Online
                    </div>
                    <button onClick={logout} className="text-sm font-bold text-gray-400 hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-xl hover:bg-white/10">
                        Exit
                    </button>
                </div>
            </nav>

            <div className="p-6 max-w-7xl mx-auto space-y-8">
                {/* ── 1. Top Level Metrics ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard 
                        title="Total Menu Profit (Simulated)" 
                        value={`₹${analytics.overview.totalMenuProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} 
                        icon={<DollarSign size={24} />} 
                        bg="bg-emerald-50" color="text-emerald-600" border="border-emerald-100" 
                    />
                    <StatCard 
                        title="Avg Margin %" 
                        value={`${analytics.overview.avgMarginPercent}%`} 
                        icon={<Activity size={24} />} 
                        bg="bg-indigo-50" color="text-indigo-600" border="border-indigo-100" 
                    />
                    <StatCard 
                        title="Live Orders" 
                        value={analytics.profitability.reduce((sum, p) => sum + p.qtySold, 0)} 
                        icon={<Package size={24} />} 
                        bg="bg-orange-50" color="text-orange-600" border="border-orange-100" 
                    />
                </div>

                {/* ── Filter Tabs ── */}
                <div className="flex bg-white p-2 rounded-2xl shadow-sm border border-gray-100 gap-2 overflow-x-auto">
                    {['profitability', 'sales_rank', 'pricing', 'combos', 'ratings'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeTab === tab ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            {tab === 'profitability' ? 'Margin & Profitability' :
                             tab === 'sales_rank' ? 'Sales Velocity & Velocity' :
                             tab === 'pricing' ? 'Smart Pricing & Risks' :
                             tab === 'combos' ? 'Market Basket (Combos)' :
                             '⭐ Ratings Manager'}
                        </button>
                    ))}
                </div>

                {/* ── Tab: Margin & Profitability ── */}
                {activeTab === 'profitability' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {/* 1 & 2. Margin Calculation & Item Level Profitability Table */}
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-black text-gray-900">Contribution Margin & Item Profitability</h2>
                                    <p className="text-xs text-gray-500 font-medium mt-1">Margin = Selling Price - Food Cost. Profit = Margin × Qty Sold.</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-white border-b border-gray-100">
                                            <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-widest pl-6">Item Name</th>
                                            <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Selling Price</th>
                                            <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Food Cost</th>
                                            <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Margin (₹)</th>
                                            <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Margin %</th>
                                            <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Qty Sold</th>
                                            <th className="p-4 text-xs font-black text-gray-900 uppercase tracking-widest pr-6 text-right">Total Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analytics.profitability.map((item, idx) => {
                                            const isHighMargin = parseFloat(item.marginPercent) >= 60;
                                            const isLowMargin = parseFloat(item.marginPercent) <= 30;
                                            return (
                                                <tr key={item.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                                    <td className="p-4 pl-6 font-bold text-gray-900">{item.name}</td>
                                                    <td className="p-4 font-semibold text-gray-600">₹{item.price}</td>
                                                    <td className="p-4 font-semibold text-gray-600">₹{item.cost}</td>
                                                    <td className="p-4 font-bold text-gray-900">₹{item.margin.toFixed(2)}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${isHighMargin ? 'bg-green-100 text-green-700' : isLowMargin ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                                            {item.marginPercent}%
                                                        </span>
                                                    </td>
                                                    <td className="p-4 font-bold text-gray-500">{item.qtySold}</td>
                                                    <td className="p-4 pr-6 text-right font-black text-gray-900 border-l border-gray-50">₹{item.profit.toFixed(0)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Profit vs Velocity Scatter Plot */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-[400px]">
                            <h2 className="text-lg font-black text-gray-900 mb-6">Profit vs Sales Velocity Matrix</h2>
                            <ResponsiveContainer width="100%" height="90%">
                                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis type="number" dataKey="qtySold" name="Velocity" label={{ value: 'Sales Velocity (Qty)', position: 'insideBottom', offset: -10 }} tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 600 }} />
                                    <YAxis type="number" dataKey="margin" name="Margin" tickFormatter={v => `₹${v}`} label={{ value: 'Margin (₹)', angle: -90, position: 'insideLeft' }} tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 600 }} />
                                    <ZAxis type="number" dataKey="profit" range={[100, 1000]} name="Profit" />
                                    <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '16px', border: '1px solid #f3f4f6', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', padding: '16px', fontWeight: 'bold' }} />
                                    <Scatter name="Items" data={analytics.profitability} fill="#f97316" fillOpacity={0.6} stroke="#ea580c" strokeWidth={2} />
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* ── Tab: Sales Velocity & Popularity ── */}
                {activeTab === 'sales_rank' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
                        {/* 3. Sales Velocity Ranking */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-emerald-100 text-emerald-600 p-2.5 rounded-xl"><TrendingUp size={24} /></div>
                                <h2 className="text-xl font-black text-gray-900">Top 5 Popular Items</h2>
                            </div>
                            <div className="space-y-4">
                                {analytics.topVelocity.map((item, idx) => (
                                    <div key={item.id} className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-2xl border border-emerald-50">
                                        <div className="flex items-center gap-4">
                                            <span className="text-2xl font-black text-emerald-200">0{idx + 1}</span>
                                            <div>
                                                <div className="font-bold text-gray-900">{item.name}</div>
                                                <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">{item.popularityScore} Pop Score</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-black text-emerald-600 text-lg">{item.qtySold}</div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Qty Sold</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-red-100">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-red-100 text-red-600 p-2.5 rounded-xl"><TrendingDown size={24} /></div>
                                <h2 className="text-xl font-black text-gray-900">Bottom 5 Slow Movers</h2>
                            </div>
                            <div className="space-y-4">
                                {analytics.bottomVelocity.map((item, idx) => (
                                    <div key={item.id} className="flex items-center justify-between p-4 bg-red-50/50 rounded-2xl border border-red-50">
                                        <div className="flex items-center gap-4">
                                            <span className="text-2xl font-black text-red-200">0{idx + 1}</span>
                                            <div>
                                                <div className="font-bold text-gray-900">{item.name}</div>
                                                <div className="text-xs font-bold text-red-600 uppercase tracking-wider">{item.popularityScore} Pop Score</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-black text-red-600 text-lg">{item.qtySold}</div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Qty Sold</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 7. Smart Upsell Prioritization */}
                        <div className="col-span-1 md:col-span-2 bg-gray-900 text-white p-8 rounded-3xl shadow-xl border border-gray-800 relative overflow-hidden mt-6">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
                            <div className="flex justify-between items-center mb-8 relative z-10">
                                <div className="flex items-center gap-3">
                                    <BrainCircuit className="text-indigo-400" size={32} />
                                    <div>
                                        <h2 className="text-xl font-black">AI Upsell Prioritization Logic</h2>
                                        <p className="text-xs font-semibold text-gray-400 mt-1">Items ranked by Margin (60%) and Popularity (40%) to feed the Voice Bot Upsell Engine.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 relative z-10">
                                {analytics.upsellPriorities.map((item, idx) => (
                                    <div key={idx} className="bg-white/5 border border-white/10 p-5 rounded-2xl">
                                        <span className="inline-block bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded text-[10px] font-black uppercase mb-3 text-right w-full">Priority {idx + 1}</span>
                                        <div className="font-bold text-lg mb-1">{item.name}</div>
                                        <div className="text-xs text-gray-400 font-medium">Margin: <span className="text-green-400 font-bold">₹{item.margin.toFixed(0)}</span></div>
                                        <div className="text-xs text-gray-400 font-medium mt-1">AI Score: <span className="text-white font-bold">{item.score}</span></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Tab: Pricing & Risk Insights ── */}
                {activeTab === 'pricing' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500">
                        {/* 8. Price Optimization Recommendations */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                            <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                                <Crosshair className="text-blue-500" /> Price Optimization Engine
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                            <th className="p-4 pl-6 rounded-l-xl">Item</th>
                                            <th className="p-4">Current Price</th>
                                            <th className="p-4">AI Recommended Action</th>
                                            <th className="p-4 rounded-r-xl">Reasoning</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {analytics.priceOptimization.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50/50 transition">
                                                <td className="p-4 pl-6 font-bold text-gray-900">{item.name}</td>
                                                <td className="p-4 font-semibold text-gray-600">₹{item.currentPrice}</td>
                                                <td className="p-4">
                                                    <span className={`px-3 py-1.5 rounded-lg text-xs font-black inline-flex items-center gap-1
                                                        ${item.action.includes('Increase') ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {item.action.includes('Increase') ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                                        {item.action}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm font-medium text-gray-600 max-w-xs">{item.reasoning}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 4. High-Margin / Under-Promoted */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-100">
                            <div className="flex gap-3 mb-6">
                                <div className="bg-indigo-100 text-indigo-600 p-2.5 rounded-xl h-fit"><ArrowUpRight size={24} /></div>
                                <div>
                                    <h2 className="text-lg font-black text-gray-900">Hidden Profit Opportunities</h2>
                                    <p className="text-xs font-semibold text-gray-500">High Margin + Low Sales (Under-promoted)</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {analytics.underPromoted.length === 0 && <p className="text-sm text-gray-400 font-medium">No hidden opportunities detected.</p>}
                                {analytics.underPromoted.map((item, idx) => (
                                    <div key={idx} className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-50 flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-gray-900">{item.name}</div>
                                            <div className="text-xs font-bold text-indigo-600 mt-1">{item.recommendation}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-0.5">Margin</div>
                                            <div className="font-black text-indigo-600">₹{item.margin.toFixed(0)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 5. Low-Margin / High-Volume Risk */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-red-100">
                            <div className="flex gap-3 mb-6">
                                <div className="bg-red-100 text-red-600 p-2.5 rounded-xl h-fit"><AlertTriangle size={24} /></div>
                                <div>
                                    <h2 className="text-lg font-black text-gray-900">Profit Leaks (Risks)</h2>
                                    <p className="text-xs font-semibold text-gray-500">Low Margin + High Sales Volume</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {analytics.riskDetection.length === 0 && <p className="text-sm text-gray-400 font-medium">No profit leaks detected.</p>}
                                {analytics.riskDetection.map((item, idx) => (
                                    <div key={idx} className="p-4 bg-red-50/50 rounded-2xl border border-red-50 flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-gray-900">{item.name}</div>
                                            <div className="text-xs font-bold text-red-600 mt-1">{item.recommendation}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-0.5">Velocity</div>
                                            <div className="font-black text-red-600">{item.qtySold} sold</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Tab: Market Basket (Combos) ── */}
                {activeTab === 'combos' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {/* 6. Automated Combo Recommendation (Association Rules) */}
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-orange-100">
                            <div className="flex justify-between items-start mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="bg-orange-100 text-orange-600 p-3 rounded-xl"><Package size={28} /></div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900">Association Rule Mining</h2>
                                        <p className="text-sm font-semibold text-gray-500 mt-1">Frequently bought together combinations derived from live order sets.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {analytics.comboRecommendations.map((combo, idx) => (
                                    <div key={idx} className="bg-orange-50/30 border border-orange-100 p-6 rounded-3xl hover:-translate-y-1 transition duration-300">
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="inline-block bg-orange-100 text-orange-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">Suggested Combo</span>
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                                <Activity size={12} /> {combo.frequency} co-occurrences
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900 mb-6">{combo.items}</h3>
                                        <div className="grid grid-cols-3 gap-4 border-t border-orange-100 pt-5">
                                            <div>
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Standard</div>
                                                <div className="font-semibold text-gray-500 line-through">₹{combo.standardPrice}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Suggested</div>
                                                <div className="font-black text-orange-600 text-xl">₹{combo.suggestedBundlePrice}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Est Margin</div>
                                                <div className="font-black text-green-600">₹{combo.profitMargin.toFixed(0)}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 9. Inventory Signals */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mt-6">
                            <h2 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
                                <AlertTriangle className="text-yellow-500" /> Inventory Performance Signals
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {analytics.inventorySignals.map((alert, idx) => {
                                    const colorClass = alert.type === 'critical' ? 'bg-red-50 border-red-200 text-red-700' :
                                        alert.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                                        'bg-blue-50 border-blue-200 text-blue-700';
                                    return (
                                        <div key={idx} className={`p-5 border rounded-2xl ${colorClass}`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <h3 className="font-bold text-gray-900">{alert.ingredient}</h3>
                                                <div className="font-black text-gray-900 text-lg bg-white/50 px-2 py-0.5 rounded-lg">{alert.stock}</div>
                                            </div>
                                            <p className="text-xs font-black uppercase mb-2">{alert.status}</p>
                                            <p className="text-xs font-medium text-gray-600 border-t border-black/10 pt-2">{alert.impact}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Ratings Management Tab ── */}
                {activeTab === 'ratings' && (
                    <div className="space-y-6">
                        {/* Rating Toast */}
                        {ratingToast && (
                            <div className="fixed top-20 right-6 z-50 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl font-bold text-sm animate-in slide-in-from-right duration-300">
                                {ratingToast}
                            </div>
                        )}

                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                <div>
                                    <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                                        <Star className="text-amber-400" fill="currentColor" /> Menu Ratings Manager
                                    </h2>
                                    <p className="text-gray-500 text-sm mt-1">Update ratings for any menu item. Changes sync to the ordering UI instantly.</p>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search items..."
                                    value={ratingSearch}
                                    onChange={e => setRatingSearch(e.target.value)}
                                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
                                />
                            </div>

                            <div className="divide-y divide-gray-50">
                                {menuWithRatings
                                    .filter(item => item.name.toLowerCase().includes(ratingSearch.toLowerCase()))
                                    .slice(0, 30)
                                    .map(item => (
                                    <div key={item.id} className="flex items-center justify-between py-4 gap-4 group hover:bg-gray-50/50 px-3 rounded-xl transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-400 text-xs font-mono">#{item.id}</span>
                                                <h4 className="font-bold text-gray-900 truncate">{item.name}</h4>
                                                <span className="text-xs text-gray-400 font-medium">{item.category}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                {/* Star display */}
                                                <div className="flex items-center gap-0.5">
                                                    {[1, 2, 3, 4, 5].map(star => (
                                                        <span
                                                            key={star}
                                                            className={`text-sm cursor-pointer transition-all hover:scale-125 ${star <= Math.round(item.rating || 0) ? 'text-amber-400' : 'text-gray-300'}`}
                                                            onClick={() => updateRating(item.id, star)}
                                                        >
                                                            ★
                                                        </span>
                                                    ))}
                                                </div>
                                                <span className="text-sm font-black text-gray-700">{(item.rating || 0).toFixed(1)}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 w-48">
                                            <input
                                                type="range"
                                                min="1.0"
                                                max="5.0"
                                                step="0.1"
                                                value={item.rating || 4.0}
                                                onChange={e => updateRating(item.id, parseFloat(e.target.value))}
                                                className="flex-1 accent-amber-400 h-2 cursor-pointer"
                                            />
                                            <span className="text-xs font-mono text-gray-400 w-8">{(item.rating || 4.0).toFixed(1)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="text-center text-xs text-gray-400 mt-4">Showing top 30 results • {menuWithRatings.length} total items</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon, bg, color, border }) => (
    <div className={`bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-5 hover:-translate-y-1 transition duration-300`}>
        <div className={`p-4 rounded-2xl ${bg} ${color} border ${border} shadow-sm`}>{icon}</div>
        <div>
            <div className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-1">{title}</div>
            <div className={`text-3xl font-black ${color.replace('text-', 'text-gray-900')}`}>{value}</div>
        </div>
    </div>
);

export default AdminDashboard;
