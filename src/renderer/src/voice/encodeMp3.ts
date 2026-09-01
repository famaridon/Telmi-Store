import { pcmToMp3, SAMPLE_RATE } from './pcmToMp3'

/**
 * Turning a recording into the mp3 a pack expects.
 *
 * `MediaRecorder` gives WebM/Opus, which the storyteller does not read, so the
 * sound makes a round trip: decoded to raw samples by the browser, then encoded
 * to mp3 by a pure-JavaScript encoder. No binary is involved, which is the whole
 * point — nothing to download, nothing to keep up to date.
 *
 * The output matches the format measured on a pack that works: 44 100 Hz stereo.
 * A microphone records in mono, so the single channel is duplicated rather than
 * left as-is — one fewer difference from the reference.
 */

/** Decodes whatever the microphone produced into 44,1 kHz samples. */
const decode = async (recording: ArrayBuffer): Promise<AudioBuffer> => {
  const context = new AudioContext({ sampleRate: SAMPLE_RATE })
  try {
    return await context.decodeAudioData(recording)
  } finally {
    void context.close()
  }
}

export const encodeMp3 = async (recording: ArrayBuffer): Promise<Uint8Array> => {
  const audio = await decode(recording)
  return pcmToMp3(
    audio.getChannelData(0),
    audio.numberOfChannels > 1 ? audio.getChannelData(1) : audio.getChannelData(0),
    audio.sampleRate
  )
}

/** Seconds of audio in a decoded recording, for showing a duration. */
export const durationOf = async (recording: ArrayBuffer): Promise<number> =>
  (await decode(recording)).duration
