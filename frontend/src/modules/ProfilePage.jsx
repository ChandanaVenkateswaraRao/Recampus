import React, { useMemo, useState, useEffect } from 'react';
import { useModule } from '../context/ModuleContext.jsx';
import axios from 'axios';
import { updatePhone } from '../api/auth';
import EditItemModal from '../components/items/EditItemModal.jsx';
import { Eye, Trash2, Edit, Store } from 'lucide-react'; // Add these icons

import { 
  Package, Bike, Home, CheckCircle, ShieldAlert, Key, 
  ShoppingCart, Loader2, FileText, Calendar, CalendarDays, Star, TrendingUp,
  TrendingDown,
  User, Phone, Wallet
} from 'lucide-react';
import VerificationModal from '../components/shared/VerificationModal.jsx';
import WalletSetup from '../components/WalletSetup.jsx'; // Import Wallet Component
import './Profile.css';
import ItemCard from '../components/items/ItemCard'; 
import { Heart } from 'lucide-react';
const ProfilePage = () => {
  const { activeModule, profileSection, setActiveModule, setCurrentView, setRideRole } = useModule();
  const [history, setHistory] = useState(null);
  const [userData, setUserData] = useState(null); // Store user data for Wallet/Avatar
  const [loading, setLoading] = useState(true);
  const [verifyingItem, setVerifyingItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [ridesTab, setRidesTab] = useState('passenger');
  const [ridesStatusFilter, setRidesStatusFilter] = useState('all');
  const [ridesDateRange, setRidesDateRange] = useState({ from: '', to: '' });
  const [ratingRide, setRatingRide] = useState(null);
  const [ratingAsRole, setRatingAsRole] = useState('passenger');
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingReview, setRatingReview] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  useEffect(() => {
    fetchData();
  }, [activeModule]);

  useEffect(() => {
    if (activeModule === 'Ride') {
      setRidesTab('passenger');
      setRidesStatusFilter('all');
    }
  }, [activeModule]);

  useEffect(() => {
    setRidesStatusFilter('all');
  }, [ridesTab]);

  useEffect(() => {
    setRidesDateRange({ from: '', to: '' });
  }, [ridesTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // 1. Fetch Module History
      const resHistory = await axios.get(`http://localhost:5000/api/profile/${activeModule}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // 2. Fetch User Profile (for Wallet Address & Roles)
      const resUser = await axios.get('http://localhost:5000/api/auth/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });

      setHistory(resHistory.data);
      setUserData(resUser.data);
      setPhoneDraft(resUser.data?.phone || '');
    } catch (err) {
      console.error("Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptPrice = async (itemId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`http://localhost:5000/api/items/accept-suggestion/${itemId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Price accepted! Item is now live.");
      fetchData(); // Refresh data
    } catch (err) { alert("Failed to update price."); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this listing?")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/items/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData(); // Refresh
    } catch (err) { alert(err.response?.data || "Delete failed"); }
  };

  const handleSoldOffline = async (id) => {
    if (!window.confirm("Mark this item as sold offline? It will be removed from the marketplace.")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`http://localhost:5000/api/items/sold-offline/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData(); // Refresh
    } catch (err) { alert(err.response?.data || "Update failed"); }
  };

  const handleUpdatePhone = async () => {
    const normalized = String(phoneDraft || '').trim();
    if (!/^\+?[0-9]{10,15}$/.test(normalized)) {
      alert('Please enter a valid phone number (10-15 digits).');
      return;
    }

    try {
      setSavingPhone(true);
      const token = localStorage.getItem('token');
      const res = await updatePhone(normalized, token);
      if (res.data?.user) {
        setUserData(res.data.user);
        setPhoneDraft(res.data.user.phone || normalized);
      }
      alert(res.data?.message || 'Phone updated successfully.');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update phone.');
    } finally {
      setSavingPhone(false);
    }
  };
  // --- UTILITY: Date Formatter ---
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    const value = Number(amount);
    if (!Number.isFinite(value)) return '-';
    return `₹${value.toFixed(2)}`;
  };

  const getRideSettlement = (ride) => {
    if (!ride || typeof ride !== 'object') return null;
    if (!ride.settlement || typeof ride.settlement !== 'object') return null;
    return ride.settlement;
  };

  const getCaptainSettlementAmount = (ride) => {
    const settlement = getRideSettlement(ride);
    const payout = Number(settlement?.captainPayoutAmount);
    if (Number.isFinite(payout)) return payout;

    const fare = Number(ride?.price);
    if (!Number.isFinite(fare)) return 0;
    return Number((fare * 0.90).toFixed(2));
  };

  const openRideRebook = (ride) => {
    if (!ride?.pickupLocation?.address || !ride?.dropLocation?.address) {
      alert('Pickup/drop details are unavailable for this ride.');
      return;
    }

    try {
      localStorage.setItem('recampus_ride_rebook_draft', JSON.stringify({
        type: ride?.type || 'on-spot',
        pickupLocation: {
          address: ride?.pickupLocation?.address || '',
          lat: Number(ride?.pickupLocation?.lat),
          lng: Number(ride?.pickupLocation?.lng)
        },
        dropLocation: {
          address: ride?.dropLocation?.address || '',
          lat: Number(ride?.dropLocation?.lat),
          lng: Number(ride?.dropLocation?.lng)
        }
      }));
    } catch (_) {}

    setRideRole('passenger');
    setActiveModule('Ride');
    setCurrentView('browse');
  };

  const openRideRatingModal = (ride, roleType) => {
    setRatingRide(ride || null);
    setRatingAsRole(roleType === 'captain' ? 'captain' : 'passenger');
    setRatingScore(5);
    setRatingReview('');
  };

  const submitRideRating = async () => {
    if (!ratingRide?._id) return;
    if (ratingScore < 1 || ratingScore > 5) {
      alert('Please choose a rating between 1 and 5 stars.');
      return;
    }

    try {
      setRatingSubmitting(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:5000/api/rides/rate/${ratingRide._id}`,
        { score: ratingScore, review: ratingReview },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRatingRide(null);
      setRatingReview('');
      setRatingScore(5);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Unable to submit rating.');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const raiseRideDispute = async (ride) => {
    const reason = window.prompt('Describe the issue for this ride dispute (min 5 chars):', 'Payment/service issue');
    if (reason === null) return;
    const normalizedReason = String(reason || '').trim();
    if (normalizedReason.length < 5) {
      alert('Please enter at least 5 characters for dispute reason.');
      return;
    }

    const evidenceText = window.prompt('Optional evidence details (chat, delay context, etc.):', '');
    if (evidenceText === null) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://localhost:5000/api/rides/${ride._id}/dispute`,
        { reason: normalizedReason, evidenceText: String(evidenceText || '').trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Dispute raised successfully. Admin will review it soon.');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to raise dispute.');
    }
  };

  // --- UTILITY: Generate Professional Invoice ---
  const generateBill = (item) => {
    const invoiceWindow = window.open('', 'PRINT', 'height=600,width=800');
    invoiceWindow.document.write(`
      <html>
        <head>
          <title>Invoice #${item._id.slice(-6)}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #003366; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: #003366; }
            .invoice-details { text-align: right; }
            .section-title { font-size: 14px; font-weight: bold; color: #666; margin-bottom: 5px; text-transform: uppercase; }
            .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .table th { text-align: left; padding: 10px; background: #f4f4f4; border-bottom: 1px solid #ddd; }
            .table td { padding: 10px; border-bottom: 1px solid #eee; }
            .total-box { margin-top: 30px; text-align: right; }
            .total-amount { font-size: 24px; font-weight: bold; color: #003366; }
            .footer { margin-top: 50px; font-size: 12px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
            .paid-stamp { border: 2px solid #166534; color: #166534; padding: 5px 10px; border-radius: 5px; font-weight: bold; display: inline-block; margin-top: 10px; text-transform: uppercase; transform: rotate(-5deg); }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">RECAMPUS KLU</div>
            <div class="invoice-details">
              <h1>INVOICE</h1>
              <p>ID: #${item._id.slice(-6).toUpperCase()}</p>
              <p>Date: ${new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
            <div>
              <div class="section-title">Bill To</div>
              <p>KLU Student (Buyer)</p>
              <p>Campus ID: Verified</p>
            </div>
            <div style="text-align: right;">
               <div class="section-title">Payment Status</div>
               <div class="paid-stamp">PAID via Escrow</div>
            </div>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th>Item Description</th>
                <th>Category</th>
                <th>Condition</th>
                <th style="text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${item.title}</td>
                <td>${item.category}</td>
                <td>${item.condition}</td>
                <td style="text-align: right;">₹${item.price.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div class="total-box">
            <p>Subtotal: ₹${item.price.toFixed(2)}</p>
            <p>Platform Fee: ₹0.00</p>
            <div class="total-amount">Total: ₹${item.price.toFixed(2)}</div>
          </div>

          <div class="footer">
            <p>This is a computer-generated invoice from the Recampus Platform.</p>
            <p>Kalasalingam Academy of Research and Education - KARE</p>
          </div>
        </body>
      </html>
    `);
    invoiceWindow.document.close();
    invoiceWindow.focus();
    invoiceWindow.print();
    invoiceWindow.close();
  };

  // --- SUB-COMPONENTS (VIEWS) ---

  const ListingsView = ({ items }) => {
    const activeCount = items?.filter(i => i.status === 'approved').length || 0;
    const pendingCount = items?.filter(i => i.status === 'pending' || i.status === 'hold').length || 0;

    return (
      <section className="history-block fade-in">
        <div className="stats-banner">
          <div className="stat-item">
            <div className="stat-label">Total Listings</div>
            <div className="stat-value">{items?.length || 0}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Active</div>
            <div className="stat-value text-green">{activeCount}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Pending/Hold</div>
            <div className="stat-value text-orange">{pendingCount}</div>
          </div>
        </div>

        <div className="section-header">
          <Package size={24} color="#003366"/>
          <h3>My Listings</h3>
        </div>

        <div className="history-grid">
          {items?.length > 0 ? items.map(item => (
            <div key={item._id} className="activity-card-wrapper">
              <div className="activity-card">
                <div className="activity-info">
                  <h4>{item.title}</h4>
                  <div className="meta-row">
                    <span className="meta-tag"><Calendar size={12}/> Listed: {formatDate(item.createdAt)}</span>
                    <span className="meta-tag">ID: #{item._id.slice(-6).toUpperCase()}</span>
                     <span className="meta-tag" style={{ color: '#3b82f6', backgroundColor: '#eff6ff' }}>
                    <Eye size={12}/> {item.views || 0} Views
                  </span>
                  </div>
                </div>
                <div className="price-column">
                  <span className="price-tag">₹{item.price}</span>
                  <div className={`status-pill ${item.status?.toLowerCase()}`}>{item.status}</div>
                </div>
              </div>

               {!item.isPaid && item.status !== 'sold' && (
                <div className="seller-controls-bar">
                  <button className="ctrl-btn edit" onClick={() => setEditingItem(item)}>
                    <Edit size={14} /> Edit
                  </button>
                  <button className="ctrl-btn offline" onClick={() => handleSoldOffline(item._id)}>
                    <Store size={14} /> Sold Offline
                  </button>
                  <button className="ctrl-btn delete" onClick={() => handleDelete(item._id)}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
              
              {item.status === 'hold' && (
                <div className="action-box warning" style={{borderTop: 'none'}}>
                  <ShieldAlert size={16} />
                  <span>Admin suggested ₹{item.suggestedPrice}</span>
                  <button className="small-btn primary" onClick={() => handleAcceptPrice(item._id)}>Accept</button>
                </div>
              )}

              {item.status === 'hold' && (
                <div className="action-box warning">
                  <ShieldAlert size={16} />
                  <span>Admin suggested ₹{item.suggestedPrice}</span>
                  <button className="small-btn primary" onClick={() => handleAcceptPrice(item._id)}>Accept</button>
                </div>
              )}
            </div>
          )) : <EmptyState msg="You haven't listed any items." />}
        </div>
      </section>
    );
  };

  const WishlistView = () => {
    const [wishlistItems, setWishlistItems] = useState([]);
    const [wLoading, setWLoading] = useState(true);

    useEffect(() => {
      const fetchWishlist = async () => {
        try {
          const token = localStorage.getItem('token');
          const res = await axios.get('http://localhost:5000/api/items/wishlist/my', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setWishlistItems(res.data);
        } catch (err) {
          console.error("Error loading wishlist");
        } finally {
          setWLoading(false);
        }
      };
      fetchWishlist();
    }, []);

    // Helper to remove item from view immediately when un-hearted
    const handleRemove = (id) => {
      setWishlistItems(prev => prev.filter(item => item._id !== id));
    };

    if (wLoading) return <div className="loader-container"><div className="loader"></div></div>;

    return (
      <section className="history-block fade-in">
        <div className="section-header">
          <Heart size={24} color="#C62828" fill="#C62828" />
          <h3>My Wishlist</h3>
        </div>
        
        <div className="history-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
          {wishlistItems.length > 0 ? wishlistItems.map(item => (
            // We reuse ItemCard. logic: Clicking buy redirects to browse or opens modal
            <div key={item._id} className="wishlist-card-wrapper">
               <ItemCard 
                 item={item} 
                 onBuy={() => alert("Go to Browse page to purchase this item.")} 
                 onView={() => {}} // Optional: Open detail modal
               />
               {/* Overlay to force remove update */}
               <button 
                 className="remove-wishlist-text"
                 onClick={async (e) => {
                   e.stopPropagation();
                   try {
                     const token = localStorage.getItem('token');
                     await axios.post(`http://localhost:5000/api/items/wishlist/toggle/${item._id}`, {}, {
                       headers: { Authorization: `Bearer ${token}` }
                     });
                     handleRemove(item._id);
                   } catch(err) {}
                 }}
               >
                 Remove
               </button>
            </div>
          )) : <EmptyState msg="Your wishlist is empty." />}
        </div>
      </section>
    );
  };

  const SalesView = ({ items }) => {
    const soldItems = items?.filter(i => i.status === 'sold') || [];
    const totalEarnings = soldItems.reduce((acc, curr) => acc + curr.price, 0);

    return (
      <section className="history-block fade-in">
        <div className="stats-banner gold-bg">
          <div className="stat-item">
            <div className="stat-label">Total Earnings</div>
            <div className="stat-value">₹{totalEarnings.toFixed(2)}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Items Sold</div>
            <div className="stat-value">{soldItems.length}</div>
          </div>
        </div>

        <div className="section-header">
          <TrendingUp size={24} color="#166534"/>
          <h3>My Sales History</h3>
        </div>

        <div className="history-grid">
          {items?.filter(i => i.isPaid).length > 0 ? items.filter(i => i.isPaid).map(item => (
            <div key={item._id} className="activity-card-wrapper">
              <div className="activity-card">
                <div className="activity-info">
                  <h4>{item.title}</h4>
                  <div className="meta-row">
                    {item.status === 'sold' && (
                      <span className="meta-tag success"><CheckCircle size={12}/> Sold: {formatDate(item.updatedAt)}</span>
                    )}
                    <span className="meta-tag">Price: ₹{item.price}</span>
                  </div>
                </div>
                {item.status === 'sold' && <div className="earnings-pill">+ ₹{(item.price * 0.95).toFixed(0)} Net</div>}
              </div>

              {item.status !== 'sold' ? (
                <div className="action-box success">
                  <CheckCircle size={16} />
                  <span>Buyer paid. Collect code to finish sale.</span>
                  <button className="handover-btn" onClick={() => setVerifyingItem(item)}>Enter Code</button>
                </div>
              ) : <div className="action-box completed"><span>Transaction Closed</span></div>}
            </div>
          )) : <EmptyState msg="No active sales or history." />}
        </div>
      </section>
    );
  };

  const PurchasesView = ({ items }) => {
    const totalSpent = items?.reduce((acc, curr) => acc + curr.price, 0) || 0;

    return (
      <section className="history-block fade-in">
        <div className="stats-banner blue-bg">
          <div className="stat-item">
            <div className="stat-label">Total Spent</div>
            <div className="stat-value">₹{totalSpent.toFixed(2)}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Orders Placed</div>
            <div className="stat-value">{items?.length || 0}</div>
          </div>
        </div>

        <div className="section-header">
          <ShoppingCart size={24} color="#C62828"/>
          <h3>My Purchases</h3>
        </div>

        <div className="history-grid">
          {items?.length > 0 ? items.map(item => (
            <div key={item._id} className="activity-card-wrapper">
              <div className="activity-card">
                <div className="activity-info">
                  <h4>{item.title}</h4>
                  <div className="meta-row">
                    <span className="meta-tag">Order ID: #{item._id.slice(-6).toUpperCase()}</span>
                    <span className="meta-tag">{formatDate(item.updatedAt)}</span>
                  </div>
                </div>
                <div className="price-column">
                  <span className="price-tag">₹{item.price}</span>
                  <button className="invoice-btn" onClick={() => generateBill(item)}>
                    <FileText size={14} /> Bill
                  </button>
                </div>
              </div>
              
              {/* LOGIC: Show Contact only if Paid AND Transaction NOT finished yet */}
              {item.status !== 'sold' && (
                <>
                  <div className="contact-reveal-box">
                    <div className="contact-row">
                      <User size={14} />
                      <span className="label">Seller Email:</span>
                      <span className="value">{item.seller?.email || "KLU Student"}</span>
                    </div>
                    
                    <div className="contact-row">
                      <Phone size={14} color="#166534" />
                      <span className="label">Call Seller:</span>
                      {item.sellerPhone ? (
                        <a href={`tel:${item.sellerPhone}`} className="value link" style={{color: '#166534'}}>
                          {item.sellerPhone}
                        </a>
                      ) : (
                        <span className="value" style={{color: '#999'}}>Not provided for this item</span>
                      )}
                    </div>

                    <div className="contact-instruction">
                      Call to arrange meetup at KLU Campus.
                    </div>
                  </div>

                  <div className="verification-display-box">
                    <div className="code-label"><Key size={14} /> Handover Code</div>
                    <div className="display-code">{item.verificationCode}</div>
                    <p>Show this to the seller ONLY after inspecting the item.</p>
                  </div>
                </>
              )}
            </div>
          )) : <EmptyState msg="No purchases made yet." />}
        </div>
      </section>
    );
  };

  const RidesView = ({ passengerRides, captainRides }) => {
    const rides = ridesTab === 'captain' ? captainRides : passengerRides;
    const isPassengerTab = ridesTab === 'passenger';
    const currentRoleKey = isPassengerTab ? 'passenger' : 'captain';
    const filteredRides = useMemo(() => rides.filter((ride) => {
      const status = String(ride?.status || '').toLowerCase();
      if (ridesStatusFilter === 'completed') return status === 'completed';
      if (ridesStatusFilter === 'cancelled') return status === 'cancelled';
      return true;
    }), [rides, ridesStatusFilter]);

    const dateFilteredRides = useMemo(() => {
      if (!ridesDateRange.from && !ridesDateRange.to) return filteredRides;

      return filteredRides.filter((ride) => {
        const sourceDate = ride?.createdAt || ride?.updatedAt || ride?.scheduledAt;
        if (!sourceDate) return false;

        const parsed = new Date(sourceDate);
        if (Number.isNaN(parsed.getTime())) return false;

        const localDate = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 10);

        if (ridesDateRange.from && localDate < ridesDateRange.from) return false;
        if (ridesDateRange.to && localDate > ridesDateRange.to) return false;
        return true;
      });
    }, [filteredRides, ridesDateRange.from, ridesDateRange.to]);

    const ridesSummary = useMemo(() => {
      const totalRides = dateFilteredRides.length;
      const completedRides = dateFilteredRides.filter((ride) => String(ride?.status || '').toLowerCase() === 'completed').length;
      const cancelledRides = dateFilteredRides.filter((ride) => String(ride?.status || '').toLowerCase() === 'cancelled').length;
      const totalAmount = dateFilteredRides.reduce((sum, ride) => {
        if (isPassengerTab) return sum + (Number(ride?.price) || 0);
        return sum + getCaptainSettlementAmount(ride);
      }, 0);

      return {
        totalRides,
        completedRides,
        cancelledRides,
        totalAmount
      };
    }, [dateFilteredRides]);

    const ridesTrend = useMemo(() => {
      const toLocalDate = (value) => {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      };

      const sumAmount = (list) => list.reduce((sum, ride) => sum + (Number(ride?.price) || 0), 0);
      const toMs = (ymd) => new Date(`${ymd}T00:00:00`).getTime();

      let previousWindowRides = [];

      if (ridesDateRange.from && ridesDateRange.to && ridesDateRange.from <= ridesDateRange.to) {
        const startMs = toMs(ridesDateRange.from);
        const endMs = toMs(ridesDateRange.to);
        const dayMs = 24 * 60 * 60 * 1000;
        const days = Math.max(1, Math.round((endMs - startMs) / dayMs) + 1);

        const prevEnd = new Date(startMs - dayMs);
        const prevStart = new Date(prevEnd.getTime() - (days - 1) * dayMs);
        const prevStartYmd = toLocalDate(prevStart);
        const prevEndYmd = toLocalDate(prevEnd);

        previousWindowRides = filteredRides.filter((ride) => {
          const sourceDate = ride?.createdAt || ride?.updatedAt || ride?.scheduledAt;
          const localDate = sourceDate ? toLocalDate(sourceDate) : null;
          if (!localDate || !prevStartYmd || !prevEndYmd) return false;
          return localDate >= prevStartYmd && localDate <= prevEndYmd;
        });
      } else {
        const now = new Date();
        const dayMs = 24 * 60 * 60 * 1000;
        const prevEnd = toLocalDate(new Date(now.getTime() - 7 * dayMs));
        const prevStart = toLocalDate(new Date(now.getTime() - 13 * dayMs));

        previousWindowRides = filteredRides.filter((ride) => {
          const sourceDate = ride?.createdAt || ride?.updatedAt || ride?.scheduledAt;
          const localDate = sourceDate ? toLocalDate(sourceDate) : null;
          if (!localDate || !prevStart || !prevEnd) return false;
          return localDate >= prevStart && localDate <= prevEnd;
        });
      }

      const currentCount = ridesSummary.totalRides;
      const previousCount = previousWindowRides.length;
      const currentAmount = ridesSummary.totalAmount;
      const previousAmount = sumAmount(previousWindowRides);

      const buildTrend = (currentValue, previousValue) => {
        const delta = currentValue - previousValue;
        const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
        const percent = previousValue > 0 ? Math.round((Math.abs(delta) / previousValue) * 100) : null;
        return { delta, direction, percent };
      };

      return {
        rides: buildTrend(currentCount, previousCount),
        amount: buildTrend(currentAmount, previousAmount)
      };
    }, [filteredRides, ridesDateRange.from, ridesDateRange.to, ridesSummary.totalAmount, ridesSummary.totalRides]);

    return (
    <section className="history-block fade-in">
       <div className="section-header">
        <Bike size={24} color="#003366"/>
        <h3>My Ride History</h3>
      </div>

      <div className="rides-tab-switch">
        <button
          className={ridesTab === 'passenger' ? 'active' : ''}
          onClick={() => setRidesTab('passenger')}
          type="button"
        >
          Passenger Rides ({passengerRides.length})
        </button>
        <button
          className={ridesTab === 'captain' ? 'active' : ''}
          onClick={() => setRidesTab('captain')}
          type="button"
        >
          Captain Rides ({captainRides.length})
        </button>
      </div>

      <div className="rides-filter-row">
        {[
          { key: 'all', label: 'All' },
          { key: 'completed', label: 'Completed' },
          { key: 'cancelled', label: 'Cancelled' }
        ].map((filter) => (
          <button
            key={filter.key}
            type="button"
            className={ridesStatusFilter === filter.key ? 'active' : ''}
            onClick={() => setRidesStatusFilter(filter.key)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="rides-date-filter-row">
        <div className="rides-date-filter">
          <CalendarDays size={15} />
          <span>From</span>
          <input
            type="date"
            value={ridesDateRange.from}
            onChange={(e) => setRidesDateRange((prev) => ({ ...prev, from: e.target.value }))}
            aria-label="Filter My Rides from date"
          />
        </div>

        <div className="rides-date-filter">
          <span>To</span>
          <input
            type="date"
            value={ridesDateRange.to}
            onChange={(e) => setRidesDateRange((prev) => ({ ...prev, to: e.target.value }))}
            aria-label="Filter My Rides to date"
          />
        </div>

        {(ridesDateRange.from || ridesDateRange.to) && (
          <button
            type="button"
            className="rides-date-clear"
            onClick={() => setRidesDateRange({ from: '', to: '' })}
          >
            Clear Range
          </button>
        )}
      </div>

      <div className="rides-summary-strip">
        <div className="rides-summary-card">
          <span>Total Rides</span>
          <strong>{ridesSummary.totalRides}</strong>
          <div className={`rides-summary-trend ${ridesTrend.rides.direction}`}>
            {ridesTrend.rides.direction === 'up' ? <TrendingUp size={12} /> : ridesTrend.rides.direction === 'down' ? <TrendingDown size={12} /> : <span className="dot" />}
            <small>
              {ridesTrend.rides.percent !== null
                ? `${ridesTrend.rides.percent}% vs previous period`
                : 'No previous-period baseline'}
            </small>
          </div>
        </div>
        <div className="rides-summary-card">
          <span>Completed</span>
          <strong>{ridesSummary.completedRides}</strong>
        </div>
        <div className="rides-summary-card">
          <span>Cancelled</span>
          <strong>{ridesSummary.cancelledRides}</strong>
        </div>
        <div className="rides-summary-card amount">
          <span>{isPassengerTab ? 'Total Spend' : 'Total Earnings'}</span>
          <strong>{formatCurrency(ridesSummary.totalAmount)}</strong>
          <div className={`rides-summary-trend ${ridesTrend.amount.direction}`}>
            {ridesTrend.amount.direction === 'up' ? <TrendingUp size={12} /> : ridesTrend.amount.direction === 'down' ? <TrendingDown size={12} /> : <span className="dot" />}
            <small>
              {ridesTrend.amount.percent !== null
                ? `${ridesTrend.amount.percent}% vs previous period`
                : 'No previous-period baseline'}
            </small>
          </div>
        </div>
      </div>

      <div className="history-grid">
        {dateFilteredRides?.length > 0 ? dateFilteredRides.map((ride) => (
          <div key={ride._id} className="activity-card-wrapper">
            <div className="activity-card">
              <div className="activity-info">
                <h4>{ride.route || 'Ride'}</h4>
                <div className="meta-row">
                  <span className="meta-tag"><Calendar size={12} /> {formatDate(ride.createdAt)}</span>
                  <span className="meta-tag">Type: {ride.type || '-'}</span>
                  <span className={`meta-tag ${isPassengerTab ? 'success' : ''}`}>{isPassengerTab ? 'Passenger' : 'Captain'}</span>
                </div>
              </div>
              <div className="price-column">
                <span className="price-tag">₹{ride.price || '-'}</span>
                <div className={`status-pill ${ride.status?.toLowerCase()}`}>{ride.status}</div>
              </div>
            </div>

            <div className="ride-history-actions">
              {isPassengerTab ? (
                <button className="small-btn primary" onClick={() => openRideRebook(ride)}>Rebook</button>
              ) : (
                <span className="ride-history-note">Rebook is available for passenger rides</span>
              )}
              {String(ride?.status || '').toLowerCase() === 'completed' && !(isPassengerTab ? ride?.passengerRating?.score : ride?.captainRating?.score) ? (
                <button
                  className="small-btn primary"
                  onClick={() => openRideRatingModal(ride, currentRoleKey)}
                >
                  <Star size={13} /> Rate Trip
                </button>
              ) : null}
              {String(ride?.status || '').toLowerCase() === 'completed' && (isPassengerTab ? ride?.passengerRating?.score : ride?.captainRating?.score) ? (
                <span className="ride-history-note rated">
                  Rated {isPassengerTab ? ride?.passengerRating?.score : ride?.captainRating?.score}/5
                </span>
              ) : null}
              <span>
                {ride?.pickupLocation?.address || 'Pickup unavailable'}
                {' ➔ '}
                {ride?.dropLocation?.address || 'Drop unavailable'}
              </span>
              {String(ride?.status || '').toLowerCase() === 'cancelled' && ride?.cancellationReason ? (
                <span className="ride-cancel-reason">Reason: {ride.cancellationReason}</span>
              ) : null}

              {(() => {
                const rideStatus = String(ride?.status || '').toLowerCase();
                const disputeStatus = String(ride?.dispute?.status || 'none').toLowerCase();
                const canRaiseDispute = ['paid', 'completed', 'cancelled'].includes(rideStatus)
                  && !['open', 'in_review'].includes(disputeStatus);

                if (!canRaiseDispute && disputeStatus === 'none') return null;

                if (canRaiseDispute) {
                  return (
                    <button
                      type="button"
                      className="small-btn primary"
                      onClick={() => raiseRideDispute(ride)}
                    >
                      Raise Dispute
                    </button>
                  );
                }

                return (
                  <span className={`ride-dispute-pill ${disputeStatus}`}>
                    Dispute: {disputeStatus}
                  </span>
                );
              })()}

              {(() => {
                const settlement = getRideSettlement(ride);
                const hasSettlement = Boolean(
                  settlement && (
                    Number.isFinite(Number(settlement?.adminEscrowAmount)) ||
                    Number.isFinite(Number(settlement?.platformFeeAmount)) ||
                    Number.isFinite(Number(settlement?.captainPayoutAmount)) ||
                    settlement?.adminEscrowCreditedAt ||
                    settlement?.captainPaidAt
                  )
                );

                if (!hasSettlement) return null;

                return (
                  <div className="ride-settlement-box">
                    <span className="ride-settlement-title">Settlement</span>
                    <div className="ride-settlement-grid">
                      <span className="ride-settlement-chip">Escrow: {formatCurrency(settlement?.adminEscrowAmount ?? ride?.price)}</span>
                      <span className="ride-settlement-chip">Platform Fee: {formatCurrency(settlement?.platformFeeAmount ?? ((Number(ride?.price) || 0) * 0.10))}</span>
                      <span className="ride-settlement-chip success">Captain Payout: {formatCurrency(settlement?.captainPayoutAmount ?? getCaptainSettlementAmount(ride))}</span>
                      <span className="ride-settlement-chip">Escrow Credited: {formatDate(settlement?.adminEscrowCreditedAt)}</span>
                      <span className="ride-settlement-chip">Captain Paid: {settlement?.captainPaidAt ? formatDate(settlement.captainPaidAt) : 'Pending'}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )) : <EmptyState msg={(ridesDateRange.from || ridesDateRange.to) ? 'No rides found for selected date range.' : (isPassengerTab ? 'No passenger rides for this filter.' : 'No captain rides for this filter.')} />}
      </div>
    </section>
    );
  };

  const BookingsView = ({ bookings }) => (
    <section className="history-block fade-in">
      <div className="section-header">
        <Home size={24} color="#003366"/>
        <h3>Unlocked Properties</h3>
      </div>
      <div className="history-grid">
        {bookings?.length > 0 ? bookings.map(house => (
          <div key={house._id} className="activity-card-wrapper">
            <ActivityCard key={house._id} title={house.title} price={house.rent} status="Unlocked" />
            
            <div className="contact-reveal-box" style={{backgroundColor: '#f0fdf4', borderColor: '#bbf7d0'}}>
              <div className="contact-row">
                <User size={14} color="#166534"/>
                <span className="label">Owner:</span>
                <span className="value" style={{color: '#166534'}}>{house.ownerName}</span>
              </div>
              <div className="contact-row">
                <Phone size={14} color="#166534"/>
                <span className="label">Phone:</span>
                <a href={`tel:${house.ownerPhone}`} className="value link" style={{color: '#166534', fontWeight:'bold'}}>
                  {house.ownerPhone}
                </a>
              </div>
            </div>
          </div>
        )) : <EmptyState msg="No properties unlocked." />}
      </div>
    </section>
  );

  if (loading) return <div className="loader-container"><div className="loader"></div></div>;

  return (
    <div className="profile-container">
      <header className="profile-header">
        <h1>{activeModule} Management</h1>
        <p>Welcome, {userData?.email?.split('@')[0]}</p>
      </header>

      {/* --- USER & WALLET OVERVIEW CARD --- */}
      <div className="user-overview-card">
        <div className="user-details-left">
          <div className="big-avatar">{userData?.email?.[0].toUpperCase()}</div>
          <div>
            <h3>{userData?.email}</h3>
            <span className="role-badge">{userData?.roles?.join(' & ')}</span>
            <div className="profile-phone-editor">
              <input
                type="tel"
                value={phoneDraft}
                placeholder="Add phone for ride contact"
                onChange={(e) => setPhoneDraft(e.target.value)}
              />
              <button className="small-btn primary" onClick={handleUpdatePhone} disabled={savingPhone}>
                {savingPhone ? 'Saving...' : 'Save Phone'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Wallet Component Injection */}
        <div className="wallet-section-right">
          <WalletSetup user={userData} />
        </div>
      </div>
      {/* ----------------------------------- */}

      <div className="history-sections">
        {activeModule === 'Items' && history && (
          <>
            {profileSection === 'listings' && <ListingsView items={history.listings} />}
            {profileSection === 'purchases' && <PurchasesView items={history.purchases} />}
            {profileSection === 'sales' && <SalesView items={history.listings} />}
            {profileSection === 'wishlist' && <WishlistView />}
          </>
        )}

        {activeModule === 'Ride' && history && (
          <RidesView
            passengerRides={history.asPassenger || []}
            captainRides={history.asCaptain || []}
          />
        )}

        {activeModule === 'Home Renting' && history && (
          <BookingsView bookings={history.bookings} />
        )}
      </div>

      {verifyingItem && (
        <VerificationModal 
          type="item" id={verifyingItem._id} title={verifyingItem.title} amount={verifyingItem.price}
          onClose={() => setVerifyingItem(null)}
          onSuccess={() => { setVerifyingItem(null); fetchData(); }}
        />
      )}

      {editingItem && (
        <EditItemModal 
          item={editingItem} 
          onClose={() => setEditingItem(null)} 
          onSuccess={() => { setEditingItem(null); fetchData(); }} 
        />
      )}

      {ratingRide && (
        <div className="ride-rating-overlay" role="dialog" aria-modal="true" aria-label="Rate completed ride">
          <div className="ride-rating-modal">
            <h3>Rate This Ride</h3>
            <p>{ratingRide?.route || 'Ride'}</p>

            <div className="ride-rating-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={star <= ratingScore ? 'active' : ''}
                  onClick={() => setRatingScore(star)}
                >
                  <Star size={16} />
                </button>
              ))}
            </div>

            <textarea
              value={ratingReview}
              onChange={(e) => setRatingReview(e.target.value)}
              maxLength={280}
              placeholder="Share quick feedback (optional)"
            />

            <div className="ride-rating-actions">
              <button type="button" onClick={() => setRatingRide(null)}>Cancel</button>
              <button type="button" className="primary" onClick={submitRideRating} disabled={ratingSubmitting}>
                {ratingSubmitting ? 'Submitting...' : `Submit ${ratingAsRole === 'captain' ? 'Captain' : 'Passenger'} Rating`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// UI Helpers
const ActivityCard = ({ title, price, status }) => (
  <div className="activity-card">
    <div className="activity-info">
      <h4>{title}</h4>
      <span className="price-tag">₹{price}</span>
    </div>
    <div className={`status-pill ${status?.toLowerCase()}`}>{status}</div>
  </div>
);

const EmptyState = ({ msg }) => (<div className="empty-msg-box">{msg}</div>);

export default ProfilePage;