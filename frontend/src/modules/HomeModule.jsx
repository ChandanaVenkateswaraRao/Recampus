import React, { useState, useEffect } from 'react';
import HouseCard from '../components/home/HouseCard';
import PaymentGateway from '../components/items/PaymentGateway';
import {
  fetchHouses as fetchHouseListings,
  toggleHouseLike,
  payForHouseUnlock
} from '../api/houseApi';

const HomeModule = () => {
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyHouseId, setBusyHouseId] = useState('');
  const [selectedHouse, setSelectedHouse] = useState(null);
  const [showGateway, setShowGateway] = useState(false);

  useEffect(() => {
    loadHouses();
  }, []);

  const loadHouses = async () => {
    try {
      const res = await fetchHouseListings();
      setHouses(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching houses", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async (house) => {
    setSelectedHouse(house);
    setShowGateway(true);
  };

  const handleGatewaySuccess = async () => {
    if (!selectedHouse?._id) {
      setShowGateway(false);
      return;
    }

    try {
      setBusyHouseId(selectedHouse._id);
      setShowGateway(false);
      const res = await payForHouseUnlock(selectedHouse._id, { method: 'simulated' });

      setHouses((prev) =>
        prev.map((h) =>
          h._id === selectedHouse._id
            ? { ...h, isUnlocked: true, ownerPhone: res?.data?.ownerPhone || h.ownerPhone }
            : h
        )
      );

      const charged = Number(res?.data?.chargedAmount || 0);
      const balance = Number(res?.data?.remainingBalance || 0).toFixed(2);
      alert(`Contact unlocked. Charged Rs.${charged}. Wallet balance: Rs.${balance}.`);
    } catch (err) {
      alert(err?.response?.data?.message || 'Unable to unlock contact right now.');
    } finally {
      setBusyHouseId('');
      setSelectedHouse(null);
    }
  };

  const handleToggleLike = async (house) => {
    try {
      setBusyHouseId(house._id);
      const res = await toggleHouseLike(house._id);
      const isLiked = Boolean(res?.data?.isLiked);
      const likesCount = Number(res?.data?.likesCount || 0);

      setHouses((prev) =>
        prev.map((h) =>
          h._id === house._id
            ? { ...h, isLiked, likesCount }
            : h
        )
      );
    } catch (err) {
      alert(err?.response?.data?.message || 'Unable to update like right now.');
    } finally {
      setBusyHouseId('');
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
            <HouseCard
              key={house._id}
              house={house}
              onUnlock={handleUnlock}
              onToggleLike={handleToggleLike}
              isBusy={busyHouseId === house._id}
            />
          ))
        ) : (
          <div className="no-results">No houses listed by admin currently.</div>
        )}
      </div>

      {showGateway && selectedHouse && (
        <PaymentGateway
          item={{ price: Number(selectedHouse?.unlockFee) > 0 ? Number(selectedHouse.unlockFee) : 50 }}
          onClose={() => {
            setShowGateway(false);
            setSelectedHouse(null);
          }}
          onSuccess={handleGatewaySuccess}
        />
      )}
    </div>
  );
};

export default HomeModule;