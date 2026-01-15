/**
 * Type declarations for wrtc (WebRTC Native)
 *
 * This module provides Node.js bindings for WebRTC.
 */

declare module "wrtc" {
  export class RTCPeerConnection {
    constructor(configuration?: RTCConfiguration);

    localDescription: RTCSessionDescription | null;
    remoteDescription: RTCSessionDescription | null;
    connectionState: RTCPeerConnectionState;
    iceConnectionState: RTCIceConnectionState;
    signalingState: RTCSignalingState;

    createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit>;
    createAnswer(options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit>;
    setLocalDescription(description: RTCSessionDescriptionInit): Promise<void>;
    setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void>;
    addIceCandidate(candidate?: RTCIceCandidateInit): Promise<void>;
    addTrack(track: MediaStreamTrack, ...streams: MediaStream[]): RTCRtpSender;
    close(): void;
    getTransceivers(): RTCRtpTransceiver[];

    onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null;
    ontrack: ((event: RTCTrackEvent) => void) | null;
    onconnectionstatechange: (() => void) | null;
    oniceconnectionstatechange: (() => void) | null;
    onsignalingstatechange: (() => void) | null;
  }

  export class RTCSessionDescription {
    constructor(init?: RTCSessionDescriptionInit);
    type: RTCSdpType;
    sdp: string;
  }

  export class RTCIceCandidate {
    constructor(init?: RTCIceCandidateInit);
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
  }

  export class MediaStream {
    constructor(tracks?: MediaStreamTrack[]);
    id: string;
    active: boolean;
    addTrack(track: MediaStreamTrack): void;
    removeTrack(track: MediaStreamTrack): void;
    getAudioTracks(): MediaStreamTrack[];
    getVideoTracks(): MediaStreamTrack[];
    getTracks(): MediaStreamTrack[];
  }

  export class MediaStreamTrack {
    id: string;
    kind: string;
    label: string;
    enabled: boolean;
    muted: boolean;
    readyState: MediaStreamTrackState;
    stop(): void;
  }

  export const nonstandard: {
    RTCAudioSource: typeof RTCAudioSource;
    RTCAudioSink: typeof RTCAudioSink;
    RTCVideoSource: typeof RTCVideoSource;
    RTCVideoSink: typeof RTCVideoSink;
  };

  export class RTCAudioSource {
    createTrack(): MediaStreamTrack;
    onData(data: { samples: Int16Array; sampleRate: number; bitsPerSample?: number; channelCount?: number; numberOfFrames?: number }): void;
  }

  export class RTCAudioSink {
    constructor(track: MediaStreamTrack);
    stop(): void;
    ondata: ((data: { samples: Int16Array; sampleRate: number; bitsPerSample: number; channelCount: number; numberOfFrames: number }) => void) | null;
  }

  export class RTCVideoSource {
    createTrack(): MediaStreamTrack;
    onFrame(frame: { width: number; height: number; data: Uint8ClampedArray }): void;
  }

  export class RTCVideoSink {
    constructor(track: MediaStreamTrack);
    stop(): void;
    onframe: ((frame: { width: number; height: number; data: Uint8ClampedArray }) => void) | null;
  }
}
