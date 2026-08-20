import { createFile, DataStream } from "mp4box";

export interface DemuxedVideoTrack {
  id: number;
  codec: string;
  width: number;
  height: number;
  duration: number; // in seconds
  timescale: number;
  nbSamples: number;
  fps: number;
  description: Uint8Array | null;
}

export interface DemuxedAudioTrack {
  id: number;
  codec: string;
  sampleRate: number;
  channelCount: number;
  duration: number; // in seconds
  timescale: number;
  nbSamples: number;
}

export interface DemuxedSample {
  track_id: number;
  number: number;
  duration: number;
  dts: number;
  cts: number;
  is_sync: boolean;
  data: Uint8Array;
  size: number;
  timescale: number;
}

export interface DemuxedMedia {
  info: unknown;
  videoTrack: DemuxedVideoTrack;
  audioTrack: DemuxedAudioTrack | null;
  videoSamples: DemuxedSample[];
  audioSamples: DemuxedSample[];
}

interface RawTrackEntry {
  avcC?: { write: (stream: unknown) => void };
  hvcC?: { write: (stream: unknown) => void };
}

interface RawTrack {
  id: number;
  codec: string;
  track_width: number;
  track_height: number;
  duration: number;
  timescale: number;
  nb_samples: number;
  audio?: { sample_rate: number; channel_count: number };
  mdia?: {
    minf?: {
      stbl?: {
        stsd?: {
          entries?: RawTrackEntry[];
        };
      };
    };
  };
}

interface RawInfo {
  videoTracks: RawTrack[];
  audioTracks: RawTrack[];
}

function extractCodecDescription(track: RawTrack): Uint8Array | null {
  try {
    const entries = track.mdia?.minf?.stbl?.stsd?.entries;
    if (!entries || entries.length === 0) return null;
    const entry = entries[0];
    const box = entry?.avcC || entry?.hvcC;
    if (!box) return null;

    const stream = new DataStream(
      undefined,
      0,
      (DataStream as unknown as { BIG_ENDIAN: boolean }).BIG_ENDIAN,
    );
    box.write(stream);
    // Skip 8-byte box header (4 bytes size + 4 bytes box type)
    return new Uint8Array(stream.buffer, 8);
  } catch (err) {
    console.warn("Failed to extract codec description:", err);
    return null;
  }
}

/**
 * Demuxes an MP4 ArrayBuffer into video/audio tracks and samples.
 */
export async function demuxMP4(buffer: ArrayBuffer): Promise<DemuxedMedia> {
  return new Promise((resolve, reject) => {
    const file = createFile();

    let info: unknown = null;
    let videoTrack: DemuxedVideoTrack | null = null;
    let audioTrack: DemuxedAudioTrack | null = null;

    const videoSamples: DemuxedSample[] = [];
    const audioSamples: DemuxedSample[] = [];

    file.onError = (e: unknown) => {
      reject(new Error(`MP4Box parsing error: ${String(e)}`));
    };

    file.onReady = (readyInfo: unknown) => {
      info = readyInfo;
      const rawInfo = readyInfo as RawInfo;

      const rawVideoTrack = rawInfo.videoTracks[0];
      if (!rawVideoTrack) {
        reject(new Error("No video track found in MP4"));
        return;
      }

      const fullVideoTrack = (
        file as unknown as { getTrackById: (id: number) => RawTrack }
      ).getTrackById(rawVideoTrack.id);
      const description = fullVideoTrack ? extractCodecDescription(fullVideoTrack) : null;

      const durationSec = rawVideoTrack.duration / rawVideoTrack.timescale;
      const fps =
        rawVideoTrack.nb_samples > 0 && durationSec > 0
          ? rawVideoTrack.nb_samples / durationSec
          : 30;

      videoTrack = {
        id: rawVideoTrack.id,
        codec: rawVideoTrack.codec,
        width: rawVideoTrack.track_width,
        height: rawVideoTrack.track_height,
        duration: durationSec,
        timescale: rawVideoTrack.timescale,
        nbSamples: rawVideoTrack.nb_samples,
        fps,
        description,
      };

      const rawAudioTrack = rawInfo.audioTracks[0];
      if (rawAudioTrack) {
        audioTrack = {
          id: rawAudioTrack.id,
          codec: rawAudioTrack.codec,
          sampleRate: rawAudioTrack.audio?.sample_rate ?? 44100,
          channelCount: rawAudioTrack.audio?.channel_count ?? 2,
          duration: rawAudioTrack.duration / rawAudioTrack.timescale,
          timescale: rawAudioTrack.timescale,
          nbSamples: rawAudioTrack.nb_samples,
        };
      }

      // Configure extraction
      file.setExtractionOptions(videoTrack.id, null, {
        nbSamples: 100000,
      });

      if (audioTrack) {
        file.setExtractionOptions(audioTrack.id, null, {
          nbSamples: 100000,
        });
      }

      file.start();
    };

    file.onSamples = (trackId: number, _user: unknown, samples: DemuxedSample[]) => {
      if (videoTrack && trackId === videoTrack.id) {
        videoSamples.push(...samples);
      } else if (audioTrack && trackId === audioTrack.id) {
        audioSamples.push(...samples);
      }
    };

    // Feed buffer in 1MB chunks to reliably trigger onReady and onSamples
    const CHUNK_SIZE = 1024 * 1024;
    let offset = 0;
    while (offset < buffer.byteLength) {
      const end = Math.min(offset + CHUNK_SIZE, buffer.byteLength);
      const slice = buffer.slice(offset, end) as ArrayBuffer & {
        fileStart: number;
      };
      slice.fileStart = offset;
      file.appendBuffer(slice);
      offset = end;
    }

    file.flush();
    file.stop();

    if (!videoTrack) {
      reject(new Error("Failed to parse video track from MP4"));
      return;
    }

    resolve({
      info,
      videoTrack,
      audioTrack,
      videoSamples,
      audioSamples,
    });
  });
}
