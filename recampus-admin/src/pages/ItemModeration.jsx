import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Check, Pause, Trash2 } from 'lucide-react';

const ItemModeration = () => {
  const [pendingItems, setPendingItems] = useState([]);

  useEffect(() => {
    const fetchPending = async () => {
      const res = await axios.get('http://localhost:5000/api/items/admin/pending', {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      setPendingItems(res.data);
    };
    fetchPending();
  }, []);

  const moderate = async (id, status) => {
    let suggestedPrice = null;
    if (status === 'hold') {
      suggestedPrice = prompt("Enter a suggested price (₹) for the student:");
      if (!suggestedPrice) return;
    }

    try {
      await axios.patch(`http://localhost:5000/api/items/admin/validate/${id}`, {
        status, suggestedPrice
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      setPendingItems(prev => prev.filter(item => item._id !== id));
      alert(`Item has been moved to ${status}`);
    } catch (err) {
      alert("Error updating item");
    }
  };

  return (
    <div className="admin-card">
      <h2>Item Moderation Queue</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Item Details</th>
            <th>Seller Email</th>
            <th>Original Price</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {pendingItems.map(item => (
            <tr key={item._id}>
              <td>
                <strong>{item.title}</strong><br/>
                <small>{item.category}</small>
              </td>
              <td>{item.seller.email}</td>
              <td>₹{item.price}</td>
              <td>
                <div style={{display: 'flex', gap: '10px'}}>
                  <button onClick={() => moderate(item._id, 'approved')} title="Approve">
                    <Check color="green" />
                  </button>
                  <button onClick={() => moderate(item._id, 'hold')} title="Hold & Suggest Price">
                    <Pause color="orange" />
                  </button>
                  <button onClick={() => moderate(item._id, 'rejected')} title="Reject">
                    <Trash2 color="red" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ItemModeration;