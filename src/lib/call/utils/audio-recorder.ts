/**
 * Audio Recorder for Call Recording
 *
 * Collects audio chunks during a call and saves them as WAV files.
 * Supports separate recording of user and assistant audio streams.
 */

import { createClient } from "@supabase/supabase-js";

// ============================================================================
// Types
// ============================================================================

interface RecordingSession {
  callId: string;
  userChunks: Buffer[];
  assistantChunks: Buffer[];
  startedAt: Date;
  sampleRate: number;
  channels: number;
}

interface RecordingResult {
  url: string;
  storagePath: string;
  durationSeconds: number;
  sizeBytes: number;
}

// ============================================================================
// Audio Recorder Class
// ============================================================================

export class AudioRecorder {
  private recordings: Map<string, RecordingSession> = new Map();

  /**
   * Start recording for a call
   */
  startRecording(
    callId: string,
    options: { sampleRate?: number; channels?: number } = {}
  ): void {
    if (this.recordings.has(callId)) {
      console.warn(`[AudioRecorder] Recording already started for call: ${callId}`);
      return;
    }

    this.recordings.set(callId, {
      callId,
      userChunks: [],
      assistantChunks: [],
      startedAt: new Date(),
      sampleRate: options.sampleRate || 24000,
      channels: options.channels || 1,
    });

    console.log(`[AudioRecorder] Started recording for call: ${callId}`);
  }

  /**
   * Add audio chunk to recording
   */
  addChunk(callId: string, audioBuffer: Buffer, role: "user" | "assistant"): void {
    const recording = this.recordings.get(callId);

    if (!recording) {
      console.warn(`[AudioRecorder] No recording session for call: ${callId}`);
      return;
    }

    if (role === "user") {
      recording.userChunks.push(audioBuffer);
    } else {
      recording.assistantChunks.push(audioBuffer);
    }
  }

  /**
   * Stop recording and save to storage
   */
  async stopRecording(callId: string): Promise<RecordingResult | null> {
    const recording = this.recordings.get(callId);

    if (!recording) {
      console.warn(`[AudioRecorder] No recording session for call: ${callId}`);
      return null;
    }

    try {
      // Merge user and assistant audio (interleaved by time)
      const mergedAudio = this.mergeAudioTracks(recording);

      if (mergedAudio.length === 0) {
        console.log(`[AudioRecorder] No audio to save for call: ${callId}`);
        this.recordings.delete(callId);
        return null;
      }

      // Create WAV file
      const wavBuffer = this.createWavFile(mergedAudio, recording.sampleRate, recording.channels);

      // Calculate duration
      const durationSeconds = mergedAudio.length / (recording.sampleRate * recording.channels * 2);

      // Upload to storage
      const result = await this.uploadToStorage(callId, wavBuffer);

      console.log(`[AudioRecorder] Recording saved for call: ${callId} (${durationSeconds.toFixed(1)}s)`);

      // Clean up
      this.recordings.delete(callId);

      return {
        url: result.url,
        storagePath: result.storagePath,
        durationSeconds,
        sizeBytes: wavBuffer.length,
      };
    } catch (error) {
      console.error(`[AudioRecorder] Failed to save recording for call ${callId}:`, error);
      this.recordings.delete(callId);
      return null;
    }
  }

  /**
   * Cancel recording without saving
   */
  cancelRecording(callId: string): void {
    if (this.recordings.has(callId)) {
      this.recordings.delete(callId);
      console.log(`[AudioRecorder] Recording cancelled for call: ${callId}`);
    }
  }

  /**
   * Get recording status
   */
  isRecording(callId: string): boolean {
    return this.recordings.has(callId);
  }

