import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { ChefHat, CheckCircle2, Bike, Package, MapPin, Phone, MessageSquare } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const restaurantIcon = new L.divIcon({
    className: 'custom-icon',
    html: `<div class="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-orange-100"><span style="color: #f97316; font-size: 20px;">🍽️</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
});
const homeIcon = new L.divIcon({
    className: 'custom-icon',
    html: `<div class="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center shadow-lg border-2 border-gray-700"><span style="color: white; font-size: 20px;">📍</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
});
const driverIcon = new L.divIcon({
    className: 'custom-icon',
    html: `<div class="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg border-4 border-white"><span style="font-size: 24px;">🏍️</span></div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24]
});

const mockStores = [
    { id: 'S1', name: 'Cyber Hub Kitchen', lat: 28.4950, lng: 77.0890 },
    { id: 'S2', name: 'MG Road Outlet', lat: 28.4800, lng: 77.0800 },
    { id: 'S3', name: 'Sector 29 Hub', lat: 28.4680, lng: 77.0630 },
];

const OrderTracking = () => {
    const { currentOrder, deliveryAddress } = useStore();
    const navigate = useNavigate();
    const [stage, setStage] = useState(1); // 1: Received, 2: Preparing, 3: Out for Delivery, 4: Delivered
    const [driverFactor, setDriverFactor] = useState(0);

    const homeLocation = deliveryAddress && deliveryAddress.lat ? [deliveryAddress.lat, deliveryAddress.lng] : [28.4700, 77.0700];
    const storeObj = mockStores.find(s => s.id === (deliveryAddress?.storeId)) || mockStores[0];
    const restaurantLocation = [storeObj.lat, storeObj.lng];

    useEffect(() => {
        if (!currentOrder) {
            navigate('/');
            return;
        }

        const timers = [
            setTimeout(() => setStage(2), 3000), 
            setTimeout(() => { setStage(3); animateDriver(); }, 8000), 
            setTimeout(() => setStage(4), 14000) 
        ];

        return () => timers.forEach(clearTimeout);
    }, [currentOrder, navigate]);

    const animateDriver = () => {
        let factor = 0;
        const interval = setInterval(() => {
            factor += 0.05;
            if (factor >= 1) {
                factor = 1;
                clearInterval(interval);
            }
            setDriverFactor(factor);
        }, 300); // 6 seconds (20 steps)
    };

    const driverLocation = [
        restaurantLocation[0] + (homeLocation[0] - restaurantLocation[0]) * driverFactor,
        restaurantLocation[1] + (homeLocation[1] - restaurantLocation[1]) * driverFactor
    ];
// Timers moved up

    if (!currentOrder) return null;

    const stages = [
        { id: 1, label: 'Order Received', desc: 'We have received your order', icon: <Package size={24} /> },
        { id: 2, label: 'Preparing Food', desc: 'Chef is preparing your meal', icon: <ChefHat size={24} /> },
        { id: 3, label: 'Out for Delivery', desc: 'Agent is on the way', icon: <Bike size={24} /> },
        { id: 4, label: 'Delivered', desc: 'Enjoy your meal!', icon: <CheckCircle2 size={24} /> },
    ];

    return (
        <div className="min-h-screen bg-gray-50 pb-10 flex flex-col items-center">
            <div className="w-full bg-white px-6 py-6 shadow-sm border-b sticky top-0 z-20 text-center">
                <h1 className="text-2xl font-black text-gray-900">Order #{currentOrder.orderId.split('-')[1].substring(6)}</h1>
                <p className="text-gray-500 font-medium">Estimated Arrival: 15-20 Mins</p>
            </div>

            <div className="w-full max-w-lg mx-auto p-6 space-y-8 animate-in slide-in-from-bottom-8 duration-500">

                {/* Live Leaflet Map Header */}
                <div className="bg-gray-100 w-full h-64 rounded-[2rem] overflow-hidden relative shadow-inner border border-gray-200 z-10">
                    <MapContainer 
                        center={driverLocation} 
                        zoom={13} 
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={false}
                        attributionControl={false}
                    >
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                        
                        <Marker position={restaurantLocation} icon={restaurantIcon}>
                            <Popup>Restaurant</Popup>
                        </Marker>

                        <Marker position={homeLocation} icon={homeIcon}>
                            <Popup>Delivery Address</Popup>
                        </Marker>

                        {stage >= 2 && (
                            <Marker position={driverLocation} icon={driverIcon} zIndexOffset={1000}>
                                <Popup>Driver</Popup>
                            </Marker>
                        )}
                        
                        <Polyline 
                            positions={[restaurantLocation, homeLocation]} 
                            color="#f97316" 
                            dashArray="5, 10" 
                            weight={3} 
                        />
                    </MapContainer>
                </div>

                {/* Tracking Stages */}
                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100 rounded-full blur-3xl -mr-10 -mt-10"></div>

                    <div className="relative z-10 space-y-8">
                        {stages.map((s, idx) => {
                            const isActive = stage >= s.id;
                            const isCurrent = stage === s.id;
                            return (
                                <div key={s.id} className="flex gap-4 relative">
                                    {/* Connecting Line */}
                                    {idx !== stages.length - 1 && (
                                        <div className={`absolute top-10 left-[1.125rem] bottom-[-2rem] w-1 rounded-full ${isActive ? 'bg-orange-500' : 'bg-gray-100'}`}></div>
                                    )}

                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors duration-500 ${isCurrent ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : isActive ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                        {s.icon}
                                    </div>

                                    <div className={`flex-1 ${!isActive && 'opacity-50'}`}>
                                        <h3 className={`font-extrabold text-lg ${isCurrent ? 'text-orange-600' : 'text-gray-900'}`}>{s.label}</h3>
                                        <p className="text-sm text-gray-500">{s.desc}</p>
                                        {isCurrent && s.id === 2 && (
                                            <div className="mt-3 bg-orange-50 p-3 rounded-xl border border-orange-100 text-sm font-medium text-orange-800 flex items-center gap-2">
                                                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                                                Kitchen accepted your order!
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Delivery Agent Card (Shows on Stage 3+) */}
                <div className={`transition-all duration-700 transform ${stage >= 3 ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                    <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100">
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Delivery Partner</h2>
                        <div className="flex items-center gap-4">
                            <img src="https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=100&q=80" alt="Agent" className="w-16 h-16 rounded-2xl object-cover shadow-sm bg-gray-100" />
                            <div className="flex-1">
                                <h3 className="font-extrabold text-gray-900 text-lg">Rahul Kumar</h3>
                                <div className="flex items-center gap-1 text-sm text-yellow-600 font-bold">
                                    ★ 4.8 <span className="text-gray-400 font-medium">(2.4k deliveries)</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition-colors">
                                    <Phone size={18} />
                                </button>
                                <button className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors">
                                    <MessageSquare size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t flex items-center gap-3">
                            <div className="bg-gray-100 p-2 rounded-xl text-gray-600"><MapPin size={18} /></div>
                            <div>
                                <p className="text-xs text-gray-500 font-bold uppercase">Delivering to</p>
                                <p className="font-bold text-gray-900 line-clamp-1">Floor 4, Tech Park Block C, Cyber Hub</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                {stage === 4 && (
                    <button
                        onClick={() => navigate('/')}
                        className="w-full bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-2xl font-bold shadow-xl transition-all"
                    >
                        Back to Home
                    </button>
                )}
            </div>
        </div>
    );
};

export default OrderTracking;
