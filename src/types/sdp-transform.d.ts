/**
 * Type declarations for sdp-transform
 *
 * SDP (Session Description Protocol) parser and serializer.
 */

declare module "sdp-transform" {
  export interface SessionDescription {
    version?: number;
    icelite?: string;
    origin?: {
      username: string;
      sessionId: string;
      sessionVersion: number;
      netType: string;
      ipVer: number;
      address: string;
    };
    name?: string;
    timing?: {
      start: number;
      stop: number;
    };
    connection?: {
      version: number;
      ip: string;
    };
    media: MediaDescription[];
    groups?: Array<{
      type: string;
      mids: string;
    }>;
    msidSemantic?: {
      semantic: string;
      token: string;
    };
    fingerprint?: {
      type: string;
      hash: string;
    };
    setup?: string;
    iceUfrag?: string;
    icePwd?: string;
    iceOptions?: string;
  }

  export interface MediaDescription {
    rtp: RTPCodec[];
    fmtp: FMTP[];
    type: string;
    port: number;
    protocol: string;
    payloads?: string;
    connection?: {
      version: number;
      ip: string;
    };
    rtcp?: {
      port: number;
      netType: string;
      ipVer: number;
      address: string;
    };
    candidates?: Candidate[];
    iceUfrag?: string;
    icePwd?: string;
    fingerprint?: {
      type: string;
      hash: string;
    };
    setup?: string;
    mid?: string;
    direction?: "sendrecv" | "sendonly" | "recvonly" | "inactive";
    ext?: Array<{
      value: number;
      direction?: string;
      uri: string;
      config?: string;
    }>;
    rtcpMux?: string;
    rtcpRsize?: string;
    ssrcs?: SSRC[];
    ssrcGroups?: Array<{
      semantics: string;
      ssrcs: string;
    }>;
    msid?: string;
    rtcpFb?: RTCPFeedback[];
  }

  export interface RTPCodec {
    payload: number;
    codec: string;
    rate?: number;
    encoding?: number;
  }

  export interface FMTP {
    payload: number;
    config: string;
  }

  export interface Candidate {
    foundation: string;
    component: number;
    transport: string;
    priority: number;
    ip: string;
    port: number;
    type: string;
    raddr?: string;
    rport?: number;
    generation?: number;
    "network-id"?: number;
    "network-cost"?: number;
  }

  export interface SSRC {
    id: number;
    attribute: string;
    value?: string;
  }

  export interface RTCPFeedback {
    payload: number;
    type: string;
    subtype?: string;
  }

  export function parse(sdpString: string): SessionDescription;
  export function write(sessionDescription: SessionDescription): string;
  export function parseParams(params: string): Record<string, string | number>;
  export function parsePayloads(payloads: string): number[];
  export function parseRemoteCandidates(str: string): Candidate[];
  export function parseImageAttributes(str: string): Array<Record<string, string>>;
  export function parseSimulcastStreamList(str: string): Array<Array<{ scid: string; paused: boolean }>>;
}
