import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import VoiceOrdering from './pages/VoiceOrdering';
import SmartMenu from './pages/SmartMenu';
import AdminDashboard from './pages/AdminDashboard';
import Cart from './pages/Cart';
import Payment from './pages/Payment';
import OrderTracking from './pages/OrderTracking';
import GlobalVoiceBot from './components/GlobalVoiceBot';
import Address from './pages/Address';
import AdminAuth from './pages/AdminAuth';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans relative">
        <GlobalVoiceBot />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/voice" element={<VoiceOrdering />} />
          <Route path="/menu" element={<SmartMenu />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/address" element={<Address />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/tracking" element={<OrderTracking />} />
          <Route path="/admin" element={<AdminAuth />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
