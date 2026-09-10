// ============================================================
// valtService.js — Service React Native pour VALT/Pulse
// Gestion wallet, pledges, QR, ZND transfers
// ============================================================

import { ethers } from 'ethers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const API_BASE = 'https://pulse-backend-9zpb.onrender.com';
const BSC_RPC = 'https://bsc-dataseed.binance.org/';
const ZND_CONTRACT = '0x3BcE58FC2C2BB0653dC757Ba0bc5328d4f2f15A9';
const ZND_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
];

// ─────────────────────────────────────────────
// WALLET MANAGEMENT
// ─────────────────────────────────────────────

export const walletService = {

  async createWallet() {
    const wallet = ethers.Wallet.createRandom();
    await SecureStore.setItemAsync('valt_private_key', wallet.privateKey);
    await SecureStore.setItemAsync('valt_mnemonic', wallet.mnemonic.phrase);
    await AsyncStorage.setItem('valt_address', wallet.address);
    return { address: wallet.address, mnemonic: wallet.mnemonic.phrase };
  },

  async importWallet(mnemonic) {
    const wallet = ethers.Wallet.fromMnemonic(mnemonic);
    await SecureStore.setItemAsync('valt_private_key', wallet.privateKey);
    await SecureStore.setItemAsync('valt_mnemonic', mnemonic);
    await AsyncStorage.setItem('valt_address', wallet.address);
    return { address: wallet.address };
  },

  async importFromPrivateKey(privateKey) {
    const wallet = new ethers.Wallet(privateKey);
    await SecureStore.setItemAsync('valt_private_key', wallet.privateKey);
    await SecureStore.deleteItemAsync('valt_mnemonic');
    await AsyncStorage.setItem('valt_address', wallet.address);
    return { address: wallet.address };
  },

  async hasWallet() {
    const stored = await AsyncStorage.getItem('valt_address');
    return !!stored;
  },

  async exportMnemonic() {
    return await SecureStore.getItemAsync('valt_mnemonic');
  },

  async getAddress() {
    const stored = await AsyncStorage.getItem('valt_address');
    if (stored) return stored;
    const created = await this.createWallet();
    return created.address;
  },

  async getProvider() {
    return new ethers.providers.JsonRpcProvider(BSC_RPC);
  },

  async getSigner() {
    const privateKey = await SecureStore.getItemAsync('valt_private_key');
    if (!privateKey) throw new Error('Wallet non initialisé');
    const provider = await this.getProvider();
    return new ethers.Wallet(privateKey, provider);
  },

  async transferZNDOnChain(toAddress, amount) {
    try {
      const signer = await this.getSigner();
      const contract = new ethers.Contract(ZND_CONTRACT, ZND_ABI, signer);
      const decimals = await contract.decimals();
      const amountWei = ethers.utils.parseUnits(amount.toString(), decimals);
      const tx = await contract.transfer(toAddress, amountWei);
      await tx.wait();
      return { success: true, hash: tx.hash };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // Lecture directe on-chain (BSC) - source unique du solde ZND pour Pulse et VALT
  async getZNDBalance() {
    try {
      const address = await this.getAddress();
      const cleanAddress = address.replace('0x', '').toLowerCase();
      const paddedAddress = '0000000000000000000000000000000000000000000000000000000000000000'.slice(0, 64 - 40) + cleanAddress;
      const response = await fetch(BSC_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{ to: ZND_CONTRACT, data: '0x70a08231' + paddedAddress }, 'latest'],
          id: 1,
        }),
      });
      const data = await response.json();
      if (data.result && data.result !== '0x') {
        const balanceBigInt = BigInt(data.result);
        const divisor = BigInt('1000000000000000000');
        return (balanceBigInt / divisor).toString();
      }
      return '0';
    } catch (err) {
      console.log('Erreur BSC:', err);
      return '0';
    }
  }
};

// ─────────────────────────────────────────────
// PLEDGE SERVICE
// ─────────────────────────────────────────────

