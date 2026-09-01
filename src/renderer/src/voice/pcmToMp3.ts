import { Mp3Encoder } from '@breezystack/lamejs'

/**
 * Encoding samples into the mp3 a pack expects, in pure JavaScript.
 *
 * Separated from the recording so it can be checked without a browser: this is
 * where the arithmetic lives — clamping before scaling, the block loop, the
 * final flush — and where a mistake produces a file that clicks or truncates.
 *
 * The output matches the format measured on a pack that works: 44 100 Hz
 * stereo. A microphone records in mono, so the caller duplicates the channel
 * rather than leaving it as-is — one fewer difference from the reference.
 */

export const SAMPLE_RATE = 44_100

/**
 * 128 kb/s, and not less, for a reason found by measuring the output: below
 * about 112 kb/s LAME decides on its own that 44,1 kHz is too much for the
 * bit rate and resamples to 32 kHz. The audio stays correct — right duration,
 * right pitch — but the file no longer matches the format measured on a pack
 * that works, and matching it removes a variable we cannot test on a device.
 *
 * A label lasts two seconds: the difference in size is a few kilo-octets.
 */
const KBPS = 128
/** lamejs works block by block; this is the size its own examples use. */
const BLOCK = 1152

const toInt16 = (samples: Float32Array): Int16Array => {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    // Clamp before scaling: a sample above 1 would wrap around and click.
    const clamped = Math.max(-1, Math.min(1, samples[i]!))
    out[i] = Math.round(clamped * (clamped < 0 ? 0x8000 : 0x7fff))
  }
  return out
}


export const pcmToMp3 = (
  left: Float32Array,
  right: Float32Array,
  sampleRate: number = SAMPLE_RATE
): Uint8Array => {
  const encoder = new Mp3Encoder(2, sampleRate, KBPS)
  const l = toInt16(left)
  const r = toInt16(right)
  const chunks: Uint8Array[] = []

  for (let offset = 0; offset < l.length; offset += BLOCK) {
    const block = encoder.encodeBuffer(l.subarray(offset, offset + BLOCK), r.subarray(offset, offset + BLOCK))
    if (block.length > 0) chunks.push(new Uint8Array(block))
  }
  const tail = encoder.flush()
  if (tail.length > 0) chunks.push(new Uint8Array(tail))

  const mp3 = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0))
  let written = 0
  for (const chunk of chunks) {
    mp3.set(chunk, written)
    written += chunk.length
  }
  return mp3
}
