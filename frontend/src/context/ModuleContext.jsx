import React, { createContext, useState, useContext } from 'react';

const ModuleContext = createContext();

export const ModuleProvider = ({ children }) => {
  const [activeModule, setActiveModule] = useState('Items');
  const [currentView, setCurrentView] = useState('browse'); 
  const [rideRole, setRideRole] = useState('passenger');
  
  // Filter states
  const [filterCategory, setFilterCategory] = useState('All'); 
  const [isCategoryView, setIsCategoryView] = useState(false);

  // --- NEW: Profile Section State ---
  // Options: 'listings', 'sales', 'purchases', 'rides', 'bookings'
  const [profileSection, setProfileSection] = useState('listings'); 

  return (
    <ModuleContext.Provider value={{ 
      activeModule, setActiveModule, 
      currentView, setCurrentView, 
      rideRole, setRideRole,
      filterCategory, setFilterCategory,
      isCategoryView, setIsCategoryView,
      profileSection, setProfileSection // <--- Export these
    }}>
      {children}
    </ModuleContext.Provider>
  );
};


export const useModule = () => {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error('useModule must be used within a ModuleProvider');
  }
  return context;
};