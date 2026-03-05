import React from 'react';
import { useModule } from '../context/ModuleContext.jsx';
import './Navbars.css';

const SecondaryNav = () => {
  const { 
    activeModule, rideRole, setRideRole,
    setCurrentView, currentView, 
    setProfileSection, profileSection, // Get these
    setIsCategoryView, setFilterCategory
  } = useModule();

  const handleNavClick = (linkName) => {
    // 1. ITEMS MODULE LINKS
    if (linkName === 'My Listings') {
      setProfileSection('listings');
      setCurrentView('profile');
      setIsCategoryView(false);
    } 
    else if (linkName === 'My Purchases') {
      setProfileSection('purchases');
      setCurrentView('profile');
      setIsCategoryView(false);
    }
    else if (linkName === 'My Sales') {
      setProfileSection('sales');
      setCurrentView('profile');
      setIsCategoryView(false);
    }
    // 2. RIDE MODULE LINKS
    else if (linkName === 'My Rides') {
      setProfileSection('rides');
      setCurrentView('profile');
    }
    // 3. HOME MODULE LINKS
    else if (linkName === 'My Bookings') {
      setProfileSection('bookings');
      setCurrentView('profile');
    }
    // 4. BROWSE / CATEGORIES (Reset)
    else if (linkName === 'Browse') {
      setCurrentView('browse');
      setIsCategoryView(false);
      setFilterCategory('All');
    }
    else if (linkName === 'Categories') {
      setCurrentView('browse');
      setIsCategoryView(true);
    }
    else if (linkName === 'My Wishlist') {
      setProfileSection('wishlist'); // New section
      setCurrentView('profile');
      setIsCategoryView(false);
    }
    else {
      setCurrentView('browse');
    }
  };

  // Helper to check active state for styling
  const isActive = (link) => {
    if (currentView === 'browse' && link === 'Browse') return true;
    if (currentView === 'profile') {
      if (link === 'My Listings' && profileSection === 'listings') return true;
      if (link === 'My Purchases' && profileSection === 'purchases') return true;
      if (link === 'My Sales' && profileSection === 'sales') return true;
      if (link === 'My Rides' && profileSection === 'rides') return true;
      if (link === 'My Bookings' && profileSection === 'bookings') return true;
    }
    return false;
  };

  const renderContent = () => {
    switch (activeModule) {
      case 'Items':
        return ['Browse','My Wishlist', 'My Listings',  'My Purchases', 'My Sales'].map(l => (
          <button 
            key={l} 
            className={`sec-link-btn ${isActive(l) ? 'active' : ''}`}
            onClick={() => handleNavClick(l)}
          >
            {l}
          </button>
        ));
      
      case 'Ride':
        return (
          <div className="ride-nav-content">
            <div className="role-toggle-group">
              <button className={`role-btn ${rideRole === 'passenger' ? 'active' : ''}`} onClick={() => setRideRole('passenger')}>Passenger</button>
              <button className={`role-btn ${rideRole === 'captain' ? 'active' : ''}`} onClick={() => setRideRole('captain')}>Be a Captain</button>
            </div>
            <div className="ride-links">
              {['On-Spot Routes', 'Pre-Booking'].map(l => (
                <button key={l} className={`sec-link-btn ${isActive(l) ? 'active' : ''}`} onClick={() => handleNavClick(l)}>{l}</button>
              ))}

              <button className={`sec-link-btn ${isActive('My Rides') ? 'active' : ''}`} onClick={() => handleNavClick('My Rides')}>
                My Rides
              </button>
            </div>
          </div>
        );

      case 'Home Renting':
        return ['Browse Homes', 'My Bookings'].map(l => (
          <button key={l} className={`sec-link-btn ${isActive(l) ? 'active' : ''}`} onClick={() => handleNavClick(l)}>{l}</button>
        ));
      
      default: return null;
    }
  };

  return (
    <nav className="secondary-nav">
      <div className="nav-container">{renderContent()}</div>
    </nav>
  );
};

export default SecondaryNav;