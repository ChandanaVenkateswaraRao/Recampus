import React, { createContext, useState, useContext } from 'react';

const ModuleContext = createContext();

export const ModuleProvider = ({ children }) => {
  // 1. Module state (Items, Ride, or Home Renting)
  const [activeModule, setActiveModule] = useState('Items');
  
  // 2. View state (Are we browsing the list or looking at our profile?)
  const [currentView, setCurrentView] = useState('browse'); 
  
  // 3. Ride role (Passenger or Captain)
  const [rideRole, setRideRole] = useState('passenger');

  return (
    <ModuleContext.Provider value={{ 
      activeModule, 
      setActiveModule, 
      currentView, 
      setCurrentView, 
      rideRole, 
      setRideRole 
    }}>
      {children}
    </ModuleContext.Provider>
  );
};

export const useModule = () => useContext(ModuleContext);