import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ModuleProvider, useModule } from './context/ModuleContext.jsx';
import PrimaryNav from './components/PrimaryNav.jsx';
import SecondaryNav from './components/SecondaryNav.jsx';
import Auth from './components/Auth.jsx';
import ProfilePage from './modules/ProfilePage.jsx'; 
import ItemsModule from './modules/ItemsModule.jsx';
import RideModule from './modules/RideModule.jsx';
import HomeModule from './modules/HomeModule.jsx';

/**
 * AppContent: This component handles the conditional rendering 
 * based on the global state provided by ModuleProvider.
 */
const AppContent = ({ user, handleLogout }) => {
  const { activeModule, currentView, setCurrentView } = useModule(); 

  // EFFECT: Reset to 'browse' view whenever the user changes the module 
  // (e.g., switching from Items to Ride). This prevents getting "stuck" in Profile view.
  useEffect(() => {
    setCurrentView('browse');
  }, [activeModule, setCurrentView]);

  return (
    <div className="app-shell">
      {/* 1st Navbar: Global Module Selector */}
      <PrimaryNav user={user} onLogout={handleLogout} />
      
      {/* 2nd Navbar: Context-Specific Links */}
      <SecondaryNav />
      
      <main className="content-area">
        {/* Conditional Rendering Logic */}
        {currentView === 'profile' ? (
          <ProfilePage />
        ) : (
          <div className="module-container">
            {activeModule === 'Items' && <ItemsModule />}
            {activeModule === 'Ride' && <RideModule user={user} />} 
            {activeModule === 'Home Renting' && <HomeModule />}
          </div>
        )}
      </main>
    </div>
  );
};

/**
 * Main App Component: Handles Authentication, User Loading, and Global Context.
 */
function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(!!token); 

  useEffect(() => {
    const fetchUser = async () => {
      // If we have a token but no user object, fetch it from the API
      if (token && !user) {
        try {
          const res = await axios.get('https://recampus-backend.onrender.com/api/auth/profile', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(res.data);
        } catch (err) {
          console.error("Session expired or API down");
          handleLogout();
        } finally {
          setLoading(false);
        }
      } else if (!token) {
        setLoading(false);
      }
    };
    fetchUser();
  }, [token, user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setLoading(false);
  };

  // 1. Loading Screen
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Connecting to Recampus...</p>
      </div>
    );
  }

  // 2. Auth Screen (Login/Register)
  if (!token) {
    return <Auth setToken={setToken} setUser={setUser} />;
  }

  // 3. Main Dashboard (Wrapped in ModuleProvider to share state)
  return (
    <ModuleProvider>
      <AppContent user={user} handleLogout={handleLogout} />
    </ModuleProvider>
  );
}

export default App;