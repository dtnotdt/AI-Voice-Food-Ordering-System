import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { ArrowLeft, MapPin, Navigation, Home, Building, CheckCircle2 } from 'lucide-react';

const mockStores = [
    { id: 'S1', name: 'Cyber Hub Kitchen', lat: 28.4950, lng: 77.0890 },
    { id: 'S2', name: 'MG Road Outlet', lat: 28.4800, lng: 77.0800 },
    { id: 'S3', name: 'Sector 29 Hub', lat: 28.4680, lng: 77.0630 },
];

const Address = () => {
    const navigate = useNavigate();
    const { deliveryAddress, setDeliveryAddress, getCartTotals } = useStore();
    const { total } = getCartTotals();

    const [formData, setFormData] = useState(deliveryAddress || {
        fullName: '',
        phone: '',
        flat: '',
        street: '',
        area: '',
        city: 'Gurgaon', // Default
        state: 'Haryana',
        pincode: '',
        lat: null,
        lng: null,
        storeId: null
    });

    const [isDetecting, setIsDetecting] = useState(false);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [phoneError, setPhoneError] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        setIsConfirmed(false);
        
        // Live phone validation
        if (name === 'phone') {
            const cleaned = value.replace(/[\s\-\+]/g, '');
            // Remove +91 prefix if present
            const digits = cleaned.startsWith('91') && cleaned.length > 10 ? cleaned.slice(2) : cleaned;
            if (digits.length === 0) {
                setPhoneError('');
            } else if (digits.length !== 10 || !/^\d{10}$/.test(digits)) {
                setPhoneError('Please provide a valid 10-digit phone number.');
            } else {
                setPhoneError('');
            }
        }
    };

    // Haversine formula to calculate distance
    const getDistanceFromLatLngInKm = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Radius of the earth in km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const findNearestStore = (lat, lng) => {
        let nearest = null;
        let minDistance = Infinity;

        mockStores.forEach(store => {
            const distance = getDistanceFromLatLngInKm(lat, lng, store.lat, store.lng);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = store;
            }
        });

        return nearest;
    };

    const handleAutoDetect = () => {
        setIsDetecting(true);
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    
                    const nearestStore = findNearestStore(lat, lng);

                    setFormData(prev => ({
                        ...prev,
                        flat: 'Auto-detected Location',
                        street: 'Current GPS Coordinates',
                        area: `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`,
                        lat,
                        lng,
                        storeId: nearestStore.id
                    }));
                    setIsDetecting(false);
                },
                (error) => {
                    alert('Could not get your location. Please enter manually.');
                    setIsDetecting(false);
                }
            );
        } else {
            alert('Geolocation is not supported by your browser.');
            setIsDetecting(false);
        }
    };

    const handleConfirm = (e) => {
        e.preventDefault();
        
        // If no auto-detect was used, arbitrarily use a mock store and coordinates for demo
        let finalData = { ...formData };
        if (!finalData.lat || !finalData.storeId) {
            finalData.lat = 28.4700;
            finalData.lng = 77.0700;
            const nearestStore = findNearestStore(finalData.lat, finalData.lng);
            finalData.storeId = nearestStore.id;
        }

        setDeliveryAddress(finalData);
        setIsConfirmed(true);
    };

    // Phone validation helper
    const isPhoneValid = () => {
        const cleaned = (formData.phone || '').replace(/[\s\-\+]/g, '');
        const digits = cleaned.startsWith('91') && cleaned.length > 10 ? cleaned.slice(2) : cleaned;
        return /^\d{10}$/.test(digits);
    };

    const isFormValid = formData.fullName && formData.phone && formData.flat && formData.street && formData.area && isPhoneValid();

    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            <div className="bg-white sticky top-0 z-20 shadow-sm border-b px-6 py-4 flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft size={24} className="text-gray-700" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Delivery Address</h1>
            </div>

            <div className="max-w-2xl mx-auto px-6 py-8">
                
                {/* Location Auto-Detect */}
                <button 
                    onClick={handleAutoDetect} 
                    disabled={isDetecting}
                    className="w-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-2xl p-4 flex items-center justify-center gap-3 font-bold transition-all mb-8 shadow-sm"
                >
                    <Navigation size={20} className={isDetecting ? "animate-spin" : ""} />
                    {isDetecting ? 'Detecting Location...' : 'Use Current Location'}
                </button>

                <form onSubmit={handleConfirm} className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-900">
                        <MapPin size={24} className="text-orange-500" /> Provide Address Details
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">Full Name</label>
                            <input required type="text" name="fullName" value={formData.fullName} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all" placeholder="John Doe" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">Phone Number</label>
                            <input required type="tel" name="phone" value={formData.phone} onChange={handleChange} className={`w-full bg-gray-50 border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 transition-all ${phoneError ? 'border-red-300 focus:ring-red-500/50 focus:border-red-500' : 'border-gray-200 focus:ring-orange-500/50 focus:border-orange-500'}`} placeholder="98765 43210" />
                            {phoneError && (
                                <p className="text-red-500 text-xs font-bold mt-1.5">{phoneError}</p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">House / Flat / Block No.</label>
                            <input required type="text" name="flat" value={formData.flat} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all" placeholder="e.g. Flat 402, B Wing" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-1">Street / Landmark</label>
                            <input required type="text" name="street" value={formData.street} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all" placeholder="e.g. Near Metro Station" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-1">Area / Locality</label>
                                <input required type="text" name="area" value={formData.area} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all" placeholder="e.g. DLF Phase 3" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-1">Pincode</label>
                                <input required type="text" name="pincode" value={formData.pincode} onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all" placeholder="e.g. 122002" />
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between">
                        {isConfirmed ? (
                            <div className="flex items-center gap-2 text-green-600 font-bold bg-green-50 px-4 py-2 rounded-xl">
                                <CheckCircle2 size={20} /> Address Confirmed
                            </div>
                        ) : (
                            <span className="text-gray-400 text-sm">Please confirm to proceed</span>
                        )}
                        <button 
                            type="submit" 
                            disabled={!isFormValid || isConfirmed}
                            className={`px-8 py-3 rounded-xl font-bold transition-all shadow-md ${!isFormValid || isConfirmed ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                        >
                            Confirm Address
                        </button>
                    </div>
                </form>

            </div>

            {/* Bottom Proceed Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-30">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-gray-500">Amount to pay</p>
                        <p className="text-2xl font-black text-gray-900">₹{total.toFixed(2)}</p>
                    </div>
                    <button
                        disabled={!isConfirmed}
                        onClick={() => navigate('/payment')}
                        className={`px-8 py-4 rounded-2xl font-bold shadow-xl transition-all flex items-center gap-2 ${isConfirmed ? 'bg-orange-500 hover:bg-orange-600 text-white hover:scale-105 active:scale-95 shadow-orange-500/20' : 'bg-gray-100 text-gray-400 shadow-none cursor-not-allowed'}`}
                    >
                        Proceed to Payment <ArrowLeft className="rotate-180" size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Address;
