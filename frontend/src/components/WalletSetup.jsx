import React, { useState } from 'react';
import { connectWallet } from '../utils/web3Config';
import axios from 'axios';
import { Wallet } from 'lucide-react';

const WalletSetup = ({ user }) => {
  const [wallet, setWallet] = useState(user?.cryptoWalletAddress || '');

  const handleConnect = async () => {
    const data = await connectWallet();
    if (data) {
      setWallet(data.address);
      saveToBackend(data.address);
    }
  };

  const saveToBackend = async (address) => {
    try {
      const token = localStorage.getItem('token');
      // You need to create this route in backend
      await axios.patch('http://localhost:5000/api/auth/update-wallet', 
        { walletAddress: address }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Wallet linked successfully!");
    } catch (err) {
      alert("Failed to save wallet address.");
    }
  };

  return (
    <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '12px', marginTop: '20px' }}>
      <h3><Wallet size={18} /> Crypto Settings</h3>
      <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
        Connect MetaMask to receive payments in ETH.
      </p>
      
      {wallet ? (
        <div style={{ background: '#dcfce7', padding: '10px', borderRadius: '8px', color: '#166534', marginTop: '10px', fontSize: '0.8rem', wordBreak: 'break-all' }}>
          <strong>Connected:</strong> {wallet}
        </div>
      ) : (
        <button 
          onClick={handleConnect}
          style={{ marginTop: '10px', background: '#f6851b', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Connect MetaMask
        </button>
      )}
    </div>
  );
};

export default WalletSetup;