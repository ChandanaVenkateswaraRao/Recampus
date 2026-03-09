import React from 'react';
import { useModule } from '../context/ModuleContext.jsx';
import { Wallet, LogOut } from 'lucide-react';
import './Navbars.css';
import {  Bell } from 'lucide-react'; // Import Bell
import { io } from 'socket.io-client'; // Import Socket Client
import { useState, useEffect } from 'react';
const PrimaryNav = ({ user, onLogout }) => {
  const { activeModule, setActiveModule, setCurrentView } = useModule();

  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    if (!user?._id && !user?.id) return;

    // 1. Fetch old notifications from DB (You will need a quick route for this: GET /api/auth/notifications)
    // For now, we will just handle live ones for the demo.

    // 2. Connect to Socket Server
    const socket = io('https://recampus-backend.onrender.com/', {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      timeout: 20000,
      withCredentials: true
    });
    
    // 3. Tell the server exactly who we are
    socket.emit('register', user.id || user._id);

    // 4. LISTEN for the 'new_notification' event
    socket.on('new_notification', (newNotif) => {
      // Play a tiny "ding" sound (optional but cool)
      // new Audio('/ding.mp3').play().catch(e => {}); 
      
      setNotifications(prev => [newNotif, ...prev]);
    });

    // Cleanup on unmount
    return () => socket.disconnect();
  }, [user?._id, user?.id]);


  const markAsRead = () => {
    setShowNotifs(!showNotifs);
    if (!showNotifs && unreadCount > 0) {
      // Mark all as read locally
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      // Note: You would also send an API call to mark them read in MongoDB here
    }
  };

  return (
    <nav className="primary-nav">
      <div className="nav-container">
        {/* 1. Logo - Resets to Browse */}
        <div 
          className="logo" 
          onClick={() => { setActiveModule('Items'); setCurrentView('browse'); }}
          title="Back to Home"
        >
          RE<span>CAMPUS</span>
        </div>

        {/* 2. Global Module Switcher */}
        <div className="module-switcher">
          {['Items', 'Ride', 'Home Renting'].map((mod) => (
            <button 
              key={mod}
              className={activeModule === mod ? 'active' : ''} 
              onClick={() => {
                setActiveModule(mod);
                setCurrentView('browse'); 
              }}
            >
              {mod}
            </button>
          ))}
        </div>

        {/* 3. Right Side: Profile Trigger & Logout */}
        <div className="nav-right-group">
          
          <div className="notification-wrapper">
            <button className="nav-icon-btn" onClick={markAsRead}>
              <Bell size={20} />
              {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
            </button>

            {showNotifs && (
              <div className="notif-dropdown fade-in">
                <h4>Notifications</h4>
                <div className="notif-list">
                  {notifications.length === 0 ? (
                    <p className="no-notifs">No new notifications</p>
                  ) : (
                    notifications.map((n, i) => (
                      <div key={i} className={`notif-item ${!n.isRead ? 'unread' : ''}`}>
                        {n.message}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Button - Goes directly to Profile Page */}
          <div 
            className="profile-direct-btn" 
            onClick={() => setCurrentView('profile')}
            title="Go to My Profile"
          >
            <div className="wallet-preview">
              <Wallet size={16} />
              <span>₹{user?.walletBalance?.toFixed(2) || "0.00"}</span>
            </div>
            
            <div className="user-info">
              <span className="email-text">{user?.email?.split('@')[0]}</span>
              <div className="avatar">{user?.email?.[0].toUpperCase() || "U"}</div>
            </div>
          </div>

          {/* Separate Logout Button */}
          <button className="nav-logout-btn" onClick={onLogout} title="Logout">
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default PrimaryNav;  