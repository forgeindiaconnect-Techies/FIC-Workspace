# Call Signaling - Before & After Code Examples

## Issue 1: No Socket Connection Verification

### Before ❌
```typescript
async startCall(targetEmail: string, targetName: string, callerName: string) {
  if (this._state !== 'idle') return;
  this.peerEmail = targetEmail;
  this.setState('calling');
  
  // No check if socket is actually connected!
  // Could fail silently
  const offer = await pc.createOffer(...);
  this.send({ type: 'call_user', data: { targetEmail, offer } });
}
```

**Problems:**
- ❌ No verification socket is open
- ❌ Calls silently fail
- ❌ No feedback to user

### After ✅
```typescript
async startCall(targetEmail: string, targetName: string, callerName: string): Promise<boolean> {
  if (this._state !== 'idle') return false;
  
  // Verify socket connection
  if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
    console.error('[CallManager] Socket not connected');
    return false;
  }
  
  this.peerEmail = targetEmail;
  this.setState('calling');
  
  try {
    const offer = await pc.createOffer(...);
    await pc.setLocalDescription(offer);
    this.send({ type: 'call_user', data: { targetEmail, offer } });
    return true;  // Success
  } catch (err) {
    console.error('[CallManager] Offer creation failed', err);
    this.cleanupPeer();
    this.setState('idle');
    return false;  // Failure
  }
}
```

**Improvements:**
- ✅ Socket readiness check
- ✅ Return boolean indicating success
- ✅ Error handling with cleanup
- ✅ Console logging for debugging

---

## Issue 2: No Error Feedback to User

### Before ❌
```typescript
// Chat.tsx
const startCall = async () => {
  if (!selectedChat || !user) return;
  setAudioCallModal(true);
  setCallState('calling');
  await callManager.startCall(
    selectedChat.email,
    selectedChat.name,
    user.name || email
  );
  // No error handling! Call could fail silently
};
```

**Problems:**
- ❌ No error handling
- ❌ No user feedback if call fails
- ❌ Returns nothing (void)
- ❌ UI stays in "calling" state forever

### After ✅
```typescript
// Chat.tsx
const startCall = async () => {
  if (!selectedChat || !user) return;
  
  try {
    const success = await callManager.startCall(
      selectedChat.email,
      selectedChat.name,
      user.name || email
    );
    
    if (success) {
      setAudioCallModal(true);
      setCallState('calling');
    } else {
      // Clear feedback for failed call
      Alert.alert(
        'Call Failed',
        'Unable to initiate call. User may be offline or not reachable.'
      );
      setCallState('idle');
    }
  } catch (err) {
    console.error('[Chat] startCall error', err);
    Alert.alert('Call Error', 'An error occurred while trying to call.');
    setCallState('idle');
  }
};
```

**Improvements:**
- ✅ Check return value
- ✅ Show error alert if offline/failed
- ✅ Reset state on error
- ✅ Try-catch for unexpected errors

---

## Issue 3: No Message Validation

### Before ❌
```typescript
private handleMessage(msg: any) {
  if (type === 'incoming_call') {
    const { callerEmail, callerName, offer } = msg;
    // No validation! Could crash if fields missing
    this.peerEmail = callerEmail;
    this.pendingOffer = offer;
    this.setState('ringing');
    this.onIncomingCall?.(/* could be undefined */);
  }
}
```

**Problems:**
- ❌ No validation of required fields
- ❌ Could set invalid state if offer is missing
- ❌ Could crash the app

### After ✅
```typescript
private handleMessage(msg: any) {
  if (type === 'incoming_call') {
    const { callerEmail, callerName, offer } = msg;
    
    // Validate required fields
    if (!callerEmail || !offer) {
      console.warn('[CallManager] Invalid incoming_call message', msg);
      return;
    }
    
    this.peerEmail = callerEmail;
    this.pendingOffer = offer;
    this.setState('ringing');
    console.log('[CallManager] Incoming call from', callerEmail);
    this.onIncomingCall?.({ email: callerEmail, name: callerName });
  }
}
```

**Improvements:**
- ✅ Check required fields exist
- ✅ Log warning if invalid
- ✅ Prevent crashes
- ✅ Debug logging

---

## Issue 4: No Async Error Handling in UI

### Before ❌
```typescript
// IncomingCallOverlay.tsx
const handleAnswer = () => {
  clearTimeout(timeoutRef.current);
  callManager.answerCall();  // Fire and forget!
  // No error handling
};
```

**Problems:**
- ❌ Async function called without await
- ❌ Errors not caught
- ❌ No feedback if answer fails

### After ✅
```typescript
// IncomingCallOverlay.tsx
const handleAnswer = async () => {
  clearTimeout(timeoutRef.current);
  try {
    const success = await callManager.answerCall();
    if (!success) {
      console.warn('[IncomingCallOverlay] Failed to answer call');
    }
  } catch (err) {
    console.error('[IncomingCallOverlay] Answer error', err);
  }
};
```

**Improvements:**
- ✅ Await async operation
- ✅ Check return value
- ✅ Error logging
- ✅ Proper error handling

---

## Issue 5: Incomplete Offer/Answer Creation

### Before ❌
```typescript
// No try-catch, could fail silently
const offer = await pc.createOffer(...);
await pc.setLocalDescription(offer);
this.send({ type: 'call_user', data: { offer } });
```

