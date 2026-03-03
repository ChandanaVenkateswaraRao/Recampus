import React from 'react';
import { X, CheckCircle, Copy } from 'lucide-react';

const PurchaseModal = ({ item, code, onClose }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content purchase-modal">
        <button className="close-btn" onClick={onClose}><X /></button>
        
        <div className="modal-success-icon">
          <CheckCircle size={48} color="#00A36C" />
        </div>
        
        <h2>Payment Successful!</h2>
        <p>You have successfully initiated the purchase for <strong>{item.title}</strong>.</p>
        
        <div className="code-box">
          <label>HANDOVER VERIFICATION CODE</label>
          <div className="verification-code">{code}</div>
          <p>Give this code to the seller ONLY after you physically receive the item.</p>
        </div>

        <div className="instructions">
          <h4>Next Steps:</h4>
          <ul>
            <li>Meet the seller at a safe spot on campus.</li>
            <li>Inspect the item thoroughly.</li>
            <li>If satisfied, tell them the code above.</li>
          </ul>
        </div>

        <button className="done-btn" onClick={onClose}>Back to Marketplace</button>
      </div>
    </div>
  );
};

export default PurchaseModal;