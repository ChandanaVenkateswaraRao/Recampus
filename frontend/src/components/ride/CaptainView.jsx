import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { MapPin, User, ArrowRight, Navigation, Loader2 } from 'lucide-react';

const CaptainView = ({ user }) => {
  const [requests, setRequests] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [otp, setOtp] = useState('');

  // 1. Radar Polling
  useEffect(() => {
    if (activeRide) return;
    const loadRadar = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('http://localhost:5000/api/rides/requests', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setRequests(res.data);
      } catch (err) {}
    };
    loadRadar();
    const interval = setInterval(loadRadar, 3000);
    return () => clearInterval(interval);
  }, [activeRide]);

  // 2. Live Location Broadcaster (Socket.io)
// Inside CaptainView.jsx
useEffect(() => {
  // Only broadcast if the ride is Accepted or Paid
  if (activeRide && (activeRide.status === 'accepted' || activeRide.status === 'paid')) {
    
    const socket = io('http://localhost:5000');
    
    // Get the Passenger ID from the ride object
    // Handle both cases: if passenger is an object or just an ID string
    const passengerId = activeRide.passenger._id || activeRide.passenger;

    console.log("📡 Starting GPS Broadcast for Passenger:", passengerId);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          passengerId: passengerId, // Who should receive this data?
          rideId: activeRide._id
        };
        
        // EMIT to server
        socket.emit('update_location', coords);
      },
      (err) => console.error("GPS Watch Error:", err),
      { enableHighAccuracy: true, maximumAge: 0 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      socket.disconnect();
    };
  }
}, [activeRide]);

  const handleAccept = async (rideId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.patch(`http://localhost:5000/api/rides/accept/${rideId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActiveRide(res.data);
    } catch (err) { alert("Ride taken by someone else."); }
  };

  const handleCompleteRide = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('http://localhost:5000/api/rides/verify-completion', {
        rideId: activeRide._id,
        code: otp
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      alert("Success! Payout added to your wallet.");
      setActiveRide(null);
      setOtp('');
    } catch (err) { alert("Invalid Code."); }
  };

  // --- RENDER ONGOING RIDE ---
  if (activeRide) {
    return (
      <div className="captain-active-card fade-in">
        <div className="active-header">
          <Navigation size={20} color="#166534" /> <span>Ongoing Trip</span>
        </div>
        
        <div className="trip-details">
          <h3>{activeRide.route}</h3>
        </div>

        {activeRide.status === 'accepted' && (
          <div className="waiting-payment-box">
            <Loader2 className="spin" size={20} />
            <p>Waiting for Passenger to Pay ₹{activeRide.price}</p>
          </div>
        )}

        {/* If passenger paid, we need to poll to know status changed to paid, or just let Captain type code anytime */}
        <div className="completion-form">
          <label>Enter Passenger's OTP to complete trip:</label>
          <input 
            type="text" placeholder="4-Digit Code" 
            value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={4}
          />
          <button className="complete-btn" onClick={handleCompleteRide}>Verify & Get Paid</button>
        </div>
      </div>
    );
  }

  // --- RENDER RADAR ---
  return (
    <div className="captain-radar-view fade-in">
      <div className="radar-header">
        <div className="pulse-dot"></div>
        <h2>Ride Radar</h2>
        <p>Looking for students...</p>
      </div>

      <div className="requests-list">
        {requests.length === 0 ? (
          <div className="empty-radar">No requests right now.</div>
        ) : (
          requests.map(req => (
            <div key={req._id} className="request-card-captain">
              <div className="req-main">
                <strong>{req.route}</strong>
                <span>₹{req.price}</span>
              </div>
              <button className="accept-btn-mini" onClick={() => handleAccept(req._id)}>
                Accept <ArrowRight size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CaptainView;