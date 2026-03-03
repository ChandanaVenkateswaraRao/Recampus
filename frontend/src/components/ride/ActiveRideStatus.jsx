import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, CheckCircle, User, ShieldCheck, Phone, XCircle, Navigation } from 'lucide-react';
import PaymentGateway from '../items/PaymentGateway'; // Reusing your fake payment gateway!

const ActiveRideStatus = ({ ride, setRide }) => {
  const [showGateway, setShowGateway] = useState(false);

  // Poll backend every 3 seconds to see if Captain accepted
  useEffect(() => {
    if (ride.status === 'completed' || ride.status === 'cancelled') return;

    const pollInterval = setInterval(async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:5000/api/rides/my-active`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data) setRide(res.data);
        else setRide(null); 
      } catch (err) {}
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [ride.status, setRide]);

  const handlePaymentSuccess = async () => {
    setShowGateway(false);
    try {
      const token = localStorage.getItem('token');
      // Call backend to mark ride as paid and generate OTP
      const res = await axios.post(`http://localhost:5000/api/rides/pay/${ride._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRide(prev => ({ ...prev, status: 'paid', completionCode: res.data.code }));
    } catch (err) { alert("Payment sync failed"); }
  };

  const handleCancel = async () => {
    // Basic cancel logic
    setRide(null);
  };

  if (ride.status === 'searching') {
    return (
      <div className="status-card-inner searching fade-in">
        <div className="radar-container">
          <div className="radar-circle"></div>
          <Navigation size={32} className="radar-icon" />
        </div>
        <h3>Broadcasting...</h3>
        <p>Finding a Captain for:<br/><b>{ride.route}</b></p>
        <button className="cancel-ride-btn" onClick={handleCancel}><XCircle size={16}/> Cancel</button>
      </div>
    );
  }

  if (ride.status === 'accepted') {
    return (
      <div className="status-card-inner accepted fade-in">
        <CheckCircle size={50} color="#166534" style={{marginBottom: '10px'}} />
        <h3>Captain Found!</h3>
        <div className="captain-match-card">
           <div className="cap-avatar"><User size={20}/></div>
           <div className="cap-info">
             <strong>{ride.captain?.email?.split('@')[0] || "KARE Rider"}</strong>
             <span>Distance: 2 mins away</span>
           </div>
        </div>
        <button className="pay-now-btn" onClick={() => setShowGateway(true)}>
          Pay ₹{ride.price} to Start Ride
        </button>

        {showGateway && (
          <PaymentGateway 
            item={{ price: ride.price }} 
            onClose={() => setShowGateway(false)}
            onSuccess={handlePaymentSuccess} 
          />
        )}
      </div>
    );
  }

  if (ride.status === 'paid') {
    return (
      <div className="status-card-inner paid fade-in">
        <ShieldCheck size={40} color="#003366" style={{marginBottom: '10px'}} />
        <h3>Ride Confirmed</h3>
        <div className="otp-display">
          <label>START CODE</label>
          <h1>{ride.completionCode}</h1>
          <p>Tell this to your Captain when they arrive.</p>
        </div>
      </div>
    );
  }

  return null;
};

export default ActiveRideStatus;