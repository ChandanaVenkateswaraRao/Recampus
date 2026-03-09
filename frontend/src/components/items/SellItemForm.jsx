import React, { useState } from 'react';
import { Package, Upload, IndianRupee, Info, CheckCircle, X, Loader2 } from 'lucide-react';
import axios from 'axios';
import './SellItem.css';

const SellItemForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    title: '',
    category: 'Books',
    description: '',
    price: '',
    condition: 'Good',
    sellerPhone: '',
    images: [] // Will store Cloudinary URLs now
  });

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false); // New state for image loading

  // --- REPLACE THESE WITH YOUR CLOUDINARY DETAILS ---
  const CLOUD_NAME = "djn6ckph6"; 
  const UPLOAD_PRESET = "recampus"; 
  // ------------------------------------------------

  const categories = ['Books', 'Electronics', 'Lab Gear', 'Furniture', 'Clothing', 'Other'];
  const conditions = ['New', 'Good', 'Fair', 'Used'];

  // --- NEW: CLOUDINARY UPLOAD LOGIC ---
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    
    if (files.length + formData.images.length > 3) {
      alert("Max 3 images allowed.");
      return;
    }

    setUploadingImg(true);

    try {
      const uploadedUrls = await Promise.all(
        files.map(async (file) => {
          const data = new FormData();
          data.append("file", file);
          data.append("upload_preset", UPLOAD_PRESET);
          data.append("cloud_name", CLOUD_NAME);

          const res = await axios.post(
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
            data
          );
          return res.data.secure_url; // This is the web link
        })
      );

      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...uploadedUrls]
      }));

    } catch (err) {
      console.error("Upload Error:", err);
      alert("Failed to upload image. Check your internet.");
    } finally {
      setUploadingImg(false);
    }
  };

  const removeImage = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, index) => index !== indexToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.images.length === 0) {
      alert("Please upload at least one image.");
      return;
    }

    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      await axios.post('https://recampus-backend.onrender.com/api/items/list', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      alert("Error listing item.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="success-state">
        <CheckCircle size={60} color="#00A36C" />
        <h2>Sent for Validation</h2>
        <p>Your item has been saved. Our admin team will review the details shortly.</p>
        <button className="done-btn" onClick={() => onSuccess()}>Back to Browse</button>
      </div>
    );
  }

  return (
    <div className="sell-form-container">
      <div className="form-header">
        <Package size={24} />
        <h2>List a New Resource</h2>
        <p>Your listing will be published once approved by KLU Admin.</p>
      </div>

      <form onSubmit={handleSubmit} className="sell-form">
        <div className="form-group">
          <label>Product Title</label>
          <input 
            type="text" placeholder="e.g. Engineering Physics Textbook" required
            onChange={(e) => setFormData({...formData, title: e.target.value})}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Category</label>
            <select onChange={(e) => setFormData({...formData, category: e.target.value})}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Condition</label>
            <select onChange={(e) => setFormData({...formData, condition: e.target.value})}>
              {conditions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea 
            placeholder="Details about the item..." rows="4" required
            onChange={(e) => setFormData({...formData, description: e.target.value})}
          ></textarea>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Expected Price (₹)</label>
            <div className="price-input">
              <IndianRupee size={16} />
              <input 
                type="number" placeholder="0.00" required
                onChange={(e) => setFormData({...formData, price: e.target.value})}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Contact Number</label>
            <div className="price-input">
              <span style={{fontSize: '0.8rem'}}>📞</span>
              <input 
                type="tel" placeholder="9876543210" required maxLength="10"
                onChange={(e) => setFormData({...formData, sellerPhone: e.target.value})}
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>Upload Images (Max 3)</label>
          
          <div className="upload-area">
            <input 
              type="file" accept="image/*" multiple 
              onChange={handleImageUpload} id="file-upload" style={{ display: 'none' }} 
            />
            <label htmlFor="file-upload" className="upload-placeholder">
              {uploadingImg ? <Loader2 className="spin" size={24}/> : <Upload size={24} />}
              <span>{uploadingImg ? "Uploading..." : "Click to upload photos"}</span>
            </label>
          </div>

          {/* Image Previews */}
          {formData.images.length > 0 && (
            <div className="image-previews">
              {formData.images.map((img, index) => (
                <div key={index} className="preview-thumb">
                  <img src={img} alt="preview" />
                  <button type="button" className="remove-img" onClick={() => removeImage(index)}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" className="submit-btn" disabled={loading || uploadingImg}>
          {loading ? 'Processing...' : 'Submit for Approval'}
        </button>
      </form>
    </div>
  );
};

export default SellItemForm;