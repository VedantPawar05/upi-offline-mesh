import React from 'react';
import { ClipboardList, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

function TransactionLedger({ transactions }) {
  // Format amount from paise to Rupees
  const formatAmount = (paise) => {
    return `₹${(paise / 100).toFixed(2)}`;
  };

  // Truncate hash
  const truncateHash = (hash) => {
    if (!hash) return '';
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
  };

  // Format date
  const formatDate = (dateString) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return dateString;
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'SETTLED') {
      return (
        <span className="status-badge settled">
          <CheckCircle2 size={12} />
          Settled
        </span>
      );
    }
    if (status === 'REJECTED') {
      return (
        <span className="status-badge rejected">
          <XCircle size={12} />
          Rejected
        </span>
      );
    }
    return (
      <span className="status-badge duplicate">
        <AlertTriangle size={12} />
        {status}
      </span>
    );
  };

  return (
    <div className="panel-card" style={{ flex: 1 }}>
      <div className="panel-header">
        <h3 className="panel-title">Settlement Ledger</h3>
        <span className="panel-badge">REAL-TIME UPDATES</span>
      </div>

      {transactions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📥</div>
          <div className="empty-state-text">No transactions processed yet.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Packet Hash</th>
                <th>Sender</th>
                <th>Receiver</th>
                <th>Amount</th>
                <th>Hops</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx._id || tx.packetHash}>
                  <td>
                    <span className="hash-display" title={tx.packetHash}>
                      {truncateHash(tx.packetHash)}
                    </span>
                  </td>
                  <td>{tx.senderVpa}</td>
                  <td>{tx.receiverVpa}</td>
                  <td>
                    <span className={`amount ${tx.status === 'SETTLED' ? 'credit' : 'debit'}`}>
                      {formatAmount(tx.amountPaise)}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{tx.hopCount}</td>
                  <td style={{ fontSize: '0.75rem' }}>{formatDate(tx.settledAt)}</td>
                  <td>{getStatusBadge(tx.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default TransactionLedger;
