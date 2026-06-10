import React from 'react';
import { Wallet, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

function AccountBalances({ accounts }) {
  // Format amount from paise to Rupees
  const formatAmount = (paise) => {
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="panel-card">
      <div className="panel-header">
        <h3 className="panel-title">Account Balances</h3>
        <span className="panel-badge">DEMO WALLETS</span>
      </div>

      <div className="accounts-row">
        {accounts.map((acc) => {
          return (
            <div key={acc._id} className="account-compact-card">
              <div className="account-vpa">{acc._id}</div>
              <div className="account-name" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>{acc.holderName}</div>
              <div className="account-balance">{formatAmount(acc.balancePaise)}</div>
              <div className="account-balance-label" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Available Balance</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AccountBalances;
