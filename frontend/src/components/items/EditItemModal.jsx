import React, { useState } from 'react';
import axios from 'axios';
import { X, Loader2 } from 'lucide-react';
import './Items.css';

const EditItemModal = ({ item, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: item.title,
    description: item.description,
    price: item.price
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`http://localhost:5000/api/items/edit/${item._id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Item updated! It has been sent to the Admin for re-approval.");
      onSuccess();
    } catch (err) {
      alert("Failed to update item.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        <button className="close-btn" onClick={onClose}><X /></button>
        <h2>Edit Listing</h2>
        <p style={{color: '#64748b', fontSize: '0.85rem', marginBottom: '20px'}}>
          Note: Editing an item will change its status back to "Pending" for Admin review.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{fontWeight: 'bold', fontSize: '0.85rem'}}>Title</label>
            <input 
              type="text" value={formData.title} required className="gateway-input"
              onChange={e => setFormData({...formData, title: e.target.value})}
            />
          </div>
          <div>
            <label style={{fontWeight: 'bold', fontSize: '0.85rem'}}>Description</label>
            <textarea 
              value={formData.description} required className="gateway-input" rows="4"
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>
          <div>
            <label style={{fontWeight: 'bold', fontSize: '0.85rem'}}>Price (₹)</label>
            <input 
              type="number" value={formData.price} required className="gateway-input"
              onChange={e => setFormData({...formData, price: e.target.value})}
            />
          </div>

          <button type="submit" className="finish-btn" disabled={loading} style={{marginTop: '10px'}}>
            {loading ? <Loader2 className="spin" /> : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditItemModal;