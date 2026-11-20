# Reverse-Engineered Local Protocol Reference

## 1. Tuya / Smart Life Local LAN (v3.3 & v3.4)
- **Discovery**: UDP broadcasts on ports `6666` (unencrypted) and `6667` (AES-128-ECB with MD5(`yGAdlopoPVldABfn`)).
- **Control Transport**: TCP port `6668`.
- **Frame Envelope**:
  `[0x000055AA (4B)][SeqNo (4B)][Command (4B)][Length (4B)][Encrypted DPS Payload][CRC32 or HMAC-SHA256][0x0000AA55 (4B)]`
- **Security**: Each device requires its unique 16-byte `localKey`. In v3.4/v3.5, session keys are negotiated with random nonces and authenticated via HMAC-SHA256.

## 2. Xiaomi miIO Local UDP Protocol
- **Discovery**: Broadcast 32-byte Hello packet `21310020ffffffffffffffffffffffffffffffffffffffffffffffffffffffff` to UDP port `54321`.
- **Header (32 bytes)**:
  `[0x2131 (2B)][Length (2B)][Unknown 0x00000000 (4B)][DeviceID (4B)][Timestamp (4B)][MD5 Checksum (16B)]`
- **Encryption**:
  - `key = MD5(token)`
  - `iv = MD5(key || token)`
  - Payload encrypted using `AES-128-CBC` with PKCS#7 padding.

## 3. Android Kotlin Local Socket & VPN Architecture
- **Networking**: Kotlin Coroutines with `java.nio.channels.DatagramChannel` / `SocketChannel` bound to `ConnectivityManager` Wi-Fi or `VpnService` active WireGuard interface.
- **Discovery**: `android.net.nsd.NsdManager` for mDNS (`_miio._udp`, `_matter._tcp`, `_esphomelib._tcp`) + multicast lock for UDP discovery.
- **Key Storage**: Android Keystore (`StrongBox` / TEE) wrapping the 256-bit AES-GCM vault master key; device localKeys never exist unencrypted on flash storage.
