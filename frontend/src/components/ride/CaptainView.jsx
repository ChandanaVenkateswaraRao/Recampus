import React, { useState, useEffect } from "react";
import axios from "axios";
import { GoogleMap, MarkerF, PolylineF, useJsApiLoader } from "@react-google-maps/api";
import { ArrowRight, Loader2 } from "lucide-react";

const CaptainView = ({ user }) => {

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  });

  const [requests, setRequests] = useState([]);
  const [activeRide, setActiveRide] = useState(null);

  const [captainLocation, setCaptainLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);

  const [otp, setOtp] = useState("");

  /* ===========================
     POLYLINE DECODER
  =========================== */

  const decodePolyline = (encoded) => {

    let index = 0;
    let lat = 0;
    let lng = 0;
    const coordinates = [];

    while (index < encoded.length) {

      let result = 0;
      let shift = 0;
      let byte;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
      lat += deltaLat;

      result = 0;
      shift = 0;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
      lng += deltaLng;

      coordinates.push({
        lat: lat / 1e5,
        lng: lng / 1e5
      });

    }

    return coordinates;
  };

  /* ===========================
     CAPTAIN LOCATION
  =========================== */

  useEffect(() => {

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCaptainLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      () => {},
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);

  }, []);

  /* ===========================
     RADAR POLLING
  =========================== */

  useEffect(() => {

    if (activeRide) return;

    const loadRadar = async () => {

      try {

        const token = localStorage.getItem("token");

        const res = await axios.get(
          "https://recampus-backend.onrender.com/api/rides/requests",
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setRequests(res.data);

      } catch {}

    };

    loadRadar();

    const interval = setInterval(loadRadar, 3000);

    return () => clearInterval(interval);

  }, [activeRide]);

  /* ===========================
     ACCEPT RIDE
  =========================== */

  const handleAccept = async (rideId) => {

    try {

      const token = localStorage.getItem("token");

      const res = await axios.patch(
        `https://recampus-backend.onrender.com/api/rides/accept/${rideId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const ride = res.data;

      setActiveRide(ride);

      if (ride.polyline) {
        const decoded = decodePolyline(ride.polyline);
        setRouteCoords(decoded);
      }

    } catch {
      alert("Ride already taken.");
    }

  };

  /* ===========================
     ACTIVE RIDE VIEW
  =========================== */

  if (activeRide) {

    const pickup = activeRide.pickupLocation;
    const drop = activeRide.dropLocation;

    return (

      <div style={{ height: "100vh", width: "100%" }}>

        {isLoaded && (

          <GoogleMap
            center={pickup}
            zoom={14}
            mapContainerStyle={{ height: "70%", width: "100%" }}
          >

            <MarkerF position={pickup} label="P" />

            <MarkerF position={drop} label="D" />

            {captainLocation && (
              <MarkerF position={captainLocation} label="C" />
            )}

            {routeCoords.length > 0 && (

              <PolylineF
                path={routeCoords}
                options={{
                  strokeColor: "#2563eb",
                  strokeWeight: 5
                }}
              />

            )}

          </GoogleMap>

        )}

        <div className="captain-active-card">

          <h3>{activeRide.route}</h3>

          {activeRide.status === "accepted" && (
            <div>
              <Loader2 className="spin" size={20} />
              Waiting for Passenger Payment ₹{activeRide.price}
            </div>
          )}

          <div>

            <input
              type="text"
              value={otp}
              placeholder="Enter OTP"
              onChange={(e) => setOtp(e.target.value)}
            />

            <button>
              Verify & Finish Ride
            </button>

          </div>

        </div>

      </div>

    );

  }

  /* ===========================
     RADAR VIEW
  =========================== */

  return (

    <div>

      <h2>Ride Radar</h2>

      {requests.map(req => (

        <div key={req._id}>

          <strong>{req.route}</strong> ₹{req.price}

          <button onClick={() => handleAccept(req._id)}>
            Accept <ArrowRight size={14} />
          </button>

        </div>

      ))}

    </div>

  );

};

export default CaptainView;