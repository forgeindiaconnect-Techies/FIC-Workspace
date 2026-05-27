/**
 * callManager.ts
 *
 * Singleton that manages 1-to-1 voice calls via /ws/calls.
 * Completely separate from the Meetings WebRTC (/ws/webrtc).
 *
 * Usage:
 *   callManager.init(socketUrl, token)   — called on login
 *   callManager.destroy()                 — called on logout
 *   callManager.startCall(targetEmail, targetName) — initiate a call
 *   callManager.answerCall()              — callee answers
 *   callManager.declineCall()             — callee declines
 *   callManager.hangUp()                  — either party ends
 *   callManager.toggleMute()              — mute/unmute mic
 *
 *   callManager.onIncomingCall = (caller) => {}
 *   callManager.onCallAnswered  = () => {}
 *   callManager.onCallDeclined  = () => {}
 *   callManager.onCallEnded     = () => {}
 *   callManager.onStateChange   = (state) => {}
 */

import { getRTCPeerConnectionClass, getMediaDevices, getIceServers } from './webrtc';

export type CallState =
  | 'idle'
  | 'calling'       // outbound, waiting for answer
  | 'ringing'       // inbound, showing incoming call UI
  | 'connected'     // call is active
  | 'ended';

export interface CallerInfo {
  email: string;
  name: string;
}

class CallManager {
  private ws: WebSocket | null = null;
  private pc: any = null;                    // RTCPeerConnection
  private localStream: any = null;
  private remoteStream: any = null;

  private _state: CallState = 'idle';
  private peerEmail: string | null = null;   // who we're calling / being called by
  private pendingOffer: any = null;           // SDP offer stored while ringing
  private socketUrl: string = '';
  private token: string = '';
  private reconnectTimer: any = null;

  // ── Public event hooks ───────────────────────────────────────────────────
  onIncomingCall: ((caller: CallerInfo) => void) | null = null;
  onCallAnswered: (() => void) | null = null;
  onCallDeclined: (() => void) | null = null;
  onCallEnded: (() => void) | null = null;
  onStateChange: ((state: CallState) => void) | null = null;
  onRemoteStream: ((stream: any) => void) | null = null;

  get state() { return this._state; }
  get isMuted() { return this._isMuted; }
  private _isMuted = false;

  // ── Init / destroy ───────────────────────────────────────────────────────

