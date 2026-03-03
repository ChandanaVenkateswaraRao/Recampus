import React, { useState, useEffect } from 'react';
import { X, MapPin, ShieldCheck, Tag, User, Clock, Eye, Share2 } from 'lucide-react';
import axios from 'axios';
import QuestionSection from './QuestionSection';
import './ItemDetail.css';

const ItemDetailModal = ({ item, onClose, onBuy, onSwitchItem }) => {
  const [activeImage, setActiveImage] = useState(item.images[0] || 'https://via.placeholder.com/300');
  const [viewCount, setViewCount] = useState(item.views || 0);
  const [copied, setCopied] = useState(false);
  
  // --- NEW: SIMILAR ITEMS STATE ---
  const [similarItems, setSimilarItems] = useState([]);

  useEffect(() => {
    // 1. Increment View Count
    const incrementView = async () => {
      try {
        const res = await axios.patch(`http://localhost:5000/api/items/view/${item._id}`);
        if (res.data.views) setViewCount(res.data.views);
      } catch (err) {}
    };
    incrementView();

    // 2. Fetch Similar Items (Same category, approved, not this specific item)
    const fetchSimilar = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('http://localhost:5000/api/items/browse', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Filter logic: Same category, approved, and NOT the current item
        const filtered = res.data.filter(i => 
          i.category === item.category && 
          i._id !== item._id &&
          i.status === 'approved'
        );
        
        // Take only the first 4 for the UI
        setSimilarItems(filtered.slice(0, 4));
      } catch(err) {
        console.error("Failed to load similar items");
      }
    };
    fetchSimilar();

    // Reset active image when item changes
    setActiveImage(item.images[0] || 'https://via.placeholder.com/300');

  }, [item._id, item.category]); // Re-run if the item ID changes

  const handleShare = async () => {
    const baseUrl = window.location.origin; 
    const itemUrl = `${baseUrl}/?item=${item._id}`; 
    const shareData = {
      title: `Recampus KARE: ${item.title}`,
      text: `Hey! I found this "${item.title}" selling for just ₹${item.price} on Recampus.\n\nCheck it out here: `,
      url: itemUrl 
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text}${shareData.url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {}
  };

  if (!item) return null;

  return (
    <div className="detail-modal-overlay" onClick={onClose}>
      <div className="detail-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="detail-close-btn" onClick={onClose}><X size={24} /></button>

        <div className="detail-scroll-area">
          <div className="detail-grid">
            {/* Gallery */}
            <div className="detail-gallery">
              <div className="main-image-frame"><img src={activeImage} alt={item.title} /></div>
              {item.images && item.images.length > 1 && (
                <div className="thumbnail-row">
                  {item.images.map((img, idx) => (
                    <img key={idx} src={img} className={activeImage === img ? 'active' : ''} onClick={() => setActiveImage(img)} />
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="detail-info">
              <div className="detail-header">
                <span className="detail-category"><Tag size={14}/> {item.category}</span>
                <span className="detail-views"><Eye size={14}/> {viewCount} views</span>
              </div>

              <h1>{item.title}</h1>
              
              <div className="detail-price-box">
                <span className="currency">₹</span><span className="amount">{item.price}</span>
              </div>

              <div className="detail-tags">
                <span className="tag condition">{item.condition} Condition</span>
                <span className="tag location"><MapPin size={14}/> KLU Campus</span>
              </div>

              <div className="detail-description">
                <h3>Description</h3>
                <p>{item.description}</p>
              </div>

              <div className="seller-badge">
                <div className="seller-avatar"><User size={20}/></div>
                <div>
                  <p className="seller-label">Sold by</p>
                  <p className="seller-name">KLU Student</p>
                </div>
                <div className="verified-badge"><ShieldCheck size={16}/> Verified</div>
              </div>

              <div className="detail-actions" style={{ display: 'flex', gap: '10px' }}>
                <button className="buy-now-large-btn" onClick={() => onBuy(item)} style={{ flex: 1 }}>
                  Buy Now - ₹{item.price}
                </button>
                <button 
                  onClick={handleShare} 
                  title="Share this item"
                  style={{
                    background: '#f1f5f9', color: '#003366', border: '1px solid #cbd5e1',
                    borderRadius: '12px', padding: '0 20px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s'
                  }}
                >
                  {copied ? <span style={{fontSize: '0.85rem', fontWeight:'bold'}}>Copied!</span> : <Share2 size={20} />}
                </button>
              </div>

              <QuestionSection item={item} />
            </div>
          </div>

          {/* --- NEW: SIMILAR ITEMS SECTION --- */}
          {similarItems.length > 0 && (
            <div className="similar-items-section">
              <h3>More {item.category} you might like</h3>
              <div className="similar-items-scroll">
                {similarItems.map(simItem => (
                  <div 
                    key={simItem._id} 
                    className="similar-card"
                    onClick={() => onSwitchItem(simItem)} // Calls parent to swap modal data
                  >
                    <img src={simItem.images[0] || 'https://via.placeholder.com/150'} alt={simItem.title} />
                    <div className="sim-details">
                      <div className="sim-title">{simItem.title.substring(0, 25)}...</div>
                      <div className="sim-price">₹{simItem.price}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* ---------------------------------- */}
          
        </div>
      </div>
    </div>
  );
};

export default ItemDetailModal;