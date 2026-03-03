import React, { useState } from 'react';
import { X, CreditCard, Smartphone, Globe, Loader2, CheckCircle } from 'lucide-react';
import './PaymentGateway.css';

const PaymentGateway = ({ item, onClose, onSuccess }) => {
  const [method, setMethod] = useState('upi'); // upi, card, netbanking
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('select'); // select, processing, success

  const handlePay = () => {
    setLoading(true);
    // Simulate Bank Network Delay (2.5 seconds)
    setTimeout(() => {
      setLoading(false);
      setStep('success');
      
      // Wait a bit to show green success check, then close and trigger logic
      setTimeout(() => {
        onSuccess();
      }, 1500);
    }, 2500);
  };

  return (
    <div className="gateway-overlay">
      <div className="gateway-box">
        
        {/* HEADER */}
        <div className="gateway-header">
          <div className="gateway-logo">
            <span className="pay-text">Secure</span>Pay
          </div>
          <div className="order-summary">
            <p>Paying to <b>Recampus KLU</b></p>
            <h2>₹{item.price.toFixed(2)}</h2>
          </div>
          <button className="close-gateway" onClick={onClose}><X size={20}/></button>
        </div>

        {/* BODY CONTENT */}
        <div className="gateway-body">
          
          {step === 'select' && (
            <>
              <p className="select-label">Select Payment Method</p>
              
              <div 
                className={`pay-method ${method === 'upi' ? 'selected' : ''}`} 
                onClick={() => setMethod('upi')}
              >
                <div className="icon-circle"><Smartphone size={20} /></div>
                <div className="method-details">
                  <h4>UPI / QR</h4>
                  <p>Google Pay, PhonePe, Paytm</p>
                </div>
                <div className="radio-circle"></div>
              </div>

              <div 
                className={`pay-method ${method === 'card' ? 'selected' : ''}`}
                onClick={() => setMethod('card')}
              >
                <div className="icon-circle"><CreditCard size={20} /></div>
                <div className="method-details">
                  <h4>Card</h4>
                  <p>Visa, MasterCard, RuPay</p>
                </div>
                <div className="radio-circle"></div>
              </div>

              <div 
                className={`pay-method ${method === 'netbanking' ? 'selected' : ''}`}
                onClick={() => setMethod('netbanking')}
              >
                <div className="icon-circle"><Globe size={20} /></div>
                <div className="method-details">
                  <h4>Netbanking</h4>
                  <p>SBI, HDFC, ICICI, Axis</p>
                </div>
                <div className="radio-circle"></div>
              </div>

              {/* INPUT FIELDS SIMULATION */}
              <div className="method-input-area">
                {method === 'upi' && (
                  <input type="text" placeholder="Enter UPI ID (e.g. student@okaxis)" className="gateway-input" />
                )}
                {method === 'card' && (
                  <div className="card-inputs">
                    <input type="text" placeholder="Card Number" className="gateway-input" />
                    <div className="row">
                      <input type="text" placeholder="MM/YY" className="gateway-input" />
                      <input type="text" placeholder="CVV" className="gateway-input" />
                    </div>
                  </div>
                )}
              </div>

              <button className="pay-now-btn" onClick={handlePay}>
                Pay ₹{item.price}
              </button>
            </>
          )}

          {step === 'processing' || loading ? (
            <div className="processing-state">
              <Loader2 size={50} className="spin" color="#3b82f6" />
              <h3>Processing Payment...</h3>
              <p>Please do not close this window.</p>
            </div>
          ) : null}

          {step === 'success' && (
            <div className="success-state">
              <CheckCircle size={60} color="#166534" />
              <h3>Payment Successful</h3>
              <p>Redirecting back to merchant...</p>
            </div>
          )}

        </div>
        
        <div className="gateway-footer">
          Secured by 🔒 <strong>Razorpay</strong> Simulation
        </div>
      </div>
    </div>
  );
};

export default PaymentGateway;