  init(socketUrl: string, token: string) {
    this.socketUrl = socketUrl;
    this.token = token;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.ws) {
      const old = this.ws;
      old.onopen = null;
      old.onmessage = null;
      old.onerror = null;
      old.onclose = null;
      try {
        old.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.connect();
  }

  destroy() {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socketUrl = '';
    this.token = '';
    this.hangUp();
    if (this.ws) {
      const old = this.ws;
      old.onopen = null;
      old.onmessage = null;
      old.onerror = null;
      old.onclose = null;
      try {
        old.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
  }

  private connect() {
    if (!this.socketUrl || !this.token) return;

    // Convert http/https → ws/wss
    const wsBase = this.socketUrl
      .replace(/^http:/, 'ws:')
      .replace(/^https:/, 'wss:');

    try {
      const fullUrl = `${wsBase.replace(/\/+$/, '')}/ws/calls`;
      console.log('[CallManager] Connecting to', fullUrl);
      this.ws = new WebSocket(fullUrl);
    } catch (e) {
      console.warn('[CallManager] WebSocket create failed', e);
      return;
    }

    this.ws.onopen = () => {
      this.send({ type: 'register', data: { token: this.token } });
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch {}
    };

    this.ws.onclose = () => {
      console.warn('[CallManager] WebSocket closed');
      // Auto-reconnect after 5 s if not destroyed
      this.reconnectTimer = setTimeout(() => {
        if (this.socketUrl && this.token) this.connect();
      }, 5000);
    };

    this.ws.onerror = (err) => {
      console.error('[CallManager] WebSocket error', err);
    };
  }

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

  /** Wait until the calls WebSocket is open (or timeout). */
  private async waitForSocketOpen(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.ws?.readyState === WebSocket.OPEN) return true;
      if (this.ws?.readyState === WebSocket.CLOSING || this.ws?.readyState === WebSocket.CLOSED) {
        return false;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private setState(s: CallState) {
    this._state = s;
    this.onStateChange?.(s);
  }

  // ── Inbound message handler ──────────────────────────────────────────────

  private async handleMessage(msg: any) {
    const { type } = msg;

    if (type === 'incoming_call') {
      const { callerEmail, callerName, offer } = msg;
      if (!callerEmail || !offer) {
        console.warn('[CallManager] Invalid incoming_call message', msg);
        return;
      }
      this.peerEmail = callerEmail;
      this.pendingOffer = offer;
      this.setState('ringing');
      console.log('[CallManager] Incoming call from', callerEmail);
      this.onIncomingCall?.({ email: callerEmail, name: callerName });
      return;
    }

    if (type === 'call_answered') {
      const { answer } = msg;
      if (this.pc && answer) {
        const RTCSessionDesc = (global as any).RTCSessionDescription;
        const sdp = RTCSessionDesc ? new RTCSessionDesc(answer) : answer;
        await this.pc.setRemoteDescription(sdp).catch(console.warn);
        this.setState('connected');
        this.onCallAnswered?.();
      }
      return;
    }

    if (type === 'call_declined') {
      this.cleanupPeer();
      this.setState('ended');
      this.onCallDeclined?.();
      setTimeout(() => this.setState('idle'), 2000);
      return;
    }

    if (type === 'call_ended') {
      this.cleanupPeer();
      this.setState('ended');
      this.onCallEnded?.();
      setTimeout(() => this.setState('idle'), 1500);
      return;
    }

    if (type === 'ice_candidate') {
      const { candidate } = msg;
      if (this.pc && candidate) {
        const RTCIce = (global as any).RTCIceCandidate;
        const ice = RTCIce ? new RTCIce(candidate) : candidate;
        await this.pc.addIceCandidate(ice).catch(console.warn);
      }
      return;
    }

    if (type === 'call_unavailable') {
      this.cleanupPeer();
      this.setState('idle');
    }
  }

  // ── Outbound call ────────────────────────────────────────────────────────

  async startCall(targetEmail: string, targetName: string, callerName: string): Promise<boolean> {
    if (this._state !== 'idle') return false;

    if (!this.socketUrl || !this.token) {
      console.warn('[CallManager] Cannot start call: missing socket URL or token');
      return false;
    }

    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.connect();
    }

    const connected = await this.waitForSocketOpen(12000);
    if (!connected) {
      console.error('[CallManager] Socket not connected (timeout waiting for /ws/calls)');
      return false;
    }
    
    this.peerEmail = targetEmail;
    this.setState('calling');

    const PC = getRTCPeerConnectionClass();
    if (!PC) { 
      console.error('[CallManager] RTCPeerConnection not available');
      this.setState('idle'); 
      return false; 
    }

    const iceServers = getIceServers();
    const pc = new PC({ iceServers });
    this.pc = pc;

    // Gather local audio
    try {
      const stream = await getMediaDevices().getUserMedia({ audio: true, video: false });
      this.localStream = stream;
      stream.getTracks().forEach((t: any) => pc.addTrack(t, stream));
    } catch (err) {
      console.warn('[CallManager] Mic error', err);
      this.cleanupPeer();
      this.setState('idle');
      return false;
    }

    pc.onicecandidate = (ev: any) => {
      if (ev.candidate) {
        this.send({ type: 'ice_candidate', data: { targetEmail, candidate: ev.candidate } });
      }
    };

    pc.ontrack = (ev: any) => {
      this.remoteStream = ev.streams[0];
      this.onRemoteStream?.(ev.streams[0]);
    };

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
      this.cleanupPeer();
      this.setState('idle');
      return false;
    }
  }

  // ── Answer (callee) ──────────────────────────────────────────────────────

  async answerCall(): Promise<boolean> {
    if (this._state !== 'ringing' || !this.pendingOffer || !this.peerEmail) {
      console.warn('[CallManager] Cannot answer: not in ringing state or missing offer');
      return false;
    }

    const PC = getRTCPeerConnectionClass();
    if (!PC) {
      console.error('[CallManager] RTCPeerConnection not available');
      return false;
    }

    const iceServers = getIceServers();
    const pc = new PC({ iceServers });
    this.pc = pc;

    try {
      const stream = await getMediaDevices().getUserMedia({ audio: true, video: false });
      this.localStream = stream;
      stream.getTracks().forEach((t: any) => pc.addTrack(t, stream));
    } catch (err) {
      console.warn('[CallManager] Mic error', err);
      this.cleanupPeer();
      return false;
    }

    pc.onicecandidate = (ev: any) => {
      if (ev.candidate) {
        this.send({ type: 'ice_candidate', data: { targetEmail: this.peerEmail, candidate: ev.candidate } });
      }
    };

    pc.ontrack = (ev: any) => {
      this.remoteStream = ev.streams[0];
      this.onRemoteStream?.(ev.streams[0]);
    };

    try {
      const RTCSessionDesc = (global as any).RTCSessionDescription;
      const offerSdp = RTCSessionDesc ? new RTCSessionDesc(this.pendingOffer) : this.pendingOffer;
      await pc.setRemoteDescription(offerSdp);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.send({
        type: 'call_answer',
        data: { targetEmail: this.peerEmail, answer: pc.localDescription },
      });

      this.setState('connected');
      this.onCallAnswered?.();
      this.pendingOffer = null;
      return true;
    } catch (err) {
      console.error('[CallManager] Answer failed', err);
      this.cleanupPeer();
      this.setState('idle');
      return false;
    }
  }

  // ── Decline (callee) ────────────────────────────────────────────────────

  declineCall(): boolean {
    if (this._state !== 'ringing') {
      console.warn('[CallManager] Cannot decline: not in ringing state');
      return false;
    }
    if (!this.peerEmail) return false;

    this.send({ type: 'call_declined', data: { targetEmail: this.peerEmail } });
    this.cleanupPeer();
    this.setState('idle');
    return true;
  }

  // ── Hang up (either party) ───────────────────────────────────────────────

  hangUp(): boolean {
    if (this._state === 'idle') {
      console.warn('[CallManager] Cannot hang up: call not in progress');
      return false;
    }
    if (!this.peerEmail) return false;

    this.send({ type: 'call_ended', data: { targetEmail: this.peerEmail } });
    this.cleanupPeer();
    this.setState('idle');
    return true;
  }

  // ── Mute toggle ─────────────────────────────────────────────────────────

  toggleMute() {
    if (!this.localStream) return;
    this._isMuted = !this._isMuted;
    this.localStream.getAudioTracks().forEach((t: any) => { t.enabled = !this._isMuted; });
    return this._isMuted;
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  private cleanupPeer() {
    this.localStream?.getTracks().forEach((t: any) => t.stop());
    this.localStream = null;
    this.remoteStream = null;
    this.pc?.close();
    this.pc = null;
    this.pendingOffer = null;
    this.peerEmail = null;
    this._isMuted = false;
  }
}

// Export singleton
export const callManager = new CallManager();
