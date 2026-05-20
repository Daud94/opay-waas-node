# opay-waas-node

<p align="center">
  <b>A developer-first, type-safe TypeScript/JavaScript SDK for OPay Wallet-as-a-Service (WaaS) and Merchant Services.</b>
</p>

<p align="center">
  <a href="https://npmjs.org/package/opay-waas-node"><img src="https://img.shields.io/npm/v/opay-waas-node.svg" alt="NPM Version"></a>
  <a href="https://github.com/yourusername/opay-waas-node/blob/main/LICENSE"><img src="https://img.shields.io/github/license/yourusername/opay-waas-node.svg" alt="License"></a>
</p>

---

OPay’s Wallet-as-a-Service (WaaS) API is highly reliable, with industry-leading transaction success rates in NGN. However, integration is notoriously difficult due to complex signature sorting requirements, strict validation formats, double-nested response structures, and Node.js native RSA padding changes (especially in Node 21+).

`opay-waas-node` simplifies OPay down to a single client instance. It handles all **recursive payload sorting**, **RSA PKCS#1 encryption/decryption**, **SHA256withRSA signature verification**, and **strict payload sanitization** behind the scenes.

---

## ✨ Features

- 🔒 **Zero-Config Cryptography:** Automatic sorting of nested keys, RSA encryption, and signature checking.
- ⚡ **Node.js 21+ Compatibility:** Built-in auto-fallback flags resolving RSA PKCS#1 padding exceptions.
- 🧹 **Transparent Sanitization:** Sanitizes phone numbers, formats emails, limits account names cleanly using word boundaries, and structures exactly 15-character reference IDs automatically.
- 📬 **Plug-and-Play Webhooks:** Lightweight helper functions to verify OPay webhooks and normalize flat/nested payloads instantly.
- 📐 **Fully Typed:** Written entirely in TypeScript with robust DTO interfaces and inline docs.

---

## 📦 Installation

```bash
npm install opay-waas-node
```
*(Requires Node.js 16 or higher)*

---

## 🚀 Quick Start

Initialize the `OPayClient` with your integration credentials.

```typescript
import { OPayClient } from 'opay-waas-node';

const opay = new OPayClient({
  merchantId: '2561XXXXXXXXXXX',
  clientAuthKey: 'OPAYPUBXXXXXXXXXXXXXXXXX',
  publicKey: '-----BEGIN PUBLIC KEY-----\n...',  // OPay Public Key
  privateKey: '-----BEGIN PRIVATE KEY-----\n...', // Your Merchant Private Key
  baseUrl: 'https://sandbox-service.opayweb.com',
});
```

---

## 📖 Usage Guide

### 1. Provision Virtual Accounts (Static Deposit Code)
OPay uses a "Static Deposit Code" to represent dedicated virtual accounts credited to your merchant balance. The SDK automatically cleans up names, phones, and emails to fit strict validation schemas.

```typescript
try {
  const account = await opay.virtualAccounts.create({
    firstName: 'Nova',
    lastName: 'Crust Ltd',
    email: 'billing+test@novacrust.com', // Will be sanitized to 'billingtest@novacrust.com'
    phone: '+2348033333333',             // Will be sanitized to '2348033333333'
    customerCode: 'cust-unique-uuid-1',  // Will be sanitized to a 15-char alpha-numeric ID
  });

  console.log('Virtual Account Created Successfully!');
  console.log('Account Number (Deposit Code):', account.accountNumber);
  console.log('Bank Name:', account.bankName);
  console.log('Account Name:', account.accountName);
} catch (error) {
  console.error('Failed to create virtual account:', error.message);
}
```

### 2. Query Virtual Account Details
Inspect an active static deposit code details.

```typescript
const details = await opay.virtualAccounts.queryInfo('6128628185');
console.log('Account Info:', details);
```

### 3. Trigger Automated Wallet Sweeps
Transfer collected funds from a user's static deposit code to your main Merchant wallet balance.

```typescript
const sweep = await opay.sweeps.initiate({
  amount: '15000.00', // Amount in NGN
  depositCode: '6128628185',
  requestSerialNo: `sweep_${Date.now()}`,
  description: 'Automated collection sweep',
});

console.log('Sweep initiated! Order No:', sweep.orderNo);
console.log('Sweep status:', sweep.status);
```

### 4. Query Sweep Status
Check the status of any initiated sweep/transfer transaction.

```typescript
const status = await opay.sweeps.queryStatus({
  requestSerialNo: 'sweep_1716215322000',
});

console.log('Sweep status:', status.status); // 'SUCCESS', 'FAIL', 'PROCESSING'
```

---

## 📬 Webhook Handling

OPay webhooks arrive in different structures depending on the event trigger. `opay-waas-node` provides helpers to verify signature legitimacy and parse events cleanly.

```typescript
import { OPayWebhooks } from 'opay-waas-node';

app.post('/api/webhooks/opay', (req, res) => {
  const signature = req.headers['sign'] as string;
  const opayPublicKey = process.env.OPAY_PUBLIC_KEY;

  // 1. Authenticate signature
  const isGenuine = OPayWebhooks.verify(req.body, signature, opayPublicKey);
  if (!isGenuine) {
    return res.status(400).send('Invalid Signature');
  }

  // 2. Parse & Normalize (Supports flat and nested JSON events transparently)
  const event = OPayWebhooks.parseEvent(req.body);

  if (event.status === 'SUCCESS') {
    console.log(`Credit Alert! Account: ${event.depositCode}, Amount: ${event.amount}`);
    // Credit your user's wallet using event.depositCode...
  }

  res.status(200).json({ status: 'success' });
});
```

---

## ⚠️ Node.js 21+ Cryptography Notice

> [!WARNING]
> **RSA_PKCS1_PADDING is no longer supported**
> In newer Node.js runtimes (Node 21+), native OpenSSL updates deprecate or throw padding errors during classical RSA PKCS#1 integrations.
> 
> **How opay-waas-node handles this:**
> This SDK includes a fallback engine mapping that triggers a pure-JS cryptographical binding layer transparently. No additional configuration is required by you.

---

## ⚖️ License

MIT License. Feel free to use, modify, and distribute.
