import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { ArrowRight, Navigation, Loader2 } from 'lucide-react';

const CaptainView = ({ user }) => {

  const [requests, setRequests] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [otp, setOtp] = useState('');
  const [routeCoords, setRouteCoords] = useState([]);

  /* ===========================
     RADAR POLLING
  =========================== */

  useEffect(() => {

    if (activeRide) return;

    const loadRadar = async () => {

      try {

        const token = localStorage.getItem('token');

        const res = await axios.get(
          'http://localhost:5000/api/rides/requests',
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setRequests(res.data);

      } catch (err) {}

    };

    loadRadar();

    const interval = setInterval(loadRadar, 3000);

    return () => clearInterval(interval);

  }, [activeRide]);


  /* ===========================
     FETCH ROAD ROUTE
  =========================== */

  const fetchRoute = async (pickup, drop) => {

    try {

      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${pickup.lng},${pickup.lat};${drop.lng},${drop.lat}` +
        `?overview=full&geometries=geojson`;

      const res = await axios.get(url);

      const coords = res.data.routes[0].geometry.coordinates;

      const roadRoute = coords.map(c => ({
        lat: c[1],
        lng: c[0]
      }));

      setRouteCoords(roadRoute);

    } catch (err) {

      console.error("Routing error:", err);

    }

  };


  /* ===========================
     SOCKET GPS BROADCAST
  =========================== */

  useEffect(() => {

    if (activeRide && (activeRide.status === 'accepted' || activeRide.status === 'paid')) {

      const socket = io('http://localhost:5000');

      const passengerId =
        activeRide.passenger._id || activeRide.passenger;

      const watchId = navigator.geolocation.watchPosition(

        (pos) => {

          socket.emit('update_location', {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            passengerId,
            rideId: activeRide._id
          });

        },

        (err) => console.log(err),

        { enableHighAccuracy: true }

      );

      return () => {

        navigator.geolocation.clearWatch(watchId);
        socket.disconnect();

      };

    }

  }, [activeRide]);


  /* ===========================
     ACCEPT RIDE
  =========================== */

  const handleAccept = async (rideId) => {

    try {

      const token = localStorage.getItem('token');

      const res = await axios.patch(
        `http://localhost:5000/api/rides/accept/${rideId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const ride = res.data;

      setActiveRide(ride);

      /* Fetch road route */

      if (ride.pickupLocation && ride.dropLocation) {

        fetchRoute(
          ride.pickupLocation,
          ride.dropLocation
        );

      }

    } catch (err) {

      alert("Ride already taken.");

    }

  };


  /* ===========================
     COMPLETE RIDE
  =========================== */

  const handleCompleteRide = async () => {

    try {

      const token = localStorage.getItem('token');

      await axios.post(
        'http://localhost:5000/api/rides/verify-completion',
        {
          rideId: activeRide._id,
          code: otp
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert("Ride completed successfully");

      setActiveRide(null);
      setOtp('');
      setRouteCoords([]);

    } catch (err) {

      alert("Invalid OTP");

    }

  };


  /* ===========================
     ACTIVE RIDE
  =========================== */

  if (activeRide) {

    return (

      <div className="captain-active-card fade-in">

        <div className="active-header">
          <Navigation size={20} color="#166534" />
          <span>Ongoing Trip</span>
        </div>

        <div className="trip-details">
          <h3>{activeRide.route}</h3>
        </div>

        {activeRide.status === 'accepted' && (

          <div className="waiting-payment-box">
            <Loader2 className="spin" size={20} />
            <p>Waiting for Passenger Payment ₹{activeRide.price}</p>
          </div>

        )}

        <div className="completion-form">

          <label>Enter Passenger OTP</label>

          <input
            type="text"
            value={otp}
            placeholder="4 Digit Code"
            onChange={(e) => setOtp(e.target.value)}
            maxLength={4}
          />

          <button
            className="complete-btn"
            onClick={handleCompleteRide}
          >
            Verify & Finish Ride
          </button>

        </div>

      </div>

    );

  }


  /* ===========================
     RADAR VIEW
  =========================== */

  return (

    <div className="captain-radar-view fade-in">

      <div className="radar-header">
        <div className="pulse-dot"></div>
        <h2>Ride Radar</h2>
        <p>Looking for passengers...</p>
      </div>

      <div className="requests-list">

        {requests.length === 0 ? (

          <div className="empty-radar">
            No ride requests
          </div>

        ) : (

          requests.map(req => (

            <div key={req._id} className="request-card-captain">

              <div className="req-main">
                <strong>{req.route}</strong>
                <span>₹{req.price}</span>
              </div>

              <button
                className="accept-btn-mini"
                onClick={() => handleAccept(req._id)}
              >
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