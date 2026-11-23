/**
 * @file simplePeer.js
 * Browser-native SimplePeer-compatible WebRTC implementation.
 * Wraps RTCPeerConnection to provide simple-peer event and signal semantics
 * without external npm dependencies or bundler polyfills.
 */

export class SimplePeer {
  constructor(options = {}) {
    this.initiator = Boolean(options.initiator);
    this.stream = options.stream || null;
    this.trickle = options.trickle !== false;
    this.config = options.config || {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    };

    this.listeners = {};
    this.pc = null;
    this.destroyed = false;
    this._pendingCandidates = [];

    this._init();
  }

  on(event, handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
    return this;
  }

  emit(event, ...args) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((fn) => {
        try {
          fn(...args);
        } catch (e) {
          console.warn(`SimplePeer listener error on [${event}]:`, e);
        }
      });
    }
  }

  _init() {
    const PeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
    if (!PeerConnection) {
      this.emit('error', new Error('WebRTC RTCPeerConnection is not supported in this browser.'));
      return;
    }

    try {
      this.pc = new PeerConnection(this.config);

      // Attach local candidate stream tracks if provided
      if (this.stream) {
        this.stream.getTracks().forEach((track) => {
          this.pc.addTrack(track, this.stream);
        });
      }

      // Handle ICE Candidates
      this.pc.onicecandidate = (event) => {
        if (event.candidate && this.trickle) {
          this.emit('signal', {
            type: 'candidate',
            candidate: event.candidate
          });
        }
      };

      // Handle incoming remote stream tracks
      this.pc.ontrack = (event) => {
        const remoteStream = event.streams?.[0] || new MediaStream([event.track]);
        this.emit('stream', remoteStream);
      };

      // Handle connection state changes
      this.pc.onconnectionstatechange = () => {
        if (!this.pc) return;
        const state = this.pc.connectionState;
        if (state === 'connected') {
          this.emit('connect');
        } else if (state === 'failed' || state === 'closed' || state === 'disconnected') {
          this.emit('close');
        }
      };

      // If initiator (recruiter), create offer
      if (this.initiator) {
        this._createOffer();
      }
    } catch (err) {
      this.emit('error', err);
    }
  }

  async _createOffer() {
    try {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await this.pc.setLocalDescription(offer);
      this.emit('signal', {
        type: 'offer',
        sdp: this.pc.localDescription
      });
    } catch (err) {
      this.emit('error', err);
    }
  }

  async signal(data) {
    if (this.destroyed || !this.pc) return;

    try {
      if (data.type === 'offer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp || data));
        // Process any queued ICE candidates
        while (this._pendingCandidates.length > 0) {
          const cand = this._pendingCandidates.shift();
          await this.pc.addIceCandidate(cand).catch(() => {});
        }

        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.emit('signal', {
          type: 'answer',
          sdp: this.pc.localDescription
        });
      } else if (data.type === 'answer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp || data));
        while (this._pendingCandidates.length > 0) {
          const cand = this._pendingCandidates.shift();
          await this.pc.addIceCandidate(cand).catch(() => {});
        }
      } else if (data.candidate || data.type === 'candidate') {
        const iceData = data.candidate || data;
        const candidate = new RTCIceCandidate(iceData);
        if (this.pc.remoteDescription && this.pc.remoteDescription.type) {
          await this.pc.addIceCandidate(candidate).catch(() => {});
        } else {
          this._pendingCandidates.push(candidate);
        }
      }
    } catch (err) {
      this.emit('error', err);
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      try {
        this.pc.close();
      } catch (e) {}
      this.pc = null;
    }
    this.emit('close');
  }
}

export default SimplePeer;
