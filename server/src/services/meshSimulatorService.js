// ─────────────────────────────────────────
// meshSimulatorService.js
// Software simulation of Bluetooth mesh gossip.
// 5 virtual devices, gossip protocol, bridge upload.
// ─────────────────────────────────────────
const meshSocket = require('../socket/meshSocket');

/**
 * @typedef {Object} VirtualDevice
 * @property {string} deviceId
 * @property {boolean} hasInternet
 * @property {Map<string, Object>} packets — Map<packetId, MeshPacket>
 */

/** @type {Map<string, VirtualDevice>} */
const devices = new Map();

/**
 * Seed the 5 virtual devices on startup.
 */
function seedDevices() {
  devices.clear();

  const deviceDefs = [
    { deviceId: 'phone-alice', hasInternet: false },
    { deviceId: 'phone-stranger1', hasInternet: false },
    { deviceId: 'phone-stranger2', hasInternet: false },
    { deviceId: 'phone-stranger3', hasInternet: false },
    { deviceId: 'phone-bridge', hasInternet: true },
  ];

  for (const def of deviceDefs) {
    devices.set(def.deviceId, {
      ...def,
      packets: new Map(),
    });
  }

  console.log('[MeshSim] 5 virtual devices seeded');
}

/**
 * Inject a MeshPacket into a specific device.
 * @param {string} deviceId
 * @param {Object} packet — MeshPacket { packetId, ttl, createdAt, ciphertext }
 */
function inject(deviceId, packet) {
  const device = devices.get(deviceId);
  if (!device) throw new Error(`Device ${deviceId} not found`);
  device.packets.set(packet.packetId, { ...packet });
}

/**
 * Run one round of gossip across all devices.
 * Each device shares its packets with all other devices.
 * TTL is decremented on each hop. Packets with TTL 0 don't propagate.
 *
 * @returns {{ transfers: number, deviceCounts: Object }}
 */
function gossipOnce() {
  let transfers = 0;

  // Snapshot current state (avoid same-round double-hop)
  const snapshot = new Map();
  for (const [deviceId, device] of devices) {
    snapshot.set(deviceId, new Map(device.packets));
  }

  // For each source device
  for (const [sourceId, sourcePackets] of snapshot) {
    // For each packet in source with TTL > 0
    for (const [packetId, packet] of sourcePackets) {
      if (packet.ttl <= 0) continue;

      // For each destination device (excluding source)
      for (const [destId, destDevice] of devices) {
        if (destId === sourceId) continue;

        // Only copy if destination doesn't already have this packet
        if (!destDevice.packets.has(packetId)) {
          destDevice.packets.set(packetId, {
            ...packet,
            ttl: packet.ttl - 1, // Decrement TTL on hop
          });
          transfers++;
        }
      }
    }
  }

  const deviceCounts = getDeviceCounts();
  meshSocket.emitMeshUpdate({ deviceCounts });

  return { transfers, deviceCounts };
}

/**
 * Collect all packets from bridge devices (hasInternet === true).
 * @returns {Array<{ packet: Object, bridgeDeviceId: string }>}
 */
function collectBridgeUploads() {
  const uploads = [];

  for (const [deviceId, device] of devices) {
    if (!device.hasInternet) continue;

    for (const [, packet] of device.packets) {
      uploads.push({ packet: { ...packet }, bridgeDeviceId: deviceId });
    }
  }

  return uploads;
}

/**
 * Get current packet counts per device.
 * @returns {Object} { [deviceId]: { deviceId, hasInternet, packetCount } }
 */
function getDeviceCounts() {
  const counts = {};
  for (const [deviceId, device] of devices) {
    counts[deviceId] = {
      deviceId,
      hasInternet: device.hasInternet,
      packetCount: device.packets.size,
    };
  }
  return counts;
}

/**
 * Get the full mesh state for the API.
 * @returns {{ devices: Array, idempotencyCacheSize: number }}
 */
function getState() {
  const devList = [];
  for (const [, device] of devices) {
    devList.push({
      deviceId: device.deviceId,
      hasInternet: device.hasInternet,
      packetCount: device.packets.size,
    });
  }
  return { devices: devList };
}

/**
 * Reset the mesh — clear all packets from all devices.
 */
function reset() {
  for (const [, device] of devices) {
    device.packets.clear();
  }
  console.log('[MeshSim] Mesh reset — all packets cleared');
}

module.exports = {
  seedDevices,
  inject,
  gossipOnce,
  collectBridgeUploads,
  getDeviceCounts,
  getState,
  reset,
};
