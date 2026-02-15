import { useState, useEffect } from 'react'
import api from '../services/api'
import MobileNavigation from '../components/navigation/MobileNavigation'
import './Wallet.css'

const Wallet = () => {
  // User variable removed as unused
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false)
  const [amount, setAmount] = useState('')

  useEffect(() => {
    fetchWalletData()
  }, [])

  const fetchWalletData = async () => {
    try {
      setLoading(true)
      const [walletRes, transRes] = await Promise.all([
        api.get('/wallet/balance'),
        api.get('/wallet/transactions?limit=50')
      ])
      
      if (walletRes.data.success) {
        setWallet(walletRes.data.data.wallet)
      }
      
      if (transRes.data.success) {
        setTransactions(transRes.data.data.transactions)
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddMoney = async (e) => {
    e.preventDefault()
    const amountValue = Number.parseFloat(amount)
    
    if (amountValue < 100) {
      alert('Minimum amount is ₹100')
      return
    }
    
    try {
      const response = await api.post('/wallet/add-money', { amount: amountValue })
      
      if (response.data.success) {
        const { payment_url } = response.data.data
        // Redirect to payment gateway
        globalThis.window.location.href = payment_url
      }
    } catch (error) {
      console.error('Error adding money:', error)
      alert('Failed to initiate payment')
    }
  }

  const getTransactionIcon = (type) => {
    switch(type) {
      case 'credit': return '+'
      case 'debit': return '-'
      case 'refund': return '↻'
      default: return '•'
    }
  }

  const getTransactionColor = (type) => {
    switch(type) {
      case 'credit': return '#4caf50'
      case 'debit': return '#f44336'
      case 'refund': return '#2196f3'
      default: return '#666'
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading wallet...</p>
      </div>
    )
  }

  return (
    <div className="wallet-page">
      <MobileNavigation />
      
      <div className="wallet-header">
        <h1>My Wallet</h1>
      </div>

      {/* Wallet Balance Card */}
      <div className="wallet-balance-card">
        <div className="balance-section">
          <p className="balance-label">Main Balance</p>
          <h2 className="balance-amount">₹{wallet?.main_balance || 0}</h2>
        </div>
        
        {wallet?.bonus_balance > 0 && (
          <div className="bonus-section">
            <p className="bonus-label">Bonus Balance</p>
            <p className="bonus-amount">₹{wallet.bonus_balance}</p>
          </div>
        )}
        
        <button 
          className="add-money-btn"
          onClick={() => setShowAddMoneyModal(true)}
        >
          + Add Money
        </button>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="quick-action-btn">
          <span>🔄</span>
          <span>Transfer</span>
        </button>
        <button className="quick-action-btn">
          <span>💳</span>
          <span>Pay</span>
        </button>
        <button className="quick-action-btn">
          <span>📊</span>
          <span>History</span>
        </button>
      </div>

      {/* Transactions List */}
      <div className="transactions-section">
        <h3>Recent Transactions</h3>
        
        {transactions.length === 0 ? (
          <div className="no-transactions">
            <p>No transactions yet</p>
          </div>
        ) : (
          <div className="transactions-list">
            {transactions.map((txn) => (
              <div key={txn._id} className="transaction-item">
                <div className="txn-icon" style={{ color: getTransactionColor(txn.type) }}>
                  {getTransactionIcon(txn.type)}
                </div>
                
                <div className="txn-details">
                  <p className="txn-description">{txn.description}</p>
                  <p className="txn-date">
                    {new Date(txn.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                
                <div className="txn-amount" style={{ color: getTransactionColor(txn.type) }}>
                  {txn.type === 'debit' ? '-' : '+'}₹{txn.amount}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Money Modal */}
      {showAddMoneyModal && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target.classList.contains('modal-overlay')) {
              setShowAddMoneyModal(false)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowAddMoneyModal(false)
          }}
          tabIndex={-1}
        >
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="wallet-modal-title">
            <div className="modal-header">
              <h3 id="wallet-modal-title">Add Money to Wallet</h3>
              <button className="close-btn" onClick={() => setShowAddMoneyModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleAddMoney} className="add-money-form">
              <div className="form-group">
                <label htmlFor="wallet-amount">Enter Amount (₹)</label>
                <input
                  id="wallet-amount"
                  type="number"
                  min="100"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Minimum ₹100"
                  required
                />
              </div>
              
              <div className="quick-amounts">
                <button type="button" onClick={() => setAmount('500')}>₹500</button>
                <button type="button" onClick={() => setAmount('1000')}>₹1000</button>
                <button type="button" onClick={() => setAmount('2000')}>₹2000</button>
                <button type="button" onClick={() => setAmount('5000')}>₹5000</button>
              </div>
              
              <button type="submit" className="submit-btn">
                Proceed to Payment
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Wallet