export const pledgeService = {

  /**
   * Crée un gage bien physique
   */
  async createPhysicalPledge({ model, condition, serialNumber, videoUri, durationDays = 30 }) {

    const address = await walletService.getAddress();

    // 1. Valorisation
    const valuationRes = await fetch(`${API_BASE}/api/valuate/physical`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, condition, serialNumber })
    });
    const valuation = await valuationRes.json();
    if (!valuation.success) {
  console.log('Valuation error:', JSON.stringify(valuation));
  throw new Error(valuation.error || 'Erreur valorisation');
}

    // 2. Vérification vidéo
    let verificationResult = null;
    if (videoUri) {
      const formData = new FormData();
      formData.append('video', { uri: videoUri, type: 'video/mp4', name: 'verification.mp4' });
      formData.append('expectedModel', model);
      if (serialNumber) formData.append('expectedSerial', serialNumber);

      const verifyRes = await fetch(`${API_BASE}/api/verify/video`, {
        method: 'POST',
        body: formData
      });
      verificationResult = await verifyRes.json();
      if (!verificationResult.verification?.approved) {
        throw new Error('Vérification du bien échouée. Score insuffisant.');
      }
    }

    // 3. Création on-chain
    const pledgeRes = await fetch(`${API_BASE}/api/pledge/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        borrowerAddress: address,
        collateralType: 'PHYSICAL',
        collateralValue: valuation.valuation.marketValue,
        collateralHash: `ipfs_${Date.now()}`, // En prod: IPFS upload de la vidéo
        collateralRef: serialNumber || model,
        durationDays
      })
    });
    const pledgeData = await pledgeRes.json();
    if (!pledgeData.success) throw new Error(pledgeData.error);

    // Sauvegarder localement
    await this._savePledgeLocally(pledgeData.pledgeId, {
      type: 'PHYSICAL',
      model,
      condition,
      valuation: valuation.valuation,
      pledgeId: pledgeData.pledgeId,
      txHash: pledgeData.txHash,
      createdAt: new Date().toISOString(),
      durationDays
    });

    return { ...pledgeData, valuation: valuation.valuation, verification: verificationResult };
  },

  /**
   * Crée un gage de compétences
   */
  async createSkillPledge({ skillType, hourlyRate, hours, profileUrl, durationDays = 7 }) {
    const address = await walletService.getAddress();

    const valuationRes = await fetch(`${API_BASE}/api/valuate/skill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillType, hourlyRate, hours, profileUrl })
    });
    const valuation = await valuationRes.json();

    const pledgeRes = await fetch(`${API_BASE}/api/pledge/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        borrowerAddress: address,
        collateralType: 'SKILL',
        collateralValue: valuation.valuation.totalValue,
        collateralHash: `skill_${Date.now()}`,
        collateralRef: `${skillType}:${hours}h@${hourlyRate}`,
        durationDays
      })
    });

    return await pledgeRes.json();
  },

  /**
   * Crée un gage d'abonnement
   */
  async createSubscriptionPledge({ provider, oauthToken, durationDays = 30 }) {
    const address = await walletService.getAddress();

    const valuationRes = await fetch(`${API_BASE}/api/valuate/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, oauthToken })
    });
    const valuation = await valuationRes.json();

    const pledgeRes = await fetch(`${API_BASE}/api/pledge/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        borrowerAddress: address,
        collateralType: 'SUBSCRIPTION',
        collateralValue: valuation.valuation.monthlyValue,
        collateralHash: `sub_${provider}_${Date.now()}`,
        collateralRef: provider,
        durationDays
      })
    });

    return await pledgeRes.json();
  },

  async getUserPledges() {
    const address = await walletService.getAddress();
    const res = await fetch(`${API_BASE}/api/user/${address}/pledges`);
    const remote = await res.json();

    // Le serveur est la source de vérité ; le cache local ne comble que ce qu'il n'a pas encore.
    const local = await this._getLocalPledges();

    return {
      ...remote,
      pledgeDetails: { ...local, ...(remote.pledgeDetails || {}) }
    };
  },

  async getPledgeDetails(pledgeId) {
    const res = await fetch(`${API_BASE}/api/pledge/${pledgeId}`);
    return res.json();
  },

  async repayPledge(pledgeId) {
    const res = await fetch(`${API_BASE}/api/pledge/repay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pledgeId })
    });
    return res.json();
  },

  async _savePledgeLocally(pledgeId, data) {
    const existing = await this._getLocalPledges();
    existing[pledgeId] = data;
    await AsyncStorage.setItem('valt_pledges', JSON.stringify(existing));
  },

  async _getLocalPledges() {
    const stored = await AsyncStorage.getItem('valt_pledges');
    return stored ? JSON.parse(stored) : {};
  }
};

// ─────────────────────────────────────────────
// QR SERVICE
// ─────────────────────────────────────────────

export const qrService = {

  /**
   * Génère un QR de paiement
   */
  async generateQR(pledgeId, amount, expiryMinutes = 15) {
    const address = await walletService.getAddress();

    const res = await fetch(`${API_BASE}/api/qr/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pledgeId,
        borrowerAddress: address,
        amount,
        expiryMinutes
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    return data.qr;
  },

  /**
   * Exécute un paiement après scan de QR
   */
  async payWithQR(qrPayload) {
    const recipientAddress = await walletService.getAddress();

    const res = await fetch(`${API_BASE}/api/qr/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrPayload, recipientAddress })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    return data;
  },

  /**
   * Transfère ZND directement entre utilisateurs (sans gage)
   */
  async transferZND(toAddress, amount) {
    const res = await fetch(`${API_BASE}/api/transfer/znd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: await walletService.getAddress(),
        to: toAddress,
        amount
      })
    });
    return res.json();
  }
};

// ─────────────────────────────────────────────
// REPUTATION SERVICE
// ─────────────────────────────────────────────

export const reputationService = {

  async getScore() {
    const address = await walletService.getAddress();
    const res = await fetch(`${API_BASE}/api/user/${address}/pledges`);
    const data = await res.json();
    return data.reputation;
  },

  async connectGithub(githubToken) {
    const address = await walletService.getAddress();
    const res = await fetch(`${API_BASE}/api/reputation/aggregate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress: address, githubToken })
    });
    return res.json();
  },

  getScoreLabel(score) {
    if (score >= 900) return { label: 'Elite', color: '#FFD700', emoji: '⭐' };
    if (score >= 700) return { label: 'Excellent', color: '#00C851', emoji: '🟢' };
    if (score >= 500) return { label: 'Bon', color: '#33B5E5', emoji: '🔵' };
    if (score >= 300) return { label: 'Moyen', color: '#FF8800', emoji: '🟡' };
    return { label: 'Débutant', color: '#CC0000', emoji: '🔴' };
  }
};

export default { walletService, pledgeService, qrService, reputationService };