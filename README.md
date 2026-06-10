# UPI Offline Mesh 🌐📱
> Deferred Settlement Simulator for Offline Digital Payments

UPI Offline Mesh is a full-stack proof-of-concept demonstrating how secure, offline digital payments can be routed through a peer-to-peer Bluetooth/Wi-Fi Direct mesh network until one node reaches the internet to perform deferred settlement. This project showcases deep expertise in hybrid cryptography, concurrent transaction safety, and distributed systems.

![MongoDB](https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)

### Features & Security Loopholes Fixed
This simulator implements a rigorous 11-step backend ingestion pipeline that secures against 10 critical distributed systems vulnerabilities:
1. **Tampering:** Hybrid RSA-2048 + AES-256-GCM encryption prevents packet modification.
2. **Double Spending:** Redis-backed idempotency prevents replay attacks.
3. **Stale Packets:** 24-hour freshness window enforcement.
4. **Future-dated Packets:** NTP-drift tolerance (max 5 minutes future allowance).
5. **TTL Manipulation:** Mesh hop-count integrity checks.
6. **Concurrent Balance Overdraft:** Mongoose ACID transactions prevent race conditions during settlement.
7. **Identity Spoofing:** Strict sender/receiver VPA verification.
8. **Invalid PINs:** Bcrypt PIN hashing and server-side validation.
9. **Amount Cap Exploits:** Strict validation preventing exorbitant amounts.
10. **Bridge Node Malice:** Bridge nodes only hold ciphertexts and cannot read/tamper with transactions.

---

## 1. What This Project Proves
This project proves that it is mathematically and systematically possible to conduct secure financial transactions in zero-connectivity environments (e.g., airplanes, remote villages, disaster zones). By leveraging a decentralized "gossip" protocol, encrypted transaction intents can securely bounce between stranger devices until a "bridge" node (a device with internet access) uploads them for final backend settlement, without ever compromising sender/receiver data or enabling double-spend attacks.

---

## 2. System Architecture

```text
 📱 Alice (Sender - Offline)
   │
   ├── 1. Enter PIN, Amount, Receiver (Bob)
   ├── 2. Encrypts instruction (RSA-OAEP + AES-256-GCM)
   └── 3. Generates MeshPacket (Ciphertext + TTL)
         │
         ▼ (Bluetooth/Wi-Fi Direct Gossip)
 📱 Stranger 1 (Offline) ────────► 📱 Stranger 2 (Offline)
                                         │
                                         ▼ (Gossip)
                                   📱 Bridge Node (Gets 4G)
                                         │
                                         ├── 4. HTTPS POST /bridge/ingest
                                         ▼
 ☁️ Backend Server (Node.js)
   │
   ├── Hash Ciphertext
   ├── Redis Idempotency Check (Drop duplicates)
   ├── Decrypt (RSA Private Key)
   ├── Check Freshness & TTL
   ├── Verify PIN (Bcrypt)
   └── MongoDB ACID Transaction (Debit Alice, Credit Bob)
         │
         ▼
 💻 React Dashboard
   └── Socket.io pushes real-time ledger updates
```

---

## 3. Three Hard Problems
1. **The Double Spend Problem (Replay Attacks):** Because multiple stranger phones might independently reach the internet and upload Alice's exact same packet, the backend must flawlessly drop duplicates. This is solved using a fast `Redis` idempotency cache backed by a MongoDB unique constraint as a fallback.
2. **The "Malicious Courier" Problem:** Strangers' phones carrying the packet could try to modify the amount or receiver. This is solved using Hybrid Encryption (AES-256-GCM for payload, RSA for key exchange). Any tampering invalidates the AES-GCM Auth Tag and the packet is instantly dropped.
3. **Atomic Settlement:** If Alice rapid-fires 5 payments offline, but only has balance for 1, the backend must process concurrent uploads safely. This is solved using MongoDB Replica Sets and `startTransaction()` to ensure balance checks and debits are strictly atomic.

---

