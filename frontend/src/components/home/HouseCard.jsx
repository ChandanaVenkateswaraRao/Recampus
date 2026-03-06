import React from 'react';
import { MapPin, IndianRupee, Phone, Lock, Home, Heart } from 'lucide-react';
import './HomeModule.css';

const HouseCard = ({ house, onUnlock, onToggleLike, isBusy }) => {
  const unlockFee = Number(house?.unlockFee) > 0 ? Number(house.unlockFee) : 50;

  return (
    <div className="house-card">
      <div className="house-image">
        {house.images && house.images.length > 0 ? (
          <img src={house.images[0]} alt={house.title} />
        ) : (
          <div className="image-placeholder"><Home size={40} /></div>
        )}
        <button
          type="button"
          className={`house-like-btn ${house?.isLiked ? 'active' : ''}`}
          onClick={() => onToggleLike(house)}
          disabled={isBusy}
          title={house?.isLiked ? 'Unlike' : 'Like this house'}
        >
          <Heart size={16} fill={house?.isLiked ? 'currentColor' : 'none'} />
          <span>{house?.likesCount || 0}</span>
        </button>
        <div className="rent-tag">₹{house.rent} / month</div>
      </div>

      <div className="house-info">
        <h3>{house.title}</h3>
        <div className="house-loc">
          <MapPin size={14} />
          <span>{house.location}</span>
        </div>
        
        <p className="house-desc">{house.description.substring(0, 80)}...</p>

        <div className="contact-status-box">
          {house.isUnlocked ? (
            <div className="unlocked-contact">
              <div className="contact-row">
                <span className="label">Owner:</span>
                <span className="val">{house.ownerName}</span>
              </div>
              <div className="contact-row">
                <span className="label">Phone:</span>
                <span className="val phone-link">{house.ownerPhone}</span>
              </div>
            </div>
          ) : (
            <div className="locked-contact">
              <div className="masked-phone">
                <Phone size={14} />
                <span>+91 ••••• ••902</span>
              </div>
              <button className="unlock-btn" onClick={() => onUnlock(house)} disabled={isBusy}>
                <Lock size={14} /> {isBusy ? 'Processing...' : `Pay Rs.${unlockFee} to Unlock Contact`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HouseCard;