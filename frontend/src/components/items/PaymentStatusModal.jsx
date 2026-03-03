import React from 'react';
import { Loader2, CheckCircle, XCircle, Wallet, ArrowRight } from 'lucide-react';
import './PaymentStatus.css';

const PaymentStatusModal = ({ status, txHash, otp, onClose }) => {
  if (status === 'idle') return null;

  return (
    <div className="payment-modal-overlay">
      <div className="payment-modal-content">
        
        {/* STEP 1: WAITING FOR WALLET */}
        {status === 'waiting_wallet' && (
          <div className="status-step">
            <div className="icon-pulse"><Wallet size={40} color="#003366" /></div>
            <h3>Confirm in Wallet</h3>
            <p>Please approve the transaction in your MetaMask extension.</p>
            <div className="progress-bar"><div className="fill" style={{width: '30%'}}></div></div>
          </div>
        )}

        {/* STEP 2: MINING (Blockchain processing) */}
        {status === 'mining' && (
          <div className="status-step">
            <Loader2 size={48} className="spin" color="#d97706" />
            <h3>Processing Payment...</h3>
            <p>Transaction sent to Blockchain. Waiting for confirmation.</p>
            <p className="tiny-text">Hash: {txHash.slice(0, 10)}...</p>
            <div className="progress-bar"><div className="fill" style={{width: '70%'}}></div></div>
          </div>
        )}

        {/* STEP 3: SUCCESS & OTP REVEAL */}
        {status === 'success' && (
          <div className="status-step success">
            <CheckCircle size={50} color="#166534" />
            <h2>Payment Successful!</h2>
            <p>The transaction has been verified on the blockchain.</p>
            
            <div className="otp-reveal-box">
              <span className="otp-label">YOUR HANDOVER CODE</span>
              <span className="otp-value">{otp}</span>
            </div>

            <p className="instruction">Share this code with the seller <b>only</b> when you meet.</p>
            
            <button className="finish-btn" onClick={onClose}>
              Go to My Purchases <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* STEP 4: FAILED */}
        {status === 'failed' && (
          <div className="status-step">
            <XCircle size={50} color="#dc2626" />
            <h3>Payment Failed</h3>
            <p>The transaction was rejected or failed.</p>
            <button className="close-text-btn" onClick={onClose}>Close</button>
          </div>
        )}

      </div>
    </div>
  );
};

export default PaymentStatusModal;