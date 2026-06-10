import React, { useState } from 'react';
import { Send, Lock, User, DollarSign, Sliders, X } from 'lucide-react';

function PaymentForm({ accounts, onPaymentSent, onClose, showToast }) {
  const [senderVpa, setSenderVpa] = useState('');
  const [receiverVpa, setReceiverVpa] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [pin, setPin] = useState('');
  const [ttl, setTtl] = useState(5);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!senderVpa || !receiverVpa || !amountRupees || !pin) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    if (senderVpa === receiverVpa) {
      showToast('Sender and receiver VPA must be different', 'error');
      return;
    }

    const amount = parseFloat(amountRupees);
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    // Convert to paise (integer)
    const amountPaise = Math.round(amount * 100);

    // Enforce max transaction limit of ₹1,00,000 (10,000,000 paise)
    if (amountPaise > 10000000) {
      showToast('Transaction exceeds maximum limit of ₹1,00,000', 'error');
      return;
    }

    setLoading(true);
    try {
      await onPaymentSent({
        senderVpa,
        receiverVpa,
        amountPaise,
        pin,
        ttl: parseInt(ttl, 10),
      });

      // Clear non-essential fields on success
      setAmountRupees('');
      setPin('');
      showToast('Payment instruction encrypted & injected into mesh!', 'success');
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to send payment';
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div className="panel-card" style={{ width: '400px', maxWidth: '90%', position: 'relative' }}>
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        <div className="panel-header" style={{ marginBottom: '24px' }}>
          <h3 className="panel-title">Inject Payment</h3>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Sender VPA */}
          <div className="form-group">
            <label className="form-label" htmlFor="senderVpa">Sender VPA</label>
            <select
              id="senderVpa"
              className="form-select"
              value={senderVpa}
              onChange={(e) => setSenderVpa(e.target.value)}
              required
            >
              <option value="">Select Sender</option>
              {accounts.map((acc) => (
                <option key={acc._id} value={acc._id}>
                  {acc.holderName} ({acc._id})
                </option>
              ))}
            </select>
          </div>

          {/* Receiver VPA */}
          <div className="form-group">
            <label className="form-label" htmlFor="receiverVpa">Receiver VPA</label>
            <select
              id="receiverVpa"
              className="form-select"
              value={receiverVpa}
              onChange={(e) => setReceiverVpa(e.target.value)}
              required
            >
              <option value="">Select Receiver</option>
              {accounts.map((acc) => (
                <option key={acc._id} value={acc._id}>
                  {acc.holderName} ({acc._id})
                </option>
              ))}
            </select>
          </div>

          {/* Amount & PIN */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="amount">Amount (₹)</label>
              <input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                className="form-input"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pin">PIN</label>
              <input
                id="pin"
                type="password"
                maxLength={4}
                placeholder="••••"
                className="form-input"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
              />
            </div>
          </div>

          {/* TTL slider */}
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label className="form-label" htmlFor="ttl" style={{ margin: 0 }}>Mesh Hops (TTL)</label>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {ttl}
              </span>
            </div>
            <input
              id="ttl"
              type="range"
              min={1}
              max={10}
              className="form-input"
              value={ttl}
              onChange={(e) => setTtl(e.target.value)}
              style={{ padding: 0 }}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Injecting...' : 'Confirm Injection'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default PaymentForm;
