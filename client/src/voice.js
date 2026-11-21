// Party voice chat over WebRTC. Audio goes straight between friends' devices;
// the server only passes along the connection messages, and only between
// players who are friends with each other. Nothing is recorded.
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

export const voiceSupported = () =>
  typeof window !== 'undefined' && !!window.RTCPeerConnection && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;

export class VoiceChat {
  constructor(socket, myId, { onChange } = {}) {
    this.socket = socket;
    this.myId = myId;
    this.onChange = onChange;
    this.peers = new Map(); // id -> { pc, audio, muted }
    this.stream = null;
    this.talking = false;
    this.openMic = false;
    this.volume = 1;
    this.handlers = {
      'voice:peers': ({ peers }) => peers.forEach((id) => this.connect(id)),
      'voice:peer-joined': ({ id }) => this.connect(id),
      'voice:signal': ({ from, data }) => this.onSignal(from, data),
      'voice:peer-left': ({ id }) => this.drop(id),
    };
    for (const [evt, fn] of Object.entries(this.handlers)) socket.on(evt, fn);
  }

  get on() {
    return !!this.stream;
  }

  emitChange() {
    this.onChange?.({ on: this.on, talking: this.talking || this.openMic, openMic: this.openMic, peers: [...this.peers.keys()], muted: [...this.peers].filter(([, p]) => p.muted).map(([id]) => id) });
  }

  async enable() {
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    this.applyMic();
    this.socket.emit('voice:ready');
    this.emitChange();
  }

  disable() {
    for (const id of [...this.peers.keys()]) this.drop(id);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.talking = false;
    this.socket.emit('voice:leave');
    this.emitChange();
  }

  applyMic() {
    const live = this.talking || this.openMic;
    this.stream?.getAudioTracks().forEach((t) => {
      t.enabled = live;
    });
  }

  setTalking(on) {
    if (!this.stream || this.talking === on) return;
    this.talking = on;
    this.applyMic();
    if (!this.openMic) this.socket.emit('voice:talking', on);
    this.emitChange();
  }

  setOpenMic(on) {
    this.openMic = on;
    this.applyMic();
    if (this.stream) this.socket.emit('voice:talking', on);
    this.emitChange();
  }

  setVolume(v) {
    this.volume = v;
    for (const p of this.peers.values()) p.audio.volume = v;
  }

  mute(id, muted) {
    const p = this.peers.get(id);
    if (!p) return;
    p.muted = muted;
    p.audio.muted = muted;
    this.emitChange();
  }

  peer(id) {
    if (this.peers.has(id)) return this.peers.get(id);
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const audio = new Audio();
    audio.autoplay = true;
    audio.volume = this.volume;
    const p = { pc, audio, muted: false };
    this.peers.set(id, p);
    this.stream?.getTracks().forEach((t) => pc.addTrack(t, this.stream));
    pc.onicecandidate = (e) => e.candidate && this.socket.emit('voice:signal', { to: id, data: { candidate: e.candidate } });
    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0];
      audio.play().catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.drop(id);
    };
    this.emitChange();
    return p;
  }

  // The player with the "smaller" id starts each call, so two calls never cross.
  async connect(id) {
    if (!this.stream || id === this.myId || this.myId > id) return;
    const { pc } = this.peer(id);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.socket.emit('voice:signal', { to: id, data: { sdp: pc.localDescription } });
  }

  async onSignal(from, data) {
    if (!this.stream || !data) return;
    const { pc } = this.peer(from);
    try {
      if (data.sdp) {
        await pc.setRemoteDescription(data.sdp);
        if (data.sdp.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.socket.emit('voice:signal', { to: from, data: { sdp: pc.localDescription } });
        }
      } else if (data.candidate) {
        await pc.addIceCandidate(data.candidate);
      }
    } catch {
      /* a bad message just gets ignored */
    }
  }

  drop(id) {
    const p = this.peers.get(id);
    if (!p) return;
    p.pc.close();
    p.audio.srcObject = null;
    this.peers.delete(id);
    this.emitChange();
  }

  destroy() {
    this.disable();
    for (const [evt, fn] of Object.entries(this.handlers)) this.socket.off(evt, fn);
  }
}