**Problems:**
- ❌ No error handling
- ❌ Could fail without cleanup
- ❌ RTCPeerConnection stays in bad state

### After ✅
```typescript
try {
  const offer = await pc.createOffer({ offerToReceiveAudio: true });
  await pc.setLocalDescription(offer);

  this.send({
    type: 'call_user',
    data: { targetEmail, callerName, offer: pc.localDescription },
  });
  return true;
} catch (err) {
  console.error('[CallManager] Offer creation failed', err);
  this.cleanupPeer();  // Important!
  this.setState('idle');
  return false;
}
```

**Improvements:**
- ✅ Try-catch wrapping
- ✅ Proper cleanup on error
- ✅ Error logging
- ✅ Return status

---

## Issue 6: Email Case Sensitivity

### Before ❌
```typescript
// Backend
const targetWs = onlineUsers.get(targetEmail.toLowerCase().trim());
// ✅ Normalized here

// Mobile
this.send({ type: 'call_user', data: { targetEmail, ... } });
// ❌ But not normalized when sending from client!
// If user typed "Bob@Company.com" but server has "bob@company.com"
// Lookup would fail!
```

**Problems:**
- ❌ Inconsistent normalization
- ❌ Email lookup failures
- ❌ Same user registered under different case

### After ✅
```typescript
// Backend - consistent handling
const normalizedTarget = targetEmail.toLowerCase().trim();
const targetWs = onlineUsers.get(normalizedTarget);

// Mobile
// Always normalize when reading from user input
this.peerEmail = targetEmail.toLowerCase().trim();
this.send({ 
  type: 'call_user', 
  data: { 
    targetEmail: targetEmail.toLowerCase().trim(),  // Normalize
    offer 
  } 
});
```

**Improvements:**
- ✅ Consistent normalization everywhere
- ✅ Email lookups work reliably
- ✅ Case-insensitive comparison

---

## Issue 7: No Logging

### Before ❌
```typescript
private send(payload: object) {
  if (this.ws?.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify(payload));
  }
  // Silent fail - no way to debug!
}
```

**Problems:**
- ❌ Can't see what's happening
- ❌ Impossible to debug
- ❌ No visibility into failures

### After ✅
```typescript
private send(payload: object) {
  if (this.ws?.readyState === WebSocket.OPEN) {
    try {
      this.ws.send(JSON.stringify(payload));
    } catch (err) {
      console.warn('[CallManager] Send failed', err);
    }
  } else {
    console.warn('[CallManager] Socket not ready, message not sent', payload);
  }
}

// Also in handleMessage:
if (type === 'incoming_call') {
  console.log('[CallManager] Incoming call from', callerEmail);
  ...
}
```

**Improvements:**
- ✅ Logs send failures
- ✅ Logs socket not ready
- ✅ Logs important events
- ✅ Easy debugging with console

---

## Backend Issue: Offline Detection

### Before ❌
```typescript
const targetWs = onlineUsers.get(targetEmail.toLowerCase().trim());
if (!targetWs || targetWs.readyState !== WebSocket.OPEN) {
  // Silently fail
  return;  // No response to caller!
}
```

**Problems:**
- ❌ Caller gets no feedback
- ❌ Caller thinks call is ringing
- ❌ Call appears to hang

### After ✅
```typescript
const normalizedTarget = targetEmail.toLowerCase().trim();
const targetWs = onlineUsers.get(normalizedTarget);

if (!targetWs || targetWs.readyState !== WebSocket.OPEN) {
  console.log(`[CallSignaling] Target ${normalizedTarget} is offline`);
  return send(ws, { 
    type: 'call_unavailable',  // Inform caller!
    targetEmail: normalizedTarget 
  });
}

console.log(`[CallSignaling] Relaying call from ${caller} to ${target}`);
send(targetWs, { type: 'incoming_call', offer, ... });
```

**Improvements:**
- ✅ Send explicit offline message
- ✅ Caller knows user is unavailable
- ✅ Logging for debugging
- ✅ Better UX

---

## Return Type Changes

### Before ❌
```typescript
async startCall(email: string) {
  // void - no way to know if succeeded
}

declineCall() {
  // void - no feedback
}

hangUp() {
  // void - no feedback  
}
```

### After ✅
```typescript
async startCall(email: string): Promise<boolean> {
  return true;   // Success
  return false;  // Failure with logging
}

declineCall(): boolean {
  return true;   // Success
  return false;  // Failure
}

hangUp(): boolean {
  return true;   // Success
  return false;  // Failure
}
```

**Improvements:**
- ✅ Caller knows if operation succeeded
- ✅ Can show appropriate UI
- ✅ Better error handling

---

## Summary of Changes

| Category | Issue | Fix |
|----------|-------|-----|
| **Verification** | No socket check | Added `readyState === WebSocket.OPEN` |
| **Error Handling** | No try-catch | Added try-catch with cleanup |
| **Feedback** | Silent failures | Return boolean, show alerts |
| **Validation** | No message checks | Validate required fields |
| **Async** | Fire and forget | Proper await + error handling |
| **Normalization** | Case sensitivity | Consistent `.toLowerCase().trim()` |
| **Logging** | No visibility | Added comprehensive logging |
| **State** | Stuck states | Proper cleanup on error |

All changes maintain **backward compatibility** while significantly improving reliability and user experience.
