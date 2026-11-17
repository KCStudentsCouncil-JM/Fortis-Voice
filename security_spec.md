# CommonGround Security Specification (Phase 0)

## 1. Data Invariants
1. **Identity & Role Integrity**: A newly created `/members/{userId}` document must have `uid == request.auth.uid`, `accountStatus == 'pending'`, and `role == 'member'` (except the bootstrapped admin email with verified token). A member can never elevate their own `role` or `accountStatus` on update.
2. **PII Isolation**: `/members/{userId}` contains `email` and is readable (`get`) only by the owner (`userId == request.auth.uid`) or a moderator, and listable only by moderators. Public petition/event/notice documents never store email addresses.
3. **Petition Lifecycle**: Non-moderator users may only create petitions in `draft` or `pending_review` status with `signatureCount == 0` and `pinned == false`. Only moderators can transition a petition to `live`, `declined`, `responded`, `achieved`, or `closed`.
4. **Signature Uniqueness & Verification**: A signature at `/petitions/{petitionId}/signatures/{userId}` may only be created or deleted by an approved verified member where `userId == request.auth.uid` and the parent petition is `live` or `responded`.
5. **Event Capacity & Ownership**: Only approved organisers or moderators may create events; only moderators or the owning organiser may delete an event.
6. **Notice Board Governance**: Only moderators may create, pin, update content, or delete notices; approved members may cast or change their single vote doc at `/notices/{noticeId}/votes/{userId}`.

## 2. The "Dirty Dozen" Attack Payloads (All Must Yield PERMISSION_DENIED)
1. **Self-Role Escalation on Create**: Member signs up with `{ role: "moderator", accountStatus: "approved" }` -> DENIED.
2. **Self-Approval on Update**: Pending member updates own `/members/{uid}` to `{ accountStatus: "approved" }` -> DENIED.
3. **PII Directory Scraping**: Approved member calls `list` on `/members` -> DENIED.
4. **Unverified Draft Bypass**: Member creates petition directly with `{ status: "live" }` -> DENIED.
5. **Self-Pinning**: Member creates or updates own petition with `{ pinned: true }` -> DENIED.
6. **Shadow Ghost Field**: Member creates petition with extra field `{ isFeaturedOverride: true }` -> DENIED.
7. **Author Spoofing**: Member creates petition with `{ authorId: "other-uid-123" }` -> DENIED.
8. **Pending Member Signing**: Member with `accountStatus == "pending"` creates `/petitions/{pid}/signatures/{uid}` -> DENIED.
9. **Double/Other-User Signing**: Approved member creates `/petitions/{pid}/signatures/other-uid` -> DENIED.
10. **Fake Official Response**: Regular member creates activity entry with `{ kind: "official_response" }` -> DENIED.
11. **Unauthorized Notice Creation**: Regular member creates a `/notices/{nid}` announcement -> DENIED.
12. **Resource Poisoning**: Attacker writes a 5,000-character document ID or 20KB title -> DENIED.
