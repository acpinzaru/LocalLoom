import type { DevicePairingInput, DeviceProtocol } from './types';

export const TUYA_PREFIX_HEX = '000055aa';
export const TUYA_SUFFIX_HEX = '0000aa55';
export const MIIO_MAGIC_HEX = '2131';

// Standard IEEE 802.3 CRC-32 lookup table for Tuya v3.3 LAN framing
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32Bytes(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '').toLowerCase();
  if (clean.length % 2 !== 0 || !/^[0-9a-f]*$/.test(clean)) {
    throw new Error('Invalid hexadecimal payload');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function uint32ToBeBytes(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

function uint16ToBeBytes(value: number): Uint8Array {
  return new Uint8Array([(value >>> 8) & 0xff, value & 0xff]);
}

function readUint32Be(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function readUint16Be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 8) | bytes[offset + 1]) >>> 0;
}

export interface BuiltTuyaFrame {
  hex: string;
  byteLength: number;
  protocolVersion: '3.3' | '3.4';
  commandHex: string;
  sequence: number;
  checksumHex: string;
  headerSummary: string;
}

/**
 * Builds a standards-aligned Tuya Local LAN packet frame (TCP port 6668).
 * Layout: [4B prefix 0x000055AA][4B seqno][4B cmd][4B length][payload][4B crc32][4B suffix 0x0000AA55]
 */
export function buildTuyaLanFrame(params: {
  sequence: number;
  command: number;
  payloadJson: string;
  version: '3.3' | '3.4';
  encryptedPayloadHex?: string;
}): BuiltTuyaFrame {
  const encoder = new TextEncoder();
  const payloadBytes = params.encryptedPayloadHex
    ? hexToBytes(params.encryptedPayloadHex)
    : encoder.encode(`${params.version}\0\0\0\0\0\0\0\0\0\0\0\0${params.payloadJson}`);

  // Length field includes payload + 4-byte checksum + 4-byte suffix
  const lengthField = payloadBytes.length + 8;

  const headerAndPayload = new Uint8Array(16 + payloadBytes.length);
  headerAndPayload.set(hexToBytes(TUYA_PREFIX_HEX), 0);
  headerAndPayload.set(uint32ToBeBytes(params.sequence), 4);
  headerAndPayload.set(uint32ToBeBytes(params.command), 8);
  headerAndPayload.set(uint32ToBeBytes(lengthField), 12);
  headerAndPayload.set(payloadBytes, 16);

  const crc = crc32Bytes(headerAndPayload);
  const crcBytes = uint32ToBeBytes(crc);
  const suffixBytes = hexToBytes(TUYA_SUFFIX_HEX);

  const fullFrame = new Uint8Array(headerAndPayload.length + 8);
  fullFrame.set(headerAndPayload, 0);
  fullFrame.set(crcBytes, headerAndPayload.length);
  fullFrame.set(suffixBytes, headerAndPayload.length + 4);

  return {
    hex: bytesToHex(fullFrame),
    byteLength: fullFrame.length,
    protocolVersion: params.version,
    commandHex: `0x${params.command.toString(16).padStart(2, '0')}`,
    sequence: params.sequence,
    checksumHex: bytesToHex(crcBytes),
    headerSummary: `TCP:6668 · Tuya v${params.version} · Cmd 0x${params.command
      .toString(16)
      .padStart(2, '0')} · Seq #${params.sequence}`,
  };
}

export interface ParsedTuyaFrame {
  valid: boolean;
  error?: string;
  sequence?: number;
  command?: number;
  payloadLength?: number;
  crcValid?: boolean;
  payloadPreview?: string;
}

