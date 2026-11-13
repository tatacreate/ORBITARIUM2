# Security Specification — APOGEE Space Mission Architect

## 1. Data Invariants
1. **PII Isolation**: User email addresses are stored exclusively in `/users/{userId}/private/info` and are readable/writable only by `request.auth.uid == userId` with verified email. `/users/{userId}` holds only public non-PII display callsign and aggregate stats.
2. **Host & Seat Integrity**: A room in `/rooms/{roomId}` can only be created when `hostUid == request.auth.uid`, `memberCount == 1`, `status == 'designing'`, and the host's `/rooms/{roomId}/members/{uid}` seat is created atomically in the same batch (`existsAfter`).
3. **4-Player Room Capacity**: Joining a room requires an atomic batch creating `/rooms/{roomId}/members/{uid}` and incrementing `memberCount` by exactly `1` up to a hard ceiling of `4`.
4. **Master Gate Membership**: Only current members of `/rooms/{roomId}/members/{uid}` may read or mutate room subsystem configurations, post messages, or update their own member seat.
5. **Terminal State Locking**: Once a room reaches `status == 'completed'`, all configuration and status updates are permanently locked.
6. **Temporal Integrity & Immutability**: `createdAt`, `updatedAt`, and `joinedAt` must equal `request.time`. `hostUid`, `roomId`, `ownerUid`, `senderUid`, and `createdAt` are immutable after creation.
7. **Strict Query Scoping**: All `allow list` rules strictly filter on `resource.data.hostUid == request.auth.uid` or `resource.data.ownerUid == request.auth.uid` (or room membership on subcollections via `get()` only on single-doc or scoped subcollection where parent room membership is checked — note: no `get()` in top-level `allow list`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on Room Create**: `{ hostUid: "victim_uid", ... }` by attacker -> `PERMISSION_DENIED`.
2. **Ghost Field / Shadow Update**: Updating `/rooms/{roomId}` with `{ busId: "hex-core", isVerified: true }` -> `PERMISSION_DENIED`.
3. **Unverified Email Write**: Creating a mission record with `request.auth.token.email_verified == false` -> `PERMISSION_DENIED`.
4. **5th Player Capacity Bypass**: Joining a room where `memberCount == 4` -> `PERMISSION_DENIED`.
5. **Orphan Member Creation**: Creating `/rooms/NONEXISTENT/members/{uid}` without an existing parent room -> `PERMISSION_DENIED`.
6. **Terminal State Mutation**: Updating `busId` or `finalScore` when existing room `status == 'completed'` -> `PERMISSION_DENIED`.
7. **PII Read Leak**: Authenticated User B calling `get` on `/users/userA/private/info` -> `PERMISSION_DENIED`.
8. **ID Poisoning**: Creating `/rooms/invalid$$$id_with_1500_chars...` -> `PERMISSION_DENIED`.
9. **Unbounded Array Injection**: Setting `instrumentIds` with 10 elements on `/rooms/{roomId}` -> `PERMISSION_DENIED`.
10. **Client Timestamp Forgery**: Creating a mission record with `createdAt: Timestamp(1999)` instead of `serverTimestamp()` -> `PERMISSION_DENIED`.
11. **Non-Member Subcollection Write**: User C (not in `members`) posting to `/rooms/{roomId}/messages/{msgId}` -> `PERMISSION_DENIED`.
12. **Type Poisoning on Whitelisted Key**: Updating `solarSizing` to `"unlimited"` (string instead of number) -> `PERMISSION_DENIED`.
