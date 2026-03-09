import React, { useState } from 'react';
import { ShieldCheck, MapPin, Heart } from 'lucide-react'; // Import Heart
import axios from 'axios';
import './Items.css';

const ItemCard = ({ item, onBuy, onView }) => {
  // Local state to handle the like button appearance
  const [isLiked, setIsLiked] = useState(false);

  const toggleWishlist = async (e) => {
    e.stopPropagation(); // Stop click from opening Detail View
    
    // Optimistic UI Update (Change color immediately)
    setIsLiked(!isLiked); 

    try {
      const token = localStorage.getItem('token');
      // Call backend to toggle
      await axios.post(`https://recampus-backend.onrender.com/api/items/wishlist/toggle/${item._id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error("Wishlist toggle failed", err);
      // Revert if API fails
      setIsLiked(!isLiked); 
    }
  };

  return (
    <div className="item-card" onClick={() => onView(item)}>
      
      {/* Image Section */}
      <div className="item-image-wrapper">
        <img 
          src={item.images[0] || 'https://via.placeholder.com/300'} 
          alt={item.title} 
        />
        
        <div className="item-category-badge">{item.category}</div>
        
        {/* --- WISHLIST BUTTON --- */}
        <button 
          className={`wishlist-btn ${isLiked ? 'liked' : ''}`} 
          onClick={toggleWishlist}
          title="Add to Wishlist"
        >
          <Heart size={18} fill={isLiked ? "#ef4444" : "none"} />
        </button>
        {/* ----------------------- */}

        {item.images.length > 1 && (
          <div className="gallery-badge">
            +{item.images.length - 1} more
          </div>
        )}
      </div>
      
      {/* Details Section */}
      <div className="item-details">
        <div className="item-header">
          <h3>{item.title}</h3>
          <div className="item-condition">{item.condition}</div>
        </div>

        <p className="item-desc">{item.description.substring(0, 50)}...</p>

        <div className="item-meta">
          <div className="item-price">₹{item.price}</div>
          <div className="item-location">
            <MapPin size={14} /> KLU
          </div>
        </div>

        <div className="item-footer">
          <div className="verified-status">
            <ShieldCheck size={16} color="#00A36C" /> Verified
          </div>
          
          <button 
            className="buy-btn" 
            onClick={(e) => { e.stopPropagation(); onBuy(item); }}
          >
            Buy
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItemCard;