import React, { useState, useEffect } from 'react';
import HouseCard from '../components/home/HouseCard';
import axios from 'axios';

const HomeModule = () => {
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHouses();
  }, []);

  const fetchHouses = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/houses/browse', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHouses(res.data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching houses", err);
    }
  };

  const handleUnlock = async (house) => {
    if (window.confirm(`Pay simulated viewing fee (₹50) to see ${house.ownerName}'s contact details?`)) {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.post(`http://localhost:5000/api/houses/book/${house._id}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Update local state to show the phone number
        setHouses(prev => prev.map(h => 
          h._id === house._id ? { ...h, isUnlocked: true, ownerPhone: res.data.ownerPhone } : h
        ));
      } catch (err) {
        alert("Payment failed. Please try again.");
      }
    }
  };

  if (loading) return <div className="loader">Searching for rooms...</div>;

  return (
    <div className="home-module">
      <div className="module-header">
        <h2>Nearby Student Housing</h2>
        <p>Verified rooms and apartments near KLU campus.</p>
      </div>

      <div className="house-grid">
        {houses.length > 0 ? (
          houses.map(house => (
            <HouseCard key={house._id} house={house} onUnlock={handleUnlock} />
          ))
        ) : (
          <div className="no-results">No houses listed by admin currently.</div>
        )}
      </div>
    </div>
  );
};

export default HomeModule;