import React, { useState } from 'react';
import axios from 'axios';
import { Home, User, Phone, MapPin, IndianRupee, Image as ImageIcon, CheckCircle } from 'lucide-react';

const HouseManagement = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    rent: '',
    location: '',
    ownerName: '',
    ownerPhone: '',
    images: [] // For now, we'll use string URLs
  });

  const [status, setStatus] = useState({ loading: false, success: false, error: '' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, success: false, error: '' });

    try {
      const token = localStorage.getItem('admin_token');
      await axios.post('http://localhost:5000/api/houses/add', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setStatus({ loading: false, success: true, error: '' });
      setFormData({ title: '', description: '', rent: '', location: '', ownerName: '', ownerPhone: '', images: [] });
      
      setTimeout(() => setStatus(prev => ({ ...prev, success: false })), 3000);
    } catch (err) {
      setStatus({ loading: false, success: false, error: 'Failed to publish listing. Check your connection.' });
    }
  };

  return (
    <div className="admin-card">
      <div className="card-header">
        <Home size={24} color="#3b82f6" />
        <h2>Register New Housing Listing</h2>
      </div>
      <p style={{ color: '#64748b', marginBottom: '25px' }}>
        Fill in the details for nearby student accommodations. Owner contact will be hidden from students by default.
      </p>

      {status.success && (
        <div className="admin-alert success">
          <CheckCircle size={18} /> Listing Published Successfully!
        </div>
      )}
      
      {status.error && (
        <div className="admin-alert error">{status.error}</div>
      )}

      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          {/* Section 1: Property Details */}
          <div className="form-section">
            <label>Property Title</label>
            <div className="input-with-icon">
              <Home size={16} />
              <input 
                name="title" value={formData.title} onChange={handleChange}
                placeholder="e.g., 2BHK Near KLU Gate 3" required 
              />
            </div>

            <label>Monthly Rent (₹)</label>
            <div className="input-with-icon">
              <IndianRupee size={16} />
              <input 
                name="rent" type="number" value={formData.rent} onChange={handleChange}
                placeholder="7500" required 
              />
            </div>

            <label>Location / Area</label>
            <div className="input-with-icon">
              <MapPin size={16} />
              <input 
                name="location" value={formData.location} onChange={handleChange}
                placeholder="Vaddeswaram / Kunchanapalli" required 
              />
            </div>
          </div>

          {/* Section 2: Owner Details */}
          <div className="form-section">
            <label>Owner Full Name</label>
            <div className="input-with-icon">
              <User size={16} />
              <input 
                name="ownerName" value={formData.ownerName} onChange={handleChange}
                placeholder="Mr. Rajesh" required 
              />
            </div>

            <label>Owner Phone Number</label>
            <div className="input-with-icon">
              <Phone size={16} />
              <input 
                name="ownerPhone" value={formData.ownerPhone} onChange={handleChange}
                placeholder="+91 XXXXX XXXXX" required 
              />
            </div>

            <label>Image URL</label>
            <div className="input-with-icon">
              <ImageIcon size={16} />
              <input 
                name="images" value={formData.images} 
                onChange={(e) => setFormData({...formData, images: [e.target.value]})}
                placeholder="https://image-link.com/photo.jpg" 
              />
            </div>
          </div>
        </div>

        <div className="form-full">
          <label>Detailed Description</label>
          <textarea 
            name="description" value={formData.description} onChange={handleChange}
            placeholder="Describe amenities (WiFi, Geyser, Parking, etc.)" rows="4" required
          ></textarea>
        </div>

        <button type="submit" className="admin-submit-btn" disabled={status.loading}>
          {status.loading ? 'Publishing...' : 'Publish Housing Listing'}
        </button>
      </form>
    </div>
  );
};

export default HouseManagement;