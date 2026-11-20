# Contributing to LocalLoom

Thank you for helping build a cloud-free, globally interoperable smart home hub.

## How to Contribute a New Device Protocol Plugin

1. **Reverse-Engineer Local Traffic**: Capture local LAN packets between the target device and mobile app on an isolated IoT VLAN using Wireshark. Confirm all control flows work with WAN egress blocked.
2. **Implement Pure Codec First**: Add pure TypeScript frame encoders/decoders under `src/core/` with deterministic unit tests in `node:test`.
3. **Declare Minimal Sandbox Permissions**: Every plugin manifest must explicitly list only the local TCP/UDP ports and mDNS service types it needs (`lan:tcp:6668`, `lan:udp:54321`, `keystore:read-scoped`). No outbound internet sockets are permitted.
4. **Verify Privacy & Security Invariants**:
   - No hardcoded vendor cloud URLs or telemetry beacons.
   - All device tokens/localKeys must be stored via the hub's AES-256-GCM vault abstraction (Android Keystore on mobile).
   - Include replay protection bounds (sequence numbers or monotonic timestamps).
5. **Submit Pull Request**: Ensure `npm run lint`, `npm run build`, and `npx --yes tsx --test src/core/core.test.ts` pass cleanly.
