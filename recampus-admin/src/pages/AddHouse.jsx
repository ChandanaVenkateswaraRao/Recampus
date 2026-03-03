import React, { useState } from 'react';
import { addHouse } from '../api/adminApi';

const AddHouse = () => {
  const [formData, setFormData] = useState({
    title: '', description: '', rent: '', location: '',
    ownerName: '', ownerPhone: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await addHouse(formData);
      alert("House listing published!");
      setFormData({ title: '', description: '', rent: '', location: '', ownerName: '', ownerPhone: '' });
    } catch (err) { alert("Error adding house"); }
  };

  return (
    <div className="admin-page">
      <h1>Register New House Listing</h1>
      <form onSubmit={handleSubmit} className="admin-form">
        <input type="text" placeholder="Title (e.g. 2BHK near Gate 3)" onChange={e => setFormData({...formData, title: e.target.value})} />
        <textarea placeholder="Description" onChange={e => setFormData({...formData, description: e.target.value})} />
        <input type="number" placeholder="Rent per month" onChange={e => setFormData({...formData, rent: e.target.value})} />
        <input type="text" placeholder="Location/Area" onChange={e => setFormData({...formData, location: e.target.value})} />
        <input type="text" placeholder="Owner Name" onChange={e => setFormData({...formData, ownerName: e.target.value})} />
        <input type="text" placeholder="Owner Phone" onChange={e => setFormData({...formData, ownerPhone: e.target.value})} />
        <button type="submit">Publish Listing</button>
      </form>
    </div>
  );
};

export default AddHouse;