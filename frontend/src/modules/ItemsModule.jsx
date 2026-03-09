import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useModule } from '../context/ModuleContext.jsx'; 
import { fetchItems, initiatePurchase } from '../api/itemApi';
import SellItemForm from '../components/items/SellItemForm';
import ItemCard from '../components/items/ItemCard';
import PurchaseModal from '../components/items/PurchaseModal'; // For INR OTP
import ItemDetailModal from '../components/items/ItemDetailModal';
import PaymentStatusModal from '../components/items/PaymentStatusModal'; // For Crypto Status
import PaymentGateway from '../components/items/PaymentGateway'; // Professional INR Simulator
import { 
  Plus, PlusCircle, ShoppingBag, Search, Filter, Loader2, PackageOpen, X, 
  BookOpen, Laptop, Beaker, Armchair, Shirt, ChevronRight 
} from 'lucide-react';
import './Items.css'; 
import { sendEthToSeller } from '../utils/web3Config';

const ItemsModule = () => {
  // 1. Get State from Global Context
  const { 
    filterCategory, setFilterCategory, 
    isCategoryView, setIsCategoryView 
  } = useModule();

  // 2. Local State
  const [view, setView] = useState('browse');
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // --- NEW: INFINITE SCROLL STATE ---
  const [visibleCount, setVisibleCount] = useState(10); 
  
  // Modals & Selection State
  const [purchaseResult, setPurchaseResult] = useState(null); // For INR Success
  const [selectedItem, setSelectedItem] = useState(null);     // Item Details
  const [showGateway, setShowGateway] = useState(false);      // INR Gateway
  const [gatewayItem, setGatewayItem] = useState(null);       // Item being bought via INR

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [sortBy, setSortBy] = useState('newest');

  // Crypto Payment State
  const [payStatus, setPayStatus] = useState('idle'); 
  const [currentTxHash, setCurrentTxHash] = useState('');
  const [finalOtp, setFinalOtp] = useState('');

  // ADMIN ADDRESS (Replace with your actual public address)
  const ADMIN_WALLET_ADDRESS = "0x204Bc3FA7dc25ed12C12070f010464EdfCcd79AE";

  const categoriesList = [
    { name: 'Books', icon: <BookOpen size={32} />, color: '#e0f2fe', text: '#0369a1' },
    { name: 'Electronics', icon: <Laptop size={32} />, color: '#f3e8ff', text: '#7e22ce' },
    { name: 'Lab Gear', icon: <Beaker size={32} />, color: '#dcfce7', text: '#15803d' },
    { name: 'Furniture', icon: <Armchair size={32} />, color: '#ffedd5', text: '#c2410c' },
    { name: 'Clothing', icon: <Shirt size={32} />, color: '#fce7f3', text: '#be185d' },
    { name: 'Other', icon: <PackageOpen size={32} />, color: '#f1f5f9', text: '#475569' },
  ];

  // --- DATA LOADING ---
  useEffect(() => {
    if (view === 'browse') loadItems();
  }, [view]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const res = await fetchItems();
      setItems(res.data);
      setFilteredItems(res.data);
    } catch (err) { 
      console.error("Failed to load items"); 
    } finally {
      setLoading(false);
    }
  };

  // --- FILTERING LOGIC ---
  useEffect(() => {
    let results = items;

    if (filterCategory !== 'All') {
      results = results.filter(item => item.category === filterCategory);
    }

    if (searchTerm) {
      results = results.filter(item => 
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (sortBy === 'price-low') {
      results.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high') {
      results.sort((a, b) => b.price - a.price);
    } else {
      // Assuming API returns oldest first, reverse for newest
      results = [...results].reverse(); 
    }

    setFilteredItems(results);
    
    // Reset Infinite Scroll to top when filters change
    setVisibleCount(10); 
  }, [searchTerm, items, filterCategory, sortBy]);

  // --- INFINITE SCROLL LISTENER ---
  useEffect(() => {
    const handleScroll = () => {
      // If user scrolls within 200px of the bottom, load 10 more items
      if (window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 200) {
        setVisibleCount((prevCount) => prevCount + 10); 
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll); 
  }, []);


  // --- BUYING LOGIC ---
  
  // 1. Main Entry Point
  const handleBuy = async (item) => {
    // If Detail modal is open, close it
    setSelectedItem(null);

    const paymentMethod = window.prompt("Type 'ETH' for Crypto, or 'INR' for UPI/Card", "INR");

    if (paymentMethod?.toUpperCase() === 'ETH') {
      handleCryptoPayment(item);
    } else {
      // Open Professional INR Gateway
      setGatewayItem(item);
      setShowGateway(true);
    }
  };

  // 2. Crypto Logic
  const handleCryptoPayment = async (item) => {
    // A. Verify Seller has Wallet
    let sellerWallet = item.seller?.cryptoWalletAddress;
    let sellerId = typeof item.seller === 'string' ? item.seller : item.seller._id;

    if (!sellerWallet) {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`https://recampus-backend.onrender.com/api/auth/get-wallet/${sellerId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        sellerWallet = res.data.wallet;
      } catch (err) {
        console.error("Could not fetch seller wallet");
      }
    }

    if (!sellerWallet) {
      alert("This seller has not linked a Crypto Wallet yet. Please pay via INR.");
      return;
    }

    const confirmMsg = `Pay ₹${item.price} to Recampus Escrow?`;
    if (!window.confirm(confirmMsg)) return;

    // B. Start UI Flow
    setPayStatus('waiting_wallet'); 

    // C. Send ETH to Admin
    const result = await sendEthToSeller(ADMIN_WALLET_ADDRESS, item.price);

    if (result && result.success) {
      setPayStatus('mining');
      setCurrentTxHash(result.hash);

      // D. Update Backend
      try {
        const token = localStorage.getItem('token');
        const backendRes = await axios.post('https://recampus-backend.onrender.com/api/items/buy-crypto', {
          itemId: item._id,
          txHash: result.hash
        }, { headers: { Authorization: `Bearer ${token}` } });

        setFinalOtp(backendRes.data.code);
        setPayStatus('success'); 
        loadItems(); 
      } catch (err) {
        console.error("Backend Sync Error:", err);
        setPayStatus('failed');
        alert("Database update failed. Contact Admin with Hash: " + result.hash);
      }
    } else {
      setPayStatus('idle'); // Closed or Rejected
    }
  };

  // 3. INR Logic (Callback from PaymentGateway)
  const handleGatewaySuccess = async () => {
    setShowGateway(false);
    try {
      const res = await initiatePurchase(gatewayItem._id);
      setPurchaseResult({ item: gatewayItem, code: res.data.code });
      loadItems();
    } catch (err) { 
      alert("Server error finalizing purchase."); 
    }
  };

  const handleCategorySelect = (catName) => {
    setFilterCategory(catName);
    setIsCategoryView(false); 
  };

  // --- RENDER 1: CATEGORY SELECTION PAGE ---
  if (isCategoryView && view === 'browse') {
    return (
      <div className="items-module-container fade-in">
        <header className="marketplace-header">
          <div className="header-text">
            <h1>Browse Categories</h1>
            <p>Select a category to filter resources</p>
          </div>
          <button className="toggle-btn" onClick={() => setIsCategoryView(false)}>
            <ShoppingBag size={16} /> Back to Items
          </button>
        </header>

        <div className="category-selection-grid">
          {categoriesList.map(cat => (
            <button 
              key={cat.name} 
              className="cat-big-card"
              style={{ background: cat.color, color: cat.text }}
              onClick={() => handleCategorySelect(cat.name)}
            >
              {cat.icon}
              <h3>{cat.name}</h3>
              <ChevronRight className="cat-arrow" />
            </button>
          ))}
          <button 
            className="cat-big-card"
            style={{ background: '#f8fafc', color: '#334155', border: '2px dashed #cbd5e1' }}
            onClick={() => handleCategorySelect('All')}
          >
            <ShoppingBag size={32} />
            <h3>View All</h3>
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER 2: MAIN ITEM GRID & DASHBOARD ---
  return (
    <div className="items-module-container">
      {/* Header */}
      <header className="marketplace-header">
        <div className="header-text">
          <h1>Student Marketplace</h1>
          <p>Buy & Sell resources within KLU Campus</p>
        </div>
        <div className="view-toggle">
          <button className={`toggle-btn ${view === 'browse' ? 'active' : ''}`} onClick={() => setView('browse')}>
            <ShoppingBag size={16} /> Browse
          </button>
          <button className={`toggle-btn ${view === 'sell' ? 'active' : ''}`} onClick={() => setView('sell')}>
            <PlusCircle size={16} /> Sell Item
          </button>
        </div>
      </header>

      <div className="marketplace-content">
        {view === 'sell' ? (
          <div className="fade-in">
            <SellItemForm onSuccess={() => setView('browse')} />
          </div>
        ) : (
          <>
            {/* Search & Filter Bar */}
            <div className="search-bar-container">
              <div className="search-input-wrapper">
                <Search size={18} className="search-icon" />
                <input 
                  type="text" 
                  placeholder={`Search in ${filterCategory === 'All' ? 'all items' : filterCategory}...`} 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="filter-wrapper">
                <button 
                  className={`filter-btn-static ${showFilterMenu ? 'active' : ''}`}
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                >
                  <Filter size={18} /> Filters {filterCategory !== 'All' && <span className="dot"></span>}
                </button>

                {/* Filter Dropdown */}
                {showFilterMenu && (
                  <div className="filter-dropdown fade-in">
                    <div className="filter-header">
                      <span>Filter & Sort</span>
                      <button onClick={() => setShowFilterMenu(false)}><X size={16}/></button>
                    </div>
                    <div className="filter-group">
                      <label>Category</label>
                      <div className="chip-grid">
                        {['All', ...categoriesList.map(c => c.name)].map(cat => (
                          <button 
                            key={cat} 
                            className={`filter-chip ${filterCategory === cat ? 'selected' : ''}`}
                            onClick={() => setFilterCategory(cat)}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="filter-group">
                      <label>Sort By</label>
                      <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
                        <option value="newest">Newest Listed</option>
                        <option value="price-low">Price: Low to High</option>
                        <option value="price-high">Price: High to Low</option>
                      </select>
                    </div>
                    <div className="filter-actions">
                      <button className="clear-link" onClick={() => { setFilterCategory('All'); setSortBy('newest'); setSearchTerm(''); }}>Reset All</button>
                      <button className="apply-btn" onClick={() => setShowFilterMenu(false)}>Done</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Active Filter Chip */}
              {filterCategory !== 'All' && (
                <div className="active-filter-badge">
                  <span>{filterCategory}</span>
                  <button onClick={() => setFilterCategory('All')}><X size={14}/></button>
                </div>
              )}
            </div>

            {/* Content Grid */}
            {loading ? (
              <div className="loader-state"><Loader2 className="spin" size={40} color="#003366" /><p>Loading products...</p></div>
            ) : filteredItems.length === 0 ? (
              <div className="empty-state">
                <PackageOpen size={48} />
                <h3>No items found</h3>
                <p>Try clearing filters or search terms.</p>
                <button onClick={() => { setFilterCategory('All'); setSearchTerm(''); }} className="cta-link">Clear Filters</button>
              </div>
            ) : (
              <>
                <div className="item-grid fade-in">
                  {/* SLICE ARRAY FOR INFINITE SCROLL */}
                  {filteredItems.slice(0, visibleCount).map(item => (
                    <ItemCard 
                      key={item._id} item={item} 
                      onBuy={handleBuy} 
                      onView={(item) => setSelectedItem(item)} 
                    />
                  ))}
                </div>
                
                {/* Scroll Loader */}
                {visibleCount < filteredItems.length && (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    <Loader2 className="spin" size={24} style={{ display: 'inline-block' }}/>
                    <p style={{ margin: '5px 0 0', fontSize: '0.85rem' }}>Loading more items...</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Floating Action Button */}
      {view === 'browse' && (
        <button className="floating-sell-btn" onClick={() => setView('sell')} title="List New Item">
          <Plus size={28} />
        </button>
      )}

      {/* --- ALL MODALS --- */}

      {/* 1. Item Detail (View Mode) */}
      {selectedItem && (
        <ItemDetailModal 
          item={selectedItem} 
          onClose={() => setSelectedItem(null)} 
          onBuy={handleBuy} // Passes click back to main handler
          onSwitchItem={(newItem) => setSelectedItem(newItem)}
        />
      )}

      {/* 2. Crypto Payment Status */}
      <PaymentStatusModal 
        status={payStatus}
        txHash={currentTxHash}
        otp={finalOtp}
        onClose={() => setPayStatus('idle')}
      />

      {/* 3. INR Payment Gateway Simulator */}
      {showGateway && gatewayItem && (
        <PaymentGateway 
          item={gatewayItem}
          onClose={() => setShowGateway(false)}
          onSuccess={handleGatewaySuccess}
        />
      )}

      {/* 4. INR Success & OTP Display */}
      {purchaseResult && (
        <PurchaseModal 
          item={purchaseResult.item} 
          code={purchaseResult.code} 
          onClose={() => setPurchaseResult(null)} 
        />
      )}
    </div>
  );
};

export default ItemsModule;