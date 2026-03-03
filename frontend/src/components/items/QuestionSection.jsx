import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MessageCircle, Send, CornerDownRight, User, ShieldCheck } from 'lucide-react';
import './QuestionSection.css'; // We will create this CSS file next

const QuestionSection = ({ item }) => {
  const [questions, setQuestions] = useState(item.questions || []);
  const [newQ, setNewQ] = useState('');
  const [replyText, setReplyText] = useState('');
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  // 1. Find out who is looking at this page
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await axios.get('http://localhost:5000/api/auth/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCurrentUserId(res.data._id);
      } catch (err) { console.error("Could not fetch user"); }
    };
    fetchUser();
  }, []);

  // 2. Logic to check if I am the seller
  const sellerId = typeof item.seller === 'object' ? item.seller._id : item.seller;
  const isSeller = currentUserId === sellerId;

  // 3. Handlers
  const handleAsk = async () => {
    if (!newQ.trim()) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`http://localhost:5000/api/items/question/${item._id}`, 
        { question: newQ }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setQuestions(res.data);
      setNewQ('');
    } catch (err) { alert("Failed to post question"); }
  };

  const handleReply = async (qId) => {
    if (!replyText.trim()) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`http://localhost:5000/api/items/answer/${item._id}/${qId}`, 
        { answer: replyText }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setQuestions(res.data);
      setActiveReplyId(null);
      setReplyText('');
    } catch (err) { alert("Failed to post reply. Only the seller can do this."); }
  };

  return (
    <div className="qa-container">
      <h3 className="qa-title"><MessageCircle size={20}/> Questions & Answers</h3>

      {/* --- BUYER VIEW: ASK A QUESTION --- */}
      {!isSeller && (
        <div className="ask-question-box">
          <input 
            type="text" 
            placeholder="Ask the seller about details, condition, etc..." 
            value={newQ} 
            onChange={(e) => setNewQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          />
          <button onClick={handleAsk}><Send size={16}/> Ask</button>
        </div>
      )}

      {/* --- QUESTIONS THREAD --- */}
      <div className="qa-list">
        {questions.length === 0 && <p className="no-questions">No questions asked yet. Be the first!</p>}

        {questions.map(q => (
          <div key={q._id} className="qa-thread">
            
            {/* The Question (Buyer) */}
            <div className="q-bubble">
              <div className="q-header">
                <User size={14} /> <span>{q.username || "Student"} asked:</span>
              </div>
              <div className="q-text">{q.question}</div>
            </div>

            {/* The Answer (Seller) */}
            {q.answer ? (
              <div className="a-bubble">
                <div className="a-header">
                  <CornerDownRight size={14} color="#166534" /> 
                  <ShieldCheck size={14} color="#166534" /> 
                  <span>Seller replied:</span>
                </div>
                <div className="a-text">{q.answer}</div>
              </div>
            ) : (
              /* If no answer and I am the Seller, show Reply Box */
              isSeller && (
                <div className="seller-reply-action">
                  {activeReplyId === q._id ? (
                    <div className="reply-input-box fade-in">
                      <input 
                        autoFocus
                        type="text" 
                        placeholder="Type your official answer..." 
                        value={replyText} 
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleReply(q._id)}
                      />
                      <button className="submit-reply-btn" onClick={() => handleReply(q._id)}>Reply</button>
                      <button className="cancel-reply-btn" onClick={() => setActiveReplyId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="trigger-reply-btn" onClick={() => setActiveReplyId(q._id)}>
                      <CornerDownRight size={14}/> Reply to this question
                    </button>
                  )}
                </div>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuestionSection;