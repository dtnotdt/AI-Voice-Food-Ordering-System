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
import AuthGate from './components/AuthGate';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans relative">
        <GlobalVoiceBot />
        <Routes>
          <Route path="/" element={<AuthGate><Landing /></AuthGate>} />
          <Route path="/voice" element={<AuthGate><VoiceOrdering /></AuthGate>} />
          <Route path="/menu" element={<AuthGate><SmartMenu /></AuthGate>} />
          <Route path="/cart" element={<AuthGate><Cart /></AuthGate>} />
          <Route path="/address" element={<AuthGate><Address /></AuthGate>} />
          <Route path="/payment" element={<AuthGate><Payment /></AuthGate>} />
          <Route path="/tracking" element={<AuthGate><OrderTracking /></AuthGate>} />
          <Route path="/admin" element={<AdminAuth />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
