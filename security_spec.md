# Security Specification for Knockers SMP

## Data Invariants
1. A User profile must be owned by the authenticated user (`uid`).
2. A Username is unique and maps to exactly one UID.
3. Friend requests can only be sent between different users.
4. Chat threads are only accessible by their listed participants.
5. Messages in a thread inherit access from the parent thread.
6. Coins and progress can only be updated by the owner.

## The Dirty Dozen Payloads (Rejection Tests)
1. **Identity Spoofing**: Attempt to create a user profile with a UID different from `auth.uid`.
2. **Username Hijacking**: Attempt to claim a username already mapped to another UID.
3. **Ghost Progress**: Attempt to update another user's coin balance.
4. **Chat Eavesdropping**: Attempt to read messages in a thread where `auth.uid` is not in `participants`.
5. **Friend Request Forgery**: Attempt to accept a friend request intended for another user.
6. **Self-Friending**: Attempt to send a friend request to oneself.
7. **Bypassing Uniqueness**: Attempt to update one's own username to a taken name without checking `/usernames/`.
8. **Malicious ID Injection**: Attempt to create a document with a massive (1MB) ID string.
9. **State Shortcut**: Attempt to set a friend request status to 'accepted' without the recipient's consent.
10. **Type Mismatch**: Attempt to set `coins` to a string instead of a number.
11. **Shadow Message**: Attempt to write a message in a chat as another participant.
12. **PII Leak**: Attempt to list all usernames (this should be allowed for search, but listing all users should be restricted).

## Rules Logic Draft
- `isValidUser(data)`: Enforces `name`, `coins`, `ownedKits`, `ownedRoles` types and sizes.
- `isOwner(id)`: `request.auth.uid == id`.
- `isParticipant(chatId)`: `request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants`.

## Resource Access Matrix
| Collection | Read | Create | Update | Delete |
| :--- | :--- | :--- | :--- | :--- |
| `/users/{uid}` | `isOwner(uid)` | `isOwner(uid) && isValidUser(request.resource.data)` | `isOwner(uid) && isValidUser(request.resource.data)` | `isOwner(uid)` |
| `/usernames/{name}` | `true` | `isSignedIn() && request.resource.data.uid == request.auth.uid` | `false` | `isSignedIn() && resource.data.uid == request.auth.uid` |
| `/chats/{chatId}` | `isSignedIn() && request.auth.uid in resource.data.participants` | `isSignedIn() && request.resource.data.participants.size() == 2 && request.auth.uid in request.resource.data.participants` | `isSignedIn() && request.auth.uid in resource.data.participants` | `false` |
| `/chats/{chatId}/messages/{msgId}`| `isParticipant(chatId)` | `isParticipant(chatId) && request.resource.data.senderId == request.auth.uid` | `false` | `false` |
