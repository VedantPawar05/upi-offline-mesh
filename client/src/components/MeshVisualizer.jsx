import React, { useState } from 'react';
import { Smartphone, Wifi, WifiOff, RefreshCw, UploadCloud, Trash2, Send } from 'lucide-react';

function MeshVisualizer({ meshState, onGossip, onFlush, onReset, onInjectPayment, showToast }) {
  const [gossiping, setGossiping] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Parse devices list from state
  const devices = meshState?.devices || [];

  const handleGossip = async () => {
    setGossiping(true);
    try {
      const res = await onGossip();
      showToast(res.message || 'Gossip round complete!', 'info');
    } catch (err) {
      showToast('Gossip failed: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setGossiping(false);
    }
  };

  const handleFlush = async () => {
    setFlushing(true);
    try {
      const res = await onFlush();
      showToast(res.message || 'Mesh packets uploaded to backend!', 'success');
    } catch (err) {
      showToast('Flush failed: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setFlushing(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to clear the mesh and idempotency cache?')) return;
    setResetting(true);
    try {
      const res = await onReset();
      showToast(res.message || 'Mesh and cache cleared!', 'info');
    } catch (err) {
      showToast('Reset failed: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setResetting(false);
    }
  };

  // Helper to get friendly names and positioning
  const getDeviceConfig = (id) => {
    if (id === 'phone-alice') return { name: 'phone-alice', style: { top: '25%', left: '15%' } };
    if (id === 'phone-stranger1') return { name: 'stranger-1', style: { top: '60%', left: '10%' } };
    if (id === 'phone-stranger2') return { name: 'stranger-2', style: { top: '65%', left: '40%' } };
    if (id === 'phone-stranger3') return { name: 'stranger-3', style: { top: '50%', left: '75%' } };
    if (id === 'phone-bridge') return { name: 'phone-bridge', style: { top: '15%', left: '55%' } };
    return { name: id, style: { top: '50%', left: '50%' } };
  };

  return (
    <div className="panel-card">
      <div className="panel-header">
        <h3 className="panel-title">Mesh Simulator</h3>
        <span className="panel-badge">Nodes: {devices.length}</span>
      </div>

      <div className="mesh-container">
        {/* SVG lines can go here for connectivity */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.2 }}>
           {/* Simple static lines representing connections */}
           <line x1="15%" y1="25%" x2="55%" y2="15%" stroke="var(--text-secondary)" strokeWidth="1" strokeDasharray="4" />
           <line x1="15%" y1="25%" x2="10%" y2="60%" stroke="var(--text-secondary)" strokeWidth="1" strokeDasharray="4" />
           <line x1="10%" y1="60%" x2="40%" y2="65%" stroke="var(--text-secondary)" strokeWidth="1" strokeDasharray="4" />
           <line x1="40%" y1="65%" x2="75%" y2="50%" stroke="var(--text-secondary)" strokeWidth="1" strokeDasharray="4" />
           <line x1="75%" y1="50%" x2="55%" y2="15%" stroke="var(--text-secondary)" strokeWidth="1" strokeDasharray="4" />
        </svg>

        {devices.map((device) => {
          const config = getDeviceConfig(device.deviceId);
          return (
            <div
              key={device.deviceId}
              className={`mesh-node ${device.deviceId === 'phone-bridge' ? 'bridge' : ''}`}
              style={config.style}
            >
              <div className="mesh-node-icon">
                {device.hasInternet ? (
                  <Wifi size={24} />
                ) : (
                  <Smartphone size={24} />
                )}
              </div>
              <div className="mesh-node-name">{config.name}</div>
              <div className="mesh-node-status">
                <span className={`status-dot ${device.hasInternet ? '' : 'hidden'}`} style={!device.hasInternet ? { background: 'var(--text-muted)', boxShadow: 'none' } : {}}></span>
                {device.packetCount}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button
          className="btn btn-primary btn-full"
          onClick={onInjectPayment}
          style={{ background: 'var(--accent-primary)', color: 'var(--bg-primary)' }}
        >
          <Send size={16} />
          Inject Payment
        </button>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={handleGossip}
            disabled={gossiping || flushing || resetting}
          >
            Run Gossip Round
          </button>

          <button
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={handleFlush}
            disabled={gossiping || flushing || resetting}
          >
            Flush Bridges
          </button>
        </div>

        <button
          className="btn btn-secondary btn-full"
          style={{ color: 'var(--accent-red)', borderColor: 'var(--border-color)' }}
          onClick={handleReset}
          disabled={gossiping || flushing || resetting}
        >
          <RefreshCw size={14} />
          Reset Mesh
        </button>
      </div>
    </div>
  );
}

export default MeshVisualizer;
