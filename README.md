# LocalLoom — Open-Source Local-First Cross-Brand Smart Home Hub

LocalLoom replaces proprietary vendor cloud apps (**Smart Life**, **Tuya Smart**, **Xiaomi Mi Home**, **Yeelight**, **Shelly Cloud**) with a single, privacy-first local hub and installable Android PWA / Kotlin companion architecture.

## Why LocalLoom?
- **Zero Cloud APIs**: Communicates directly with hardware over local TCP/UDP sockets (`TCP:6668` for Tuya LAN v3.3–v3.5, `UDP:54321` for Xiaomi miIO, `UDP:5540` for Matter, `HTTP/WS` for Shelly Gen2 RPC).
- **Works Everywhere Globally**: Operates identically regardless of continent, regional cloud outages, or vendor account lock-in.
- **VPN & Proxy Ready**: Native WireGuard VPN, SOCKS5, and HTTP proxy routing for remote household access without port-forwarding or third-party cloud relays.
- **Compliance by Design**: Built-in policy controls and auditable checks aligned with **NIS2 (EU 2022/2555)**, **NIST SP 800-213 / CSF 2.0**, **GDPR (Art. 20, 25, 32)**, and **ETSI EN 303 645**.
- **Modular Plugin Sandbox**: Developers can add reverse-engineered adapters for additional IoT brands without touching core hub internals.

## Quick Start
```bash
npm install
npm run dev
```

## Running Unit Tests
```bash
npx --yes tsx --test src/core/core.test.ts
```

## Documentation
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Open-source contribution guide & plugin submission checklist.
- [docs/PROTOCOLS.md](./docs/PROTOCOLS.md) — Reverse-engineered local protocol frame specifications (Tuya LAN, Xiaomi miIO, Matter).
- [docs/ANDROID_ARCHITECTURE.md](./docs/ANDROID_ARCHITECTURE.md) — Android Kotlin Coroutines, Android Keystore, NsdManager, and WireGuard VPN integration guide.
