import React, { useState, useEffect } from 'react';
import { useModule } from '../context/ModuleContext.jsx';
import axios from 'axios';
import EditItemModal from '../components/items/EditItemModal.jsx';
import { Eye, Trash2, Edit, Store } from 'lucide-react'; // Add these icons

import { 
  Package, Bike, Home, CheckCircle, ShieldAlert, Key, 
  ShoppingCart, Loader2, FileText, Calendar, TrendingUp,
  User, Phone, Wallet
} from 'lucide-react';
import VerificationModal from '../components/shared/VerificationModal.jsx';
import WalletSetup from '../components/WalletSetup.jsx'; // Import Wallet Component
import './Profile.css';
import ItemCard from '../components/items/ItemCard'; 
import { Heart } from 'lucide-react';
const ProfilePage = () => {
  const { activeModule, profileSection } = useModule();
  const [history, setHistory] = useState(null);
  const [userData, setUserData] = useState(null); // Store user data for Wallet/Avatar
  const [loading, setLoading] = useState(true);
  const [verifyingItem, setVerifyingItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  useEffect(() => {
    fetchData();
  }, [activeModule]);

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
  // --- UTILITY: Date Formatter ---
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
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

  const RidesView = ({ rides }) => (
    <section className="history-block fade-in">
       <div className="section-header">
        <Bike size={24} color="#003366"/>
        <h3>My Ride History</h3>
      </div>
      <div className="history-grid">
        {rides?.length > 0 ? rides.map(ride => (
          <ActivityCard key={ride._id} title={ride.route} price={ride.price} status={ride.status} />
        )) : <EmptyState msg="No rides taken yet." />}
      </div>
    </section>
  );

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
          <RidesView rides={history.asPassenger} />
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