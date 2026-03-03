import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { io } from 'socket.io-client';
import { 
  MapPin, Navigation, Clock, Zap, CheckCircle, 
  User, ShieldCheck, Loader2, Bike, ArrowRight, XCircle 
} from 'lucide-react';
import PaymentGateway from '../components/items/PaymentGateway'; 
import './Ride.css';

// Fix Leaflet Icons
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
L.Marker.prototype.options.icon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });

const KARE_CENTER = [9.5115, 77.6766];

const RideModule = ({ user }) => {
  const [role, setRole] = useState('passenger'); 
  const [socket, setSocket] = useState(null);
  
  // App State
  const [activeRide, setActiveRide] = useState(null);
  const [radarRequests, setRadarRequests] = useState([]);
  const [captainLocation, setCaptainLocation] = useState(null);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [showGateway, setShowGateway] = useState(false);
  const [customRoute, setCustomRoute] = useState({ start: '', end: '' });
  const [otpInput, setOtpInput] = useState('');

  // --- 1. SETUP SOCKET & INITIAL DATA ---
  useEffect(() => {
    if (!user?._id) return;

    // Fetch active ride on load
    axios.get('http://localhost:5000/api/rides/my-active', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).then(res => setActiveRide(res.data)).catch(() => {});

    // Connect Socket
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('register', user._id);
    });

    newSocket.on('ride_updated', (updatedRide) => {
      setActiveRide(updatedRide);
    });

    newSocket.on('captain_location_update', (coords) => {
      setCaptainLocation(coords);
    });

    return () => newSocket.disconnect();
  }, [user]);

  // --- 2. CAPTAIN RADAR & GPS BROADCAST ---
  useEffect(() => {
    if (role === 'captain' && !activeRide) {
      // Poll radar every 3 seconds if no active ride
      const interval = setInterval(() => {
        axios.get('http://localhost:5000/api/rides/requests', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }).then(res => setRadarRequests(res.data)).catch(() => {});
      }, 3000);
      return () => clearInterval(interval);
    }

    if (role === 'captain' && activeRide && (activeRide.status === 'accepted' || activeRide.status === 'paid')) {
      const passengerId = activeRide.passenger._id || activeRide.passenger;
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (socket) {
            socket.emit('update_location', {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              passengerId: passengerId,
              rideId: activeRide._id
            });
          }
        },
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [role, activeRide, socket]);

  // --- 3. ACTIONS ---
  const requestRide = async (routeData) => {
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/rides/request', routeData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setActiveRide(res.data);
    } catch (err) { alert(err.response?.data?.message || "Failed"); }
    finally { setLoading(false); }
  };

  const acceptRide = async (rideId) => {
    try {
      const res = await axios.patch(`http://localhost:5000/api/rides/accept/${rideId}`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setActiveRide(res.data);
      socket.emit('notify_ride_update', res.data); 
    } catch (err) { alert("Ride already taken."); }
  };

  const completePayment = async () => {
    setShowGateway(false);
    try {
      const res = await axios.post(`http://localhost:5000/api/rides/pay/${activeRide._id}`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setActiveRide(res.data.ride);
      socket.emit('notify_ride_update', res.data.ride); 
    } catch (err) { alert("Payment failed"); }
  };

  const completeRide = async () => {
    try {
      const res = await axios.post('http://localhost:5000/api/rides/verify-completion', {
        rideId: activeRide._id, code: otpInput
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      alert(res.data.message);
      setActiveRide(null);
      setOtpInput('');
    } catch (err) { alert("Invalid OTP."); }
  };

  const cancelRide = async () => {
    if(!window.confirm("Cancel request?")) return;
    try {
      await axios.patch(`http://localhost:5000/api/rides/cancel/${activeRide._id}`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setActiveRide(null);
    } catch (err) { alert("Error cancelling."); }
  };

  const becomeRider = async () => {
    try {
      await axios.post('http://localhost:5000/api/auth/become-rider', {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      window.location.reload();
    } catch (err) { alert("Failed to register."); }
  };

  // --- 4. RENDERERS ---
  const renderPassengerUI = () => {
    if (!activeRide) {
      return (
        <div className="panel-content fade-in">
          <h2>Where to, {user?.email.split('@')[0]}?</h2>
          <div className="route-grid">
            <div className="route-card" onClick={() => requestRide({ type: 'on-spot', route: `KARE ➔ Krishnankovil`, price: 30 })}>
              <Zap size={20} color="#3b82f6" /><strong>Krishnankovil</strong><span>₹30</span>
            </div>
            <div className="route-card" onClick={() => requestRide({ type: 'on-spot', route: `KARE ➔ Srivilliputhur`, price: 60 })}>
              <Zap size={20} color="#3b82f6" /><strong>Srivilliputhur</strong><span>₹60</span>
            </div>
          </div>
          <div className="divider"><span>OR CUSTOM ROUTE</span></div>
          <div className="custom-route-box">
             <input placeholder="Pickup..." onChange={e => setCustomRoute({...customRoute, start: e.target.value})} />
             <input placeholder="Drop..." onChange={e => setCustomRoute({...customRoute, end: e.target.value})} />
             <button disabled={loading} onClick={() => requestRide({ type: 'pre-booking', route: `${customRoute.start} ➔ ${customRoute.end}`, price: 40 })}>
               {loading ? <Loader2 className="spin"/> : "Book Custom Ride"}
             </button>
          </div>
        </div>
      );
    }

    if (activeRide.status === 'searching') {
      return (
        <div className="panel-content center-align fade-in">
          <div className="radar-animation"></div>
          <h3>Finding your Captain...</h3>
          <p>{activeRide.route}</p>
          <button className="danger-btn" onClick={cancelRide}><XCircle size={16}/> Cancel</button>
        </div>
      );
    }

    if (activeRide.status === 'accepted') {
      return (
        <div className="panel-content center-align fade-in">
          <CheckCircle size={50} color="#166534" style={{marginBottom: '10px'}}/>
          <h3>Captain Found!</h3>
          <div className="profile-badge">
             <div className="avatar"><User size={20}/></div>
             <div><strong>{activeRide.captain?.email.split('@')[0]}</strong><span>Is arriving soon</span></div>
          </div>
          <button className="primary-btn" onClick={() => setShowGateway(true)}>Pay ₹{activeRide.price} to Start</button>
        </div>
      );
    }

    if (activeRide.status === 'paid') {
      return (
        <div className="panel-content center-align fade-in">
          <ShieldCheck size={40} color="#003366" style={{marginBottom: '10px'}}/>
          <h3>Ride in Progress</h3>
          <div className="otp-box">
            <span>YOUR START CODE</span>
            <h1>{activeRide.completionCode}</h1>
          </div>
          <p>Share this code with your captain.</p>
        </div>
      );
    }
  };

  const renderCaptainUI = () => {
    if (!user?.roles?.includes('rider')) {
      return (
        <div className="panel-content center-align fade-in">
          <Bike size={50} color="#003366" style={{marginBottom: '10px'}}/>
          <h3>Become a Captain</h3>
          <p>Earn money providing rides across campus.</p>
          <button className="primary-btn" onClick={becomeRider}>Register Now</button>
        </div>
      );
    }

    if (!activeRide) {
      return (
        <div className="panel-content fade-in">
          <h2><Navigation size={20}/> Ride Radar</h2>
          <div className="radar-list">
            {radarRequests.length === 0 ? <p className="empty">No requests nearby.</p> : radarRequests.map(req => (
              <div key={req._id} className="radar-card">
                <div><strong>{req.route}</strong><span>₹{req.price}</span></div>
                <button onClick={() => acceptRide(req._id)}>Accept</button>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="panel-content fade-in">
        <h2>Active Trip</h2>
        <div className="trip-summary"><strong>Route:</strong> {activeRide.route}</div>
        
        {activeRide.status === 'accepted' ? (
          <div className="waiting-box">
             <Loader2 className="spin" size={20}/> Waiting for passenger to pay...
          </div>
        ) : (
          <div className="finish-box">
            <p>Payment Secured! Enter OTP to complete trip:</p>
            <input type="text" placeholder="0000" maxLength={4} value={otpInput} onChange={e => setOtpInput(e.target.value)} />
            <button className="primary-btn" onClick={completeRide}>Complete Trip</button>
          </div>
        )}
      </div>
    );
  };

  if (!user) return <div className="loader">Loading...</div>;

  return (
    <div className="modern-ride-module">
      {/* BACKGROUND MAP */}
      <div className="map-background">
        <MapContainer center={KARE_CENTER} zoom={15} zoomControl={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          {captainLocation && role === 'passenger' && (
            <Marker position={[captainLocation.lat, captainLocation.lng]}>
              <Popup>Captain Location</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* FLOATING UI */}
      <div className="floating-panel">
        {!activeRide && (
          <div className="role-toggle-header">
            <button className={role === 'passenger' ? 'active' : ''} onClick={() => setRole('passenger')}>Rider</button>
            <button className={role === 'captain' ? 'active' : ''} onClick={() => setRole('captain')}>Captain</button>
          </div>
        )}
        {role === 'passenger' ? renderPassengerUI() : renderCaptainUI()}
      </div>

      {showGateway && activeRide && (
        <PaymentGateway item={{ price: activeRide.price }} onClose={() => setShowGateway(false)} onSuccess={completePayment} />
      )}
    </div>
  );
};

export default RideModule;