import React from 'react';
import { ShieldAlert, Terminal, AlertCircle } from 'lucide-react';

function AuditLog({ auditLogs }) {
  // Format date
  const formatDate = (dateString) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return dateString;
    }
  };

  // Truncate hash
  const truncateHash = (hash) => {
    if (!hash) return '';
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
  };

  const getReasonLabel = (reason) => {
    switch (reason) {
      case 'invalid_pin':
        return 'Invalid UPI PIN';
      case 'insufficient_balance':
        return 'Insufficient Funds';
      case 'stale_packet':
        return 'Replay Guard: Stale Packet';
      case 'ttl_tampered':
        return 'Security Guard: TTL Tampered';
      case 'tampered_or_corrupt':
        return 'Cryptographic Error: Integrity Check Failed';
      case 'sender_not_found':
        return 'Sender VPA Not Found';
      case 'receiver_not_found':
        return 'Receiver VPA Not Found';
      case 'concurrent_conflict':
        return 'Concurrency Check: Version Conflict';
      default:
        return reason || 'Unknown Error';
    }
  };

  return (
    <div className="panel-card" style={{ flex: 1 }}>
      <div className="panel-header">
        <h3 className="panel-title">Security Audit Log</h3>
        <span className="panel-badge" style={{ color: 'var(--accent-red)' }}>
          LOOSE ENDS INGESTION
        </span>
      </div>

      {auditLogs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ opacity: 0.3 }}>🛡️</div>
          <div className="empty-state-text">No security alerts or rejections recorded.</div>
        </div>
      ) : (
        <div className="audit-list">
          {auditLogs.map((log) => (
            <div key={log._id || log.packetHash + log.timestamp} className="audit-item">
              <div style={{ flex: 1 }}>
                <div className="audit-item-reason" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} />
                  {getReasonLabel(log.reason)}
                </div>
                <div className="audit-item-message">
                  <span>Packet: {truncateHash(log.packetHash)}</span>
                  <span>|</span>
                  <span>Sender: {log.senderVpa || 'Decryption Failed'}</span>
                </div>
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                {formatDate(log.timestamp)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AuditLog;