export function parseTuyaLanFrame(hexFrame: string): ParsedTuyaFrame {
  try {
    const bytes = hexToBytes(hexFrame);
    if (bytes.length < 24) {
      return { valid: false, error: 'Frame shorter than 24-byte minimum Tuya envelope.' };
    }
    const prefix = bytesToHex(bytes.slice(0, 4));
    const suffix = bytesToHex(bytes.slice(bytes.length - 4));
    if (prefix !== TUYA_PREFIX_HEX) {
      return { valid: false, error: `Invalid Tuya prefix (${prefix}); expected ${TUYA_PREFIX_HEX}.` };
    }
    if (suffix !== TUYA_SUFFIX_HEX) {
      return { valid: false, error: `Invalid Tuya suffix (${suffix}); expected ${TUYA_SUFFIX_HEX}.` };
    }
    const sequence = readUint32Be(bytes, 4);
    const command = readUint32Be(bytes, 8);
    const declaredLength = readUint32Be(bytes, 12);
    const actualPayloadLen = bytes.length - 24;
    if (declaredLength !== actualPayloadLen + 8) {
      return {
        valid: false,
        error: `Declared frame length (${declaredLength}) mismatches byte count (${actualPayloadLen + 8}).`,
      };
    }

    const expectedCrc = crc32Bytes(bytes.slice(0, bytes.length - 8));
    const actualCrc = readUint32Be(bytes, bytes.length - 8);
    const payloadBytes = bytes.slice(16, bytes.length - 8);
    const decodedText = new TextDecoder('utf-8', { fatal: false })
      .decode(payloadBytes)
      .replace(/\0+/g, ' ');

    return {
      valid: expectedCrc === actualCrc,
      error: expectedCrc === actualCrc ? undefined : 'CRC-32 integrity check failed.',
      sequence,
      command,
      payloadLength: actualPayloadLen,
      crcValid: expectedCrc === actualCrc,
      payloadPreview: decodedText.trim() || bytesToHex(payloadBytes),
    };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Unable to parse Tuya frame.' };
  }
}

export interface BuiltMiioFrame {
  hex: string;
  byteLength: number;
  deviceIdHex: string;
  stamp: number;
  headerSummary: string;
}

/**
 * Builds a Xiaomi miIO local UDP packet (UDP port 54321).
 * 32-byte header: [2B magic 0x2131][2B length][4B unknown 0x00000000][4B deviceId][4B stamp][16B checksum/token]
 */
export function buildXiaomiMiioFrame(params: {
  deviceIdHex: string;
  stamp: number;
  tokenHex: string;
  payloadJson: string;
  encryptedPayloadHex?: string;
}): BuiltMiioFrame {
  const cleanDeviceId = params.deviceIdHex.replace(/^0x/i, '').padStart(8, '0').slice(0, 8);
  const cleanToken = params.tokenHex.replace(/\s+/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(cleanToken)) {
    throw new Error('Xiaomi miIO token must be exactly 32 hexadecimal characters (128-bit).');
  }

  const encoder = new TextEncoder();
  const payloadBytes = params.encryptedPayloadHex
    ? hexToBytes(params.encryptedPayloadHex)
    : encoder.encode(params.payloadJson);
  const totalLength = 32 + payloadBytes.length;

  const frame = new Uint8Array(totalLength);
  frame.set(hexToBytes(MIIO_MAGIC_HEX), 0);
  frame.set(uint16ToBeBytes(totalLength), 2);
  frame.set(new Uint8Array([0, 0, 0, 0]), 4);
  frame.set(hexToBytes(cleanDeviceId), 8);
  frame.set(uint32ToBeBytes(params.stamp), 12);
  frame.set(hexToBytes(cleanToken), 16);
  frame.set(payloadBytes, 32);

  return {
    hex: bytesToHex(frame),
    byteLength: totalLength,
    deviceIdHex: cleanDeviceId,
    stamp: params.stamp,
    headerSummary: `UDP:54321 · Xiaomi miIO · DID 0x${cleanDeviceId} · Stamp ${params.stamp}`,
  };
}

export interface ParsedMiioFrame {
  valid: boolean;
  error?: string;
  totalLength?: number;
  deviceIdHex?: string;
  stamp?: number;
  checksumHex?: string;
  payloadLength?: number;
  payloadPreview?: string;
}