  /**
   * Get active recording count
   */
  getActiveRecordingCount(): number {
    return this.recordings.size;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Merge user and assistant audio tracks
   * For now, simply concatenates all chunks in order received
   * TODO: Implement proper time-based interleaving for stereo mix
   */
  private mergeAudioTracks(recording: RecordingSession): Buffer {
    // Combine all user chunks
    const userAudio =
      recording.userChunks.length > 0 ? Buffer.concat(recording.userChunks) : Buffer.alloc(0);

    // Combine all assistant chunks
    const assistantAudio =
      recording.assistantChunks.length > 0 ? Buffer.concat(recording.assistantChunks) : Buffer.alloc(0);

    // For mono recording, mix the two streams
    if (recording.channels === 1) {
      return this.mixMonoTracks(userAudio, assistantAudio);
    }

    // For stereo, put user on left channel and assistant on right
    return this.createStereoMix(userAudio, assistantAudio);
  }

  /**
   * Mix two mono tracks together
   */
  private mixMonoTracks(track1: Buffer, track2: Buffer): Buffer {
    const maxLength = Math.max(track1.length, track2.length);
    const mixed = Buffer.alloc(maxLength);

    for (let i = 0; i < maxLength; i += 2) {
      const sample1 = i < track1.length ? track1.readInt16LE(i) : 0;
      const sample2 = i < track2.length ? track2.readInt16LE(i) : 0;

      // Mix with headroom to prevent clipping
      const mixedSample = Math.round((sample1 + sample2) * 0.5);
      const clampedSample = Math.max(-32768, Math.min(32767, mixedSample));

      mixed.writeInt16LE(clampedSample, i);
    }

    return mixed;
  }

  /**
   * Create stereo mix with track1 on left and track2 on right
   */
  private createStereoMix(leftTrack: Buffer, rightTrack: Buffer): Buffer {
    const leftSamples = leftTrack.length / 2;
    const rightSamples = rightTrack.length / 2;
    const maxSamples = Math.max(leftSamples, rightSamples);

    const stereo = Buffer.alloc(maxSamples * 4); // 2 bytes per sample * 2 channels

    for (let i = 0; i < maxSamples; i++) {
      const leftSample = i < leftSamples ? leftTrack.readInt16LE(i * 2) : 0;
      const rightSample = i < rightSamples ? rightTrack.readInt16LE(i * 2) : 0;

      stereo.writeInt16LE(leftSample, i * 4); // Left channel
      stereo.writeInt16LE(rightSample, i * 4 + 2); // Right channel
    }

    return stereo;
  }

  /**
   * Create WAV file from PCM16 audio data
   */
  private createWavFile(audioData: Buffer, sampleRate: number, channels: number): Buffer {
    const byteRate = sampleRate * channels * 2; // 16-bit = 2 bytes
    const blockAlign = channels * 2;
    const dataSize = audioData.length;
    const headerSize = 44;
    const fileSize = headerSize + dataSize;

    const wavBuffer = Buffer.alloc(fileSize);
    let offset = 0;

    // RIFF header
    wavBuffer.write("RIFF", offset);
    offset += 4;
    wavBuffer.writeUInt32LE(fileSize - 8, offset); // File size minus RIFF header
    offset += 4;
    wavBuffer.write("WAVE", offset);
    offset += 4;

    // fmt subchunk
    wavBuffer.write("fmt ", offset);
    offset += 4;
    wavBuffer.writeUInt32LE(16, offset); // Subchunk size (16 for PCM)
    offset += 4;
    wavBuffer.writeUInt16LE(1, offset); // Audio format (1 = PCM)
    offset += 2;
    wavBuffer.writeUInt16LE(channels, offset); // Number of channels
    offset += 2;
    wavBuffer.writeUInt32LE(sampleRate, offset); // Sample rate
    offset += 4;
    wavBuffer.writeUInt32LE(byteRate, offset); // Byte rate
    offset += 4;
    wavBuffer.writeUInt16LE(blockAlign, offset); // Block align
    offset += 2;
    wavBuffer.writeUInt16LE(16, offset); // Bits per sample
    offset += 2;

    // data subchunk
    wavBuffer.write("data", offset);
    offset += 4;
    wavBuffer.writeUInt32LE(dataSize, offset); // Data size
    offset += 4;

    // Audio data
    audioData.copy(wavBuffer, offset);

    return wavBuffer;
  }

  /**
   * Upload recording to Supabase storage
   */
  private async uploadToStorage(
    callId: string,
    wavBuffer: Buffer
  ): Promise<{ url: string; storagePath: string }> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials not configured for call recording storage");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate storage path
    const timestamp = new Date().toISOString().split("T")[0];
    const storagePath = `call-recordings/${timestamp}/${callId}.wav`;

    // Upload to storage
    const { error } = await supabase.storage
      .from("recordings")
      .upload(storagePath, wavBuffer, {
        contentType: "audio/wav",
        upsert: false,
      });

    if (error) {
      throw new Error(`Failed to upload recording: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from("recordings").getPublicUrl(storagePath);

    return {
      url: urlData.publicUrl,
      storagePath,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let audioRecorderInstance: AudioRecorder | null = null;

export function getAudioRecorder(): AudioRecorder {
  if (!audioRecorderInstance) {
    audioRecorderInstance = new AudioRecorder();
  }
  return audioRecorderInstance;
}
