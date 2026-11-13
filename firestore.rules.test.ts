/**
 * Security Rule Verification Specification (Dirty Dozen Test Matrix)
 * Targets: firestore.rules
 *
 * Each test verifies that the adversarial payload is rejected with PERMISSION_DENIED.
 */

export const DIRTY_DOZEN_CASES = [
  {
    name: '1. Identity Spoofing on Room Create',
    path: '/rooms/APG101',
    operation: 'create',
    auth: { uid: 'attacker', email_verified: true },
    payload: {
      roomId: 'APG101',
      hostUid: 'victim_uid',
      title: 'Spoofed Mission',
      status: 'designing',
      memberCount: 1,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Ghost Field / Shadow Update',
    path: '/rooms/APG101',
    operation: 'update',
    auth: { uid: 'host', email_verified: true },
    payload: { busId: 'hex-core', isVerified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Unverified Email Write',
    path: '/missions/m_001',
    operation: 'create',
    auth: { uid: 'user1', email_verified: false },
    payload: { ownerUid: 'user1', totalScore: 420 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. 5th Player Capacity Bypass',
    path: '/rooms/APG101',
    operation: 'update',
    auth: { uid: 'player5', email_verified: true },
    existingData: { memberCount: 4, status: 'designing' },
    payload: { memberCount: 5 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Orphan Member Creation without Room',
    path: '/rooms/MISSING99/members/attacker',
    operation: 'create',
    auth: { uid: 'attacker', email_verified: true },
    payload: { uid: 'attacker', displayName: 'Rogue', role: 'director', ready: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Terminal State Mutation on Completed Room',
    path: '/rooms/APG101',
    operation: 'update',
    auth: { uid: 'host', email_verified: true },
    existingData: { status: 'completed', finalScore: 390 },
    payload: { finalScore: 500 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. PII Read Leak across Users',
    path: '/users/userA/private/info',
    operation: 'get',
    auth: { uid: 'userB', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. ID Poisoning with Invalid Characters',
    path: '/rooms/bad$$$room',
    operation: 'create',
    auth: { uid: 'user1', email_verified: true },
    payload: { roomId: 'bad$$$room' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Unbounded Array Injection (>4 instruments)',
    path: '/rooms/APG101',
    operation: 'update',
    auth: { uid: 'host', email_verified: true },
    payload: {
      instrumentIds: ['a', 'b', 'c', 'd', 'e', 'f'],
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Client Timestamp Forgery',
    path: '/missions/m_002',
    operation: 'create',
    auth: { uid: 'user1', email_verified: true },
    payload: { ownerUid: 'user1', createdAt: '1999-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Non-Member Subcollection Message Write',
    path: '/rooms/APG101/messages/msg1',
    operation: 'create',
    auth: { uid: 'outsider', email_verified: true },
    payload: { senderUid: 'outsider', text: 'Hijack', kind: 'chat' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Value Poisoning on Whitelisted Key',
    path: '/rooms/APG101',
    operation: 'update',
    auth: { uid: 'host', email_verified: true },
    payload: { solarSizing: 'unlimited' },
    expected: 'PERMISSION_DENIED',
  },
] as const;
