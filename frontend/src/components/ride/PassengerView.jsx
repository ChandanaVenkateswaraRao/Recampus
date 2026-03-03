import React, { useState } from 'react';
import axios from 'axios';
import { Zap, Clock, MapPin, Navigation, ArrowRight, Loader2 } from 'lucide-react';

const PassengerView = ({ setActiveRide }) => {
  const [tab, setTab] = useState('quick'); 
  const [loading, setLoading] = useState(false);
  const [customData, setCustomData] = useState({ start: '', end: '' });

  // The 4 Fixed KARE Routes
  const fixedRoutes = [
    { id: 1, from: "KARE Campus", to: "Krishnankovil", price: 30 },
    { id: 2, from: "Krishnankovil", to: "KARE Campus", price: 30 },
    { id: 3, from: "KARE Campus", to: "Srivilliputhur", price: 60 },
    { id: 4, from: "Srivilliputhur", to: "KARE Campus", price: 60 },
  ];

  const handleRequest = async (routeData) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('http://localhost:5000/api/rides/request', routeData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActiveRide(res.data); // Triggers the ActiveRideStatus UI
    } catch (err) {
      alert(err.response?.data?.message || "Failed to request ride");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="passenger-container fade-in">
      <div className="passenger-header">
        <h2>Where to?</h2>
        <p>Book a fast bike ride across KARE</p>
      </div>

      <div className="ride-tabs">
        <button className={tab === 'quick' ? 'active' : ''} onClick={() => setTab('quick')}>
          <Zap size={16} /> Quick Routes
        </button>
        <button className={tab === 'custom' ? 'active' : ''} onClick={() => setTab('custom')}>
          <Clock size={16} /> Custom
        </button>
      </div>

      <div className="ride-selection-area">
        {tab === 'quick' ? (
          <div className="quick-routes-list">
            {fixedRoutes.map(route => (
              <div key={route.id} className="quick-route-card">
                <div className="route-main">
                  <div className="route-dots">
                    <div className="dot blue"></div><div className="line"></div><div className="dot red"></div>
                  </div>
                  <div className="route-names">
                    <span>{route.from}</span>
                    <span>{route.to}</span>
                  </div>
                </div>
                <div className="route-action">
                  <div className="route-price">₹{route.price}</div>
                  <button 
                    disabled={loading}
                    onClick={() => handleRequest({ type: 'on-spot', route: `${route.from} ➔ ${route.to}`, price: route.price })}
                  >
                    {loading ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="custom-booking-form">
            <div className="input-group-ride">
              <MapPin size={18} color="#3b82f6" />
              <input type="text" placeholder="Pickup location..." onChange={(e) => setCustomData({...customData, start: e.target.value})} />
            </div>
            <div className="input-group-ride">
              <Navigation size={18} color="#ef4444" />
              <input type="text" placeholder="Destination..." onChange={(e) => setCustomData({...customData, end: e.target.value})} />
            </div>
            <button 
              className="confirm-request-btn"
              disabled={loading || !customData.start || !customData.end}
              onClick={() => handleRequest({ type: 'pre-booking', route: `${customData.start} ➔ ${customData.end}`, price: 40 })}
            >
              {loading ? "Searching..." : "Confirm Request"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PassengerView;