## Project Structure
```
upi-offline-mesh/
├── client/                 # React Frontend (Vite)
│   ├── src/
│   │   ├── components/     # UI Components (Dashboard, Visualizer, Ledger)
│   │   ├── api.js          # Axios API calls
│   │   └── socket.js       # Socket.io client setup
├── server/                 # Node.js + Express Backend
│   ├── src/
│   │   ├── crypto/         # Hybrid RSA/AES Encryption logic
│   │   ├── models/         # Mongoose Schemas (Account, Transaction, AuditLog)
│   │   ├── routes/         # REST API endpoints
│   │   ├── services/       # Core business logic (Settlement, Ingestion, Mesh Sim)
│   │   ├── socket/         # Socket.io event emitters
│   │   └── app.js          # Express app bootstrap
└── README.md
```

## How to Run Locally

### Prerequisites
- Node.js (v18+)
- MongoDB running locally or via Atlas (Must support Replica Sets for transactions)
- Redis running locally or via Docker
- Git

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/VedantPawar05/upi-offline-mesh.git
   cd upi-offline-mesh
   ```
2. Setup environment variables:
   Create a `.env` file in the `server/` directory using `.env.example` as a template.
3. Install dependencies:
   ```bash
   # Terminal 1: Backend
   cd server
   npm install

   # Terminal 2: Frontend
   cd client
   npm install
   ```
4. Start the servers:
   ```bash
   # Terminal 1: Backend
   cd server
   npm run dev

   # Terminal 2: Frontend
   cd client
   npm run dev
   ```

## The Demo Flow
To test the simulator from the React dashboard:
1. **Inject Payment:** Simulate Alice creating an offline transaction. It lands in Alice's virtual queue.
2. **Gossip Mesh:** Click "Run Gossip Round" to simulate devices walking past each other. The packet duplicates to stranger nodes.
3. **Flush Bridges:** Click "Flush Bridges" to simulate a bridge node getting 4G/Wi-Fi and uploading the packets.
4. **Observe Settlement:** The transaction will appear in the Settlement Ledger, Alice's balance decreases, and Bob's increases—all updated in real-time.

## Running Tests
Navigate to the `server/` directory and run:
```bash
npm test
```
**What the tests prove:**
- Cryptographic integrity (tampering prevention).
- Replay attack prevention via Redis idempotency.
- Concurrency control (handling multiple identical packets simultaneously).
- Proper TTL and timestamp bounds checking.

---

## Screenshots
*(Add placeholder for screenshots here)*

---

## 4. What's NOT Real (Production Gap Table)

| What's in this demo | What it would be in production |
|---------------------|-------------------------------|
| In-process RSA keypair regenerated on startup | HSM — AWS KMS or HashiCorp Vault |
| Redis local instance | Redis Cluster with replicas |
| MongoDB local | MongoDB Atlas with replica set |
| Software mesh simulator | Real BLE GATT or Wi-Fi Direct |
| Seeded demo accounts | Real KYC'd users, real VPAs |
| JWT for bridge auth | Mutual TLS with signed certificates |
| `console.log` | Structured logging — Winston/Pino to SIEM |
| Single Node.js instance | Horizontally scaled cluster behind load balancer |

---

## 5. Honest Limitations
- **Latency vs Connectivity:** Offline payments are inherently asynchronous. Bob won't know he got paid until the mesh resolves, requiring strong UX trust mechanisms.
- **Payload Size:** RSA-2048 encrypting an AES key limits payload scale. Very large sets of instructions would require batched chunking.
- **Mesh Partitioning:** If Alice pays Bob, but both remain isolated from any bridge node indefinitely, the transaction will eventually expire (stale packet) and never settle.

---

## 6. Troubleshooting
- **`FATAL: Redis connection failed`**: Ensure your Redis server/Docker container is actually running on port 6379.
- **`FATAL: MongoDB session failed`**: MongoDB must be running as a Replica Set to support ACID transactions. If using a standalone local MongoDB, you need to configure it as a single-node replica set.
- **`Socket.io Connection Error`**: Ensure the backend is running on `PORT=3001` and Vite proxy in `client/vite.config.js` is targeting the correct backend URL.

---
*MIT License*
