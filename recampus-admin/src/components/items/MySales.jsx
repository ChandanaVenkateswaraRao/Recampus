import React, { useState, useEffect } from 'react';
import axios from 'axios';
import VerificationModal from '../shared/VerificationModal';

const MySales = () => {
  const [sales, setSales] = useState([]);
  const [activeItem, setActiveItem] = useState(null);

  useEffect(() => {
    const fetchSales = async () => {
      const res = await axios.get('http://localhost:5000/api/profile/items', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      // Filter for items that are paid but not yet "sold" (completed)
      setSales(res.data.myListings.filter(item => item.isPaid && item.status !== 'sold'));
    };
    fetchSales();
  }, []);

  return (
    <div className="sales-container">
      <h3>Pending Handovers</h3>
      {sales.length === 0 ? <p>No items waiting for handover.</p> : (
        sales.map(item => (
          <div key={item._id} className="sale-card">
            <div className="sale-info">
              <h4>{item.title}</h4>
              <p>Sold to student ID: {item.buyer?.substring(0, 8)}...</p>
            </div>
            <button className="handover-btn" onClick={() => setActiveItem(item)}>
              Enter Buyer Code
            </button>
          </div>
        ))
      )}

      {activeItem && (
        <VerificationModal 
          type="item"
          id={activeItem._id}
          title={activeItem.title}
          amount={activeItem.price}
          onClose={() => setActiveItem(null)}
          onSuccess={(msg) => {
            alert(msg);
            window.location.reload(); // Refresh wallet and list
          }}
        />
      )}
    </div>
  );
};