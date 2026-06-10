import React, { useState, useEffect } from 'react';
import { Smartphone, Network, ShieldCheck, HelpCircle } from 'lucide-react';
import socket from './socket';
import {
  fetchAccounts,
  fetchTransactions,
  fetchAuditLog,
  fetchMeshState,
  sendPayment,
  gossipMesh,
  flushBridges,
  resetMesh
} from './api';

import AccountBalances from './components/AccountBalances';
import PaymentForm from './components/PaymentForm';
import MeshVisualizer from './components/MeshVisualizer';
import TransactionLedger from './components/TransactionLedger';
import AuditLog from './components/AuditLog';

function App() {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [meshState, setMeshState] = useState({ devices: [] });
  const [serverOnline, setServerOnline] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Initial data loading
  const loadData = async () => {
    try {
      const [accRes, txRes, auditRes, meshRes] = await Promise.all([
        fetchAccounts(),
        fetchTransactions(),
        fetchAuditLog(),
        fetchMeshState(),
      ]);

      setAccounts(accRes.data);
      setTransactions(txRes.data);
      setAuditLogs(auditRes.data);
      setMeshState(meshRes.data);
    } catch (err) {
      console.error('Error fetching initial data:', err);
      showToast('Failed to load initial server data', 'error');
    }
  };

  useEffect(() => {
    loadData();

    // Check socket connectivity
    socket.on('connect', () => {
      setServerOnline(true);
      showToast('Connected to settlement backend via WebSockets', 'success');
      loadData(); // Reload data on reconnect
    });

    socket.on('disconnect', () => {
      setServerOnline(false);
      showToast('Backend connection lost', 'error');
    });

    // Real-time events
    socket.on('tx:settled', (data) => {
      // Reload accounts and transactions on new settlement
      loadData();
      showToast(`Settled: ₹${(data.amountPaise / 100).toFixed(2)} from ${data.senderVpa} to ${data.receiverVpa}`, 'success');
    });

    socket.on('tx:rejected', (data) => {
      // Reload audit log
      loadData();
      showToast(`Rejected packet (${data.reason}) from ${data.senderVpa || 'Unknown'}`, 'error');
    });

    socket.on('mesh:update', (data) => {
      // Direct mesh count update
      if (data.deviceCounts) {
        setMeshState((prev) => {
          const updatedDevices = prev.devices.map((d) => {
            const countInfo = data.deviceCounts[d.deviceId];
            return countInfo ? { ...d, packetCount: countInfo.packetCount } : d;
          });
          return { ...prev, devices: updatedDevices };
        });
      } else {
        // Fallback to fetch full state
        fetchMeshState().then((res) => setMeshState(res.data));
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('tx:settled');
      socket.off('tx:rejected');
      socket.off('mesh:update');
    };
  }, []);

  // Action wrappers
  const handlePaymentSent = async (paymentData) => {
    const res = await sendPayment(paymentData);
    // Mesh updates will trigger via websocket
    return res.data;
  };

  const handleGossip = async () => {
    const res = await gossipMesh();
    return res.data;
  };

  const handleFlush = async () => {
    const res = await flushBridges();
    // Refresh ledger & accounts
    loadData();
    return res.data;
  };

  const handleReset = async () => {
    const res = await resetMesh();
    loadData();
    return res.data;
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-top">
          <div className="header-brand">
            <div className="header-logo">
              <Network style={{ color: 'var(--bg-primary)' }} size={24} />
            </div>
            <div>
              <h1 className="header-title">UPI Offline Mesh</h1>
              <div className="header-subtitle">Deferred Settlement Simulator</div>
            </div>
          </div>

          <div className="header-status">
            <div className="status-indicator">
              <span className={`status-dot ${serverOnline ? 'online' : 'offline'}`}></span>
              {serverOnline ? 'Backend Online' : 'Backend Offline'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Layout */}
      <main className="dashboard-grid">
        {/* Left Side: Mesh Simulator & Actions */}
        <section className="left-panel">
          <MeshVisualizer
            meshState={meshState}
            onGossip={handleGossip}
            onFlush={handleFlush}
            onReset={handleReset}
            onInjectPayment={() => setShowPaymentModal(true)}
            showToast={showToast}
          />
        </section>

        {/* Right Side: Accounts, Ledger, Audit Log */}
        <section className="right-panel">
          <AccountBalances accounts={accounts} />
          <TransactionLedger transactions={transactions} />
          <AuditLog auditLogs={auditLogs} />
        </section>
      </main>

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentForm
          accounts={accounts}
          onPaymentSent={(data) => {
            handlePaymentSent(data);
            setShowPaymentModal(false);
          }}
          onClose={() => setShowPaymentModal(false)}
          showToast={showToast}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;
