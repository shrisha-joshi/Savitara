import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Linking
} from 'react-native'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

const WalletScreen = () => {
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false)
  const [amount, setAmount] = useState('')

  useEffect(() => {
    fetchWalletData()
  }, [])

  const fetchWalletData = async () => {
    try {
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
      Alert.alert('Error', 'Failed to load wallet data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchWalletData()
  }

  const handleAddMoney = async () => {
    const amountValue = Number.parseFloat(amount)
    
    if (Number.isNaN(amountValue) || amountValue < 100) {
      Alert.alert('Invalid Amount', 'Minimum amount is ₹100')
      return
    }
    
    try {
      const response = await api.post('/wallet/add-money', { amount: amountValue })
      
      if (response.data.success) {
        const { payment_url } = response.data.data
        setShowAddMoneyModal(false)
        setAmount('')
        
        // Open payment URL
        const supported = await Linking.canOpenURL(payment_url)
        if (supported) {
          await Linking.openURL(payment_url)
        }
      }
    } catch (error) {
      console.error('Error adding money:', error)
      Alert.alert('Error', 'Failed to initiate payment')
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

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading wallet...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Wallet</Text>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceSection}>
            <Text style={styles.balanceLabel}>Main Balance</Text>
            <Text style={styles.balanceAmount}>
              ₹{wallet?.main_balance || 0}
            </Text>
          </View>
          
          {wallet?.bonus_balance > 0 && (
            <View style={styles.bonusSection}>
              <Text style={styles.bonusLabel}>Bonus Balance</Text>
              <Text style={styles.bonusAmount}>₹{wallet.bonus_balance}</Text>
            </View>
          )}
          
          <TouchableOpacity
            style={styles.addMoneyBtn}
            onPress={() => setShowAddMoneyModal(true)}
          >
            <Text style={styles.addMoneyText}>+ Add Money</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionBtn}>
            <Text style={styles.quickActionIcon}>🔄</Text>
            <Text style={styles.quickActionLabel}>Transfer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn}>
            <Text style={styles.quickActionIcon}>💳</Text>
            <Text style={styles.quickActionLabel}>Pay</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn}>
            <Text style={styles.quickActionIcon}>📊</Text>
            <Text style={styles.quickActionLabel}>History</Text>
          </TouchableOpacity>
        </View>

        {/* Transactions */}
        <View style={styles.transactionsSection}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          
          {transactions.length === 0 ? (
            <View style={styles.noTransactions}>
              <Text style={styles.noTransactionsText}>No transactions yet</Text>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {transactions.map((txn) => (
                <View key={txn._id} style={styles.transactionItem}>
                  <View
                    style={[
                      styles.txnIcon,
                      { backgroundColor: getTransactionColor(txn.type) + '20' }
                    ]}
                  >
                    <Text
                      style={[styles.txnIconText, { color: getTransactionColor(txn.type) }]}
                    >
                      {getTransactionIcon(txn.type)}
                    </Text>
                  </View>
                  
                  <View style={styles.txnDetails}>
                    <Text style={styles.txnDescription}>{txn.description}</Text>
                    <Text style={styles.txnDate}>{formatDate(txn.created_at)}</Text>
                  </View>
                  
                  <Text
                    style={[styles.txnAmount, { color: getTransactionColor(txn.type) }]}
                  >
                    {txn.type === 'debit' ? '-' : '+'}₹{txn.amount}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Money Modal */}
      <Modal
        visible={showAddMoneyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddMoneyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Money to Wallet</Text>
              <TouchableOpacity
                onPress={() => setShowAddMoneyModal(false)}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>×</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Enter Amount (₹)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                placeholder="Minimum ₹100"
              />
              
              <View style={styles.quickAmounts}>
                <TouchableOpacity
                  style={styles.quickAmountBtn}
                  onPress={() => setAmount('500')}
                >
                  <Text style={styles.quickAmountText}>₹500</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAmountBtn}
                  onPress={() => setAmount('1000')}
                >
                  <Text style={styles.quickAmountText}>₹1000</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAmountBtn}
                  onPress={() => setAmount('2000')}
                >
                  <Text style={styles.quickAmountText}>₹2000</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAmountBtn}
                  onPress={() => setAmount('5000')}
                >
                  <Text style={styles.quickAmountText}>₹5000</Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleAddMoney}
              >
                <Text style={styles.submitBtnText}>Proceed to Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    fontSize: 16,
    color: '#666'
  },
  header: {
    padding: 20,
    paddingTop: 40
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333'
  },
  balanceCard: {
    backgroundColor: '#FF6B35',
    margin: 20,
    padding: 24,
    borderRadius: 20,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8
  },
  balanceSection: {
    marginBottom: 20
  },
  balanceLabel: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9,
    marginBottom: 8
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFF'
  },
  bonusSection: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    alignSelf: 'flex-start'
  },
  bonusLabel: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.9,
    marginBottom: 4
  },
  bonusAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF'
  },
  addMoneyBtn: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  addMoneyText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '600'
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0'
  },
  quickActionIcon: {
    fontSize: 32,
    marginBottom: 8
  },
  quickActionLabel: {
    fontSize: 12,
    color: '#666'
  },
  transactionsSection: {
    backgroundColor: '#FFF',
    margin: 20,
    padding: 20,
    borderRadius: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16
  },
  noTransactions: {
    padding: 40,
    alignItems: 'center'
  },
  noTransactionsText: {
    color: '#999',
    fontSize: 14
  },
  transactionsList: {
    gap: 12
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 12,
    gap: 12
  },
  txnIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  txnIconText: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  txnDetails: {
    flex: 1
  },
  txnDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4
  },
  txnDate: {
    fontSize: 12,
    color: '#666'
  },
  txnAmount: {
    fontSize: 16,
    fontWeight: '600'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#E0E0E0'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333'
  },
  closeBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeBtnText: {
    fontSize: 32,
    color: '#999'
  },
  modalBody: {
    padding: 20
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8
  },
  input: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20
  },
  quickAmountBtn: {
    flex: 1,
    minWidth: '47%',
    padding: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    alignItems: 'center'
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333'
  },
  submitBtn: {
    backgroundColor: '#FF6B35',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center'
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600'
  }
})

export default WalletScreen
