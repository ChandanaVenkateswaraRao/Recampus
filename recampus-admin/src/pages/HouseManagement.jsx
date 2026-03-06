import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Home,
  User,
  Phone,
  MapPin,
  IndianRupee,
  Image as ImageIcon,
  CheckCircle,
  Trash2,
  ReceiptText,
  Edit3,
  RefreshCcw,
  RotateCcw,
  Search
} from 'lucide-react';
import {
  adminDeleteHouse,
  adminRestoreHouse,
  adminUpdateHouse,
  fetchAdminHouses,
  fetchHouseUnlockSummary
} from '../api/adminApi';

const MAX_IMAGES = 3;
const MAX_FILE_SIZE_MB = 2;

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });

const HouseManagement = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    rent: '',
    location: '',
    ownerName: '',
    ownerPhone: '',
    images: []
  });

  const [status, setStatus] = useState({ loading: false, success: false, error: '' });
  const [uploadingImages, setUploadingImages] = useState(false);
  const [houseListState, setHouseListState] = useState({
    loading: false,
    houses: [],
    total: 0,
    totalPages: 1,
    page: 1
  });
  const [deletingHouseId, setDeletingHouseId] = useState('');
  const [restoringHouseId, setRestoringHouseId] = useState('');
  const [editingHouseId, setEditingHouseId] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    _id: '',
    title: '',
    description: '',
    rent: '',
    location: '',
    ownerName: '',
    ownerPhone: '',
    images: [],
    isAvailable: true
  });
  const [uploadingEditImages, setUploadingEditImages] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 10;
  const [houseUnlockInsights, setHouseUnlockInsights] = useState({
    windowDays: 30,
    totalUnlocks: 0,
    totalRevenue: 0,
    avgRevenuePerUnlock: 0,
    methodCounts: {},
    listings: []
  });

  const loadHouses = async (overrides = {}) => {
    const querySearch = overrides.search ?? search;
    const queryStatus = overrides.status ?? statusFilter;
    const queryPage = overrides.page ?? page;

    try {
      setHouseListState((prev) => ({ ...prev, loading: true }));
      const res = await fetchAdminHouses({
        search: querySearch,
        status: queryStatus,
        page: queryPage,
        limit
      });
      setHouseListState({
        loading: false,
        houses: Array.isArray(res?.data?.houses) ? res.data.houses : [],
        total: Number(res?.data?.total || 0),
        totalPages: Number(res?.data?.totalPages || 1),
        page: Number(res?.data?.page || queryPage)
      });
    } catch (_) {
      setHouseListState({ loading: false, houses: [], total: 0, totalPages: 1, page: 1 });
    }
  };

  useEffect(() => {
    const loadHouseUnlockInsights = async () => {
      try {
        const res = await fetchHouseUnlockSummary(30);
        setHouseUnlockInsights(
          res.data || {
            windowDays: 30,
            totalUnlocks: 0,
            totalRevenue: 0,
            avgRevenuePerUnlock: 0,
            methodCounts: {},
            listings: []
          }
        );
      } catch (_) {
        setHouseUnlockInsights({
          windowDays: 30,
          totalUnlocks: 0,
          totalRevenue: 0,
          avgRevenuePerUnlock: 0,
          methodCounts: {},
          listings: []
        });
      }
    };

    loadHouseUnlockInsights();
  }, []);

  useEffect(() => {
    loadHouses();
  }, [search, statusFilter, page]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageUpload = async (e) => {
    const fileList = Array.from(e.target.files || []);
    if (!fileList.length) {
      setFormData((prev) => ({ ...prev, images: [] }));
      return;
    }

    if (fileList.length > MAX_IMAGES) {
      setStatus({
        loading: false,
        success: false,
        error: `Please upload up to ${MAX_IMAGES} images only.`
      });
      return;
    }

    const oversize = fileList.find((file) => file.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversize) {
      setStatus({
        loading: false,
        success: false,
        error: `Each image must be less than ${MAX_FILE_SIZE_MB}MB.`
      });
      return;
    }

    try {
      setUploadingImages(true);
      setStatus((prev) => ({ ...prev, error: '' }));
      const dataUrls = await Promise.all(fileList.map((file) => fileToDataUrl(file)));
      setFormData((prev) => ({ ...prev, images: dataUrls }));
    } catch (_) {
      setStatus({ loading: false, success: false, error: 'Could not process selected images.' });
    } finally {
      setUploadingImages(false);
    }
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
      setPage(1);
      loadHouses({ page: 1 });
      
      setTimeout(() => setStatus(prev => ({ ...prev, success: false })), 3000);
    } catch (err) {
      setStatus({ loading: false, success: false, error: 'Failed to publish listing. Check your connection.' });
    }
  };

  const handleDeleteHouse = async (houseId) => {
    const confirmed = window.confirm('Archive this listing and remove it from website? You can restore it later.');
    if (!confirmed) return;

    try {
      setDeletingHouseId(houseId);
      await adminDeleteHouse(houseId);
      loadHouses();
    } catch (_) {
      alert('Unable to archive house listing right now.');
    } finally {
      setDeletingHouseId('');
    }
  };

  const handleRestoreHouse = async (houseId) => {
    try {
      setRestoringHouseId(houseId);
      await adminRestoreHouse(houseId);
      loadHouses();
    } catch (_) {
      alert('Unable to restore house listing right now.');
    } finally {
      setRestoringHouseId('');
    }
  };

  const handleEditHouse = (house) => {
    setEditForm({
      _id: house._id,
      title: house.title || '',
      description: house.description || '',
      rent: String(house.rent || ''),
      location: house.location || '',
      ownerName: house.ownerName || '',
      ownerPhone: house.ownerPhone || '',
      images: Array.isArray(house.images) ? house.images.slice(0, MAX_IMAGES) : [],
      isAvailable: Boolean(house.isAvailable)
    });
    setEditModalOpen(true);
  };

  const handleEditFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleEditImageUpload = async (e) => {
    const fileList = Array.from(e.target.files || []);
    if (!fileList.length) return;

    if (fileList.length > MAX_IMAGES) {
      alert(`Please upload up to ${MAX_IMAGES} images only.`);
      return;
    }

    const oversize = fileList.find((file) => file.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversize) {
      alert(`Each image must be less than ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    try {
      setUploadingEditImages(true);
      const dataUrls = await Promise.all(fileList.map((file) => fileToDataUrl(file)));
      setEditForm((prev) => ({ ...prev, images: dataUrls }));
    } catch (_) {
      alert('Could not process selected images.');
    } finally {
      setUploadingEditImages(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm._id) return;

    const rent = Number(editForm.rent);
    if (!Number.isFinite(rent) || rent <= 0) {
      alert('Rent must be a positive number.');
      return;
    }

    try {
      setEditingHouseId(editForm._id);
      await adminUpdateHouse(editForm._id, {
        title: String(editForm.title || '').trim(),
        description: String(editForm.description || '').trim(),
        rent,
        location: String(editForm.location || '').trim(),
        ownerName: String(editForm.ownerName || '').trim(),
        ownerPhone: String(editForm.ownerPhone || '').trim(),
        images: Array.isArray(editForm.images) ? editForm.images : [],
        isAvailable: Boolean(editForm.isAvailable)
      });

      setEditModalOpen(false);
      loadHouses();
    } catch (err) {
      alert(err?.response?.data?.message || 'Unable to update house listing right now.');
    } finally {
      setEditingHouseId('');
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const onStatusChange = (e) => {
    setPage(1);
    setStatusFilter(e.target.value);
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-card">
        <div className="card-header">
          <Home size={24} color="#3b82f6" />
          <h2>Register New Housing Listing</h2>
        </div>
        <p style={{ color: '#64748b', marginBottom: '25px' }}>
          Fill in the details for nearby student accommodations. Only admins can publish listings, and students must pay Rs.50 to unlock owner contact.
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

              <label>Monthly Rent (Rs.)</label>
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

              <label>House Images</label>
              <div className="input-with-icon">
                <ImageIcon size={16} />
                <input 
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                />
              </div>
              <small style={{ color: '#64748b' }}>
                Stored directly in MongoDB. Upload up to {MAX_IMAGES} images (max {MAX_FILE_SIZE_MB}MB each).
              </small>
              {uploadingImages && <small style={{ color: '#2563eb' }}>Processing images...</small>}
              {formData.images.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {formData.images.map((img, index) => (
                    <img
                      key={`${index}-${img.slice(0, 24)}`}
                      src={img}
                      alt={`Preview ${index + 1}`}
                      style={{ width: '74px', height: '74px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-full">
            <label>Detailed Description</label>
            <textarea 
              name="description" value={formData.description} onChange={handleChange}
              placeholder="Describe amenities (WiFi, Geyser, Parking, etc.)" rows="4" required
            ></textarea>
          </div>

          <button type="submit" className="admin-submit-btn" disabled={status.loading || uploadingImages}>
            {status.loading ? 'Publishing...' : 'Publish Housing Listing'}
          </button>
        </form>
      </div>

      <div className="admin-card" style={{ marginTop: '16px' }}>
        <h3>House Unlock Payments ({houseUnlockInsights.windowDays} days)</h3>
        <div className="house-unlock-grid">
          <div className="house-unlock-card">
            <div className="icon-wrap"><ReceiptText size={18} /></div>
            <div>
              <strong>{houseUnlockInsights.totalUnlocks}</strong>
              <p>Total Unlock Transactions</p>
            </div>
          </div>
          <div className="house-unlock-card">
            <div className="icon-wrap"><IndianRupee size={18} /></div>
            <div>
              <strong>Rs.{Number(houseUnlockInsights.totalRevenue || 0).toFixed(2)}</strong>
              <p>Unlock Revenue</p>
            </div>
          </div>
          <div className="house-unlock-card">
            <div className="icon-wrap"><Home size={18} /></div>
            <div>
              <strong>Rs.{Number(houseUnlockInsights.avgRevenuePerUnlock || 0).toFixed(2)}</strong>
              <p>Average Revenue / Unlock</p>
            </div>
          </div>
        </div>

        <div className="house-unlock-meta-row">
          {Object.entries(houseUnlockInsights.methodCounts || {}).map(([method, count]) => (
            <span key={method} className="method-chip">
              {method}: <strong>{count}</strong>
            </span>
          ))}
        </div>

        <div className="house-unlock-table-wrap">
          <table className="admin-table house-unlock-table">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Owner</th>
                <th>Location</th>
                <th>Unlocks</th>
                <th>Revenue</th>
                <th>Likes</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(houseUnlockInsights.listings) && houseUnlockInsights.listings.length > 0 ? (
                houseUnlockInsights.listings.map((listing) => (
                  <tr key={listing.houseId}>
                    <td>{listing.title}</td>
                    <td>{listing.ownerName}</td>
                    <td>{listing.location}</td>
                    <td>{listing.unlocksInWindow}</td>
                    <td>Rs.{Number(listing.revenueInWindow || 0).toFixed(2)}</td>
                    <td>{listing.likesCount}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="ride-monitor-empty">No house unlock payments in this window.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: '16px' }}>
        <h3>Listed Houses Management</h3>
        <p className="house-admin-subtitle">
          Search, filter, edit, archive/restore listings and track money earned in one place.
        </p>

        <div className="house-admin-toolbar">
          <form className="ride-monitor-search house-search" onSubmit={handleSearchSubmit}>
            <Search size={16} />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search house, owner, phone, location"
            />
            <button type="submit">Search</button>
          </form>

          <select value={statusFilter} onChange={onStatusChange}>
            <option value="all">All</option>
            <option value="live">Live</option>
            <option value="hidden">Hidden</option>
            <option value="archived">Archived</option>
          </select>

          <button type="button" className="ride-refresh-btn" onClick={() => loadHouses()}>
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>

        <div className="house-admin-list-wrap">
          <table className="admin-table house-admin-list-table">
            <thead>
              <tr>
                <th>House</th>
                <th>Owner Name</th>
                <th>Phone</th>
                <th>Location</th>
                <th>Rent</th>
                <th>Money Got</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {houseListState.loading ? (
                <tr>
                  <td colSpan="8" className="ride-monitor-empty">Loading listed houses...</td>
                </tr>
              ) : Array.isArray(houseListState.houses) && houseListState.houses.length > 0 ? (
                houseListState.houses.map((house) => (
                  <tr key={house._id}>
                    <td>
                      <strong>{house.title}</strong>
                      <small className="house-admin-meta">Unlocks: {house.unlockCount} | Likes: {house.likesCount}</small>
                    </td>
                    <td>{house.ownerName}</td>
                    <td>
                      <span className="house-phone-pill"><Phone size={13} /> {house.ownerPhone}</span>
                    </td>
                    <td>{house.location}</td>
                    <td>Rs.{Number(house.rent || 0).toFixed(2)}</td>
                    <td className="house-revenue-cell">Rs.{Number(house.revenueGenerated || 0).toFixed(2)}</td>
                    <td>
                      <span className={`house-status-chip ${house.isArchived ? 'archived' : house.isAvailable ? 'live' : 'hidden'}`}>
                        {house.isArchived ? 'Archived' : house.isAvailable ? 'Live' : 'Hidden'}
                      </span>
                    </td>
                    <td>
                      <div className="house-actions-row">
                        <button
                          type="button"
                          className="house-edit-btn"
                          onClick={() => handleEditHouse(house)}
                          disabled={editingHouseId === house._id}
                          title="Edit listing"
                        >
                          <Edit3 size={14} />
                        </button>

                        {house.isArchived ? (
                          <button
                            type="button"
                            className="house-restore-btn"
                            onClick={() => handleRestoreHouse(house._id)}
                            disabled={restoringHouseId === house._id}
                            title="Restore listing"
                          >
                            <RotateCcw size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="house-delete-btn"
                            onClick={() => handleDeleteHouse(house._id)}
                            disabled={deletingHouseId === house._id}
                            title="Archive listing"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="ride-monitor-empty">No listed houses found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="house-pagination-row">
          <span>Showing page {houseListState.page} of {houseListState.totalPages} ({houseListState.total} listings)</span>
          <div className="house-pagination-actions">
            <button
              type="button"
              className="ride-refresh-btn"
              disabled={houseListState.page <= 1 || houseListState.loading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Prev
            </button>
            <button
              type="button"
              className="ride-refresh-btn"
              disabled={houseListState.page >= houseListState.totalPages || houseListState.loading}
              onClick={() => setPage((prev) => Math.min(houseListState.totalPages, prev + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {editModalOpen && (
        <div className="house-edit-modal-backdrop" onClick={() => setEditModalOpen(false)}>
          <div className="house-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="house-edit-modal-head">
              <h3>Edit House Listing</h3>
              <button type="button" className="house-modal-close" onClick={() => setEditModalOpen(false)}>x</button>
            </div>

            <form className="house-edit-form" onSubmit={handleEditSubmit}>
              <label>Title</label>
              <input name="title" value={editForm.title} onChange={handleEditFormChange} required />

              <label>Description</label>
              <textarea name="description" rows="3" value={editForm.description} onChange={handleEditFormChange} required />

              <div className="house-edit-grid">
                <div>
                  <label>Rent (Rs.)</label>
                  <input name="rent" type="number" value={editForm.rent} onChange={handleEditFormChange} required />
                </div>
                <div>
                  <label>Location</label>
                  <input name="location" value={editForm.location} onChange={handleEditFormChange} required />
                </div>
              </div>

              <div className="house-edit-grid">
                <div>
                  <label>Owner Name</label>
                  <input name="ownerName" value={editForm.ownerName} onChange={handleEditFormChange} required />
                </div>
                <div>
                  <label>Owner Phone</label>
                  <input name="ownerPhone" value={editForm.ownerPhone} onChange={handleEditFormChange} required />
                </div>
              </div>

              <label>Replace Images</label>
              <input type="file" accept="image/*" multiple onChange={handleEditImageUpload} />
              {uploadingEditImages && <small>Processing selected images...</small>}
              {Array.isArray(editForm.images) && editForm.images.length > 0 && (
                <div className="house-edit-image-row">
                  {editForm.images.map((img, index) => (
                    <img key={`${index}-${img.slice(0, 24)}`} src={img} alt={`Edit preview ${index + 1}`} />
                  ))}
                </div>
              )}

              <label className="house-edit-checkbox">
                <input
                  type="checkbox"
                  name="isAvailable"
                  checked={Boolean(editForm.isAvailable)}
                  onChange={handleEditFormChange}
                />
                Keep listing live on website
              </label>

              <div className="house-edit-actions">
                <button type="button" className="house-modal-cancel" onClick={() => setEditModalOpen(false)}>Cancel</button>
                <button type="submit" className="house-modal-save" disabled={uploadingEditImages || editingHouseId === editForm._id}>
                  {editingHouseId === editForm._id ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HouseManagement;