export function parseXiaomiMiioFrame(hexFrame: string): ParsedMiioFrame {
  try {
    const bytes = hexToBytes(hexFrame);
    if (bytes.length < 32) {
      return { valid: false, error: 'miIO packet shorter than 32-byte mandatory header.' };
    }
    const magic = bytesToHex(bytes.slice(0, 2));
    if (magic !== MIIO_MAGIC_HEX) {
      return { valid: false, error: `Invalid miIO magic bytes (${magic}); expected ${MIIO_MAGIC_HEX}.` };
    }
    const totalLength = readUint16Be(bytes, 2);
    if (totalLength !== bytes.length) {
      return {
        valid: false,
        error: `Declared miIO packet length (${totalLength}) does not match actual size (${bytes.length}).`,
      };
    }
    const deviceIdHex = bytesToHex(bytes.slice(8, 12));
    const stamp = readUint32Be(bytes, 12);
    const checksumHex = bytesToHex(bytes.slice(16, 32));
    const payloadBytes = bytes.slice(32);
    const payloadPreview = new TextDecoder('utf-8', { fatal: false }).decode(payloadBytes);

    return {
      valid: true,
      totalLength,
      deviceIdHex,
      stamp,
      checksumHex,
      payloadLength: payloadBytes.length,
      payloadPreview: payloadPreview || '(Hello / Keepalive frame)',
    };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Unable to parse miIO frame.' };
  }
}

export function isValidIpv4(ip: string): boolean {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
}

export function isValidMac(mac: string): boolean {
  return /^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(mac.trim());
}

export function getDefaultPortForProtocol(protocol: DeviceProtocol): number {
  switch (protocol) {
    case 'tuya-lan-v34':
    case 'tuya-lan-v33':
      return 6668;
    case 'xiaomi-miio':
      return 54321;
    case 'shelly-rpc':
      return 80;
    case 'matter-local':
      return 5540;
    case 'esphome-api':
      return 6053;
  }
}

export function getProtocolLabel(protocol: DeviceProtocol): string {
  switch (protocol) {
    case 'tuya-lan-v34':
      return 'Tuya LAN v3.4';
    case 'tuya-lan-v33':
      return 'Tuya LAN v3.3';
    case 'xiaomi-miio':
      return 'Xiaomi miIO UDP';
    case 'shelly-rpc':
      return 'Shelly Gen2 RPC';
    case 'matter-local':
      return 'Matter Local IPv6';
    case 'esphome-api':
      return 'ESPHome Native API';
  }
}

export interface PairingValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof DevicePairingInput, string>>;
}

export function validateDevicePairingInput(input: DevicePairingInput): PairingValidationResult {
  const errors: Partial<Record<keyof DevicePairingInput, string>> = {};

  if (!input.name.trim() || input.name.trim().length < 2) {
    errors.name = 'Enter a descriptive device name (at least 2 characters).';
  }
  if (!input.room.trim()) {
    errors.room = 'Specify a room or zone.';
  }
  if (!isValidIpv4(input.ip)) {
    errors.ip = 'Enter a valid local IPv4 address (for example, 192.168.10.45).';
  }
  if (!isValidMac(input.mac)) {
    errors.mac = 'Enter a valid MAC address (for example, A4:C1:38:4F:10:9B).';
  }

  const cred = input.localCredential.trim();
  if (input.protocol === 'tuya-lan-v34' || input.protocol === 'tuya-lan-v33') {
    if (cred.length !== 16) {
      errors.localCredential = 'Tuya LAN localKey must be exactly 16 ASCII bytes.';
    }
  } else if (input.protocol === 'xiaomi-miio') {
    if (!/^[0-9a-fA-F]{32}$/.test(cred)) {
      errors.localCredential = 'Xiaomi miIO local token must be exactly 32 hexadecimal characters.';
    }
  } else if (cred.length < 8) {
    errors.localCredential = 'Provide a local pairing secret or PSK (at least 8 characters).';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function maskLocalCredential(credential: string): string {
  const trimmed = credential.trim();
  if (trimmed.length <= 6) return '••••••';
  return `${trimmed.slice(0, 3)}••••••••${trimmed.slice(-3)}`;
}
