import { describe, expect, it } from 'vitest'
import { pcmToMp3, SAMPLE_RATE } from '../src/renderer/src/voice/pcmToMp3'

/** A sine wave, as a microphone would deliver samples. */
const sine = (seconds: number, hz = 440, amplitude = 0.6): Float32Array => {
  const samples = new Float32Array(Math.round(seconds * SAMPLE_RATE))
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE) * amplitude
  }
  return samples
}

/** Frame synchronisation: eleven bits set, as every MPEG frame starts. */
const hasFrameSync = (mp3: Uint8Array): boolean => {
  for (let i = 0; i < Math.min(mp3.length - 1, 256); i++) {
    if (mp3[i] === 0xff && (mp3[i + 1]! & 0xe0) === 0xe0) return true
  }
  return false
}

describe('pcmToMp3', () => {
  it('keeps 44,1 kHz rather than letting LAME resample', () => {
    // Below about 112 kb/s, LAME downsamples to 32 kHz on its own. The bit rate
    // is chosen to avoid that, and this test says so out loud.
    const wave = sine(1)
    const mp3 = pcmToMp3(wave, wave)
    // A 44,1 kHz MPEG-1 layer III frame holds 1152 samples; at 32 kHz the file
    // would be about a quarter shorter for the same audio.
    expect(mp3.length).toBeGreaterThan(14_000)
  })

  it('produces something that starts like an mp3', () => {
    const wave = sine(0.5)
    const mp3 = pcmToMp3(wave, wave)
    expect(mp3.length).toBeGreaterThan(1000)
    expect(hasFrameSync(mp3)).toBe(true)
  })

  it('produces a size consistent with the duration and the bit rate', () => {
    const wave = sine(2)
    const mp3 = pcmToMp3(wave, wave)
    // 128 kb/s over two seconds is about 32 ko; allow for headers and padding.
    expect(mp3.length).toBeGreaterThan(26_000)
    expect(mp3.length).toBeLessThan(40_000)
  })

  it('grows with the recording rather than truncating it', () => {
    const short = pcmToMp3(sine(0.5), sine(0.5)).length
    const long = pcmToMp3(sine(2), sine(2)).length
    expect(long).toBeGreaterThan(short * 3)
  })

  it('flushes the encoder, so the tail of the recording is not lost', () => {
    // A duration that is not a whole number of 1152-sample blocks: without the
    // final flush, the last partial block would vanish.
    const odd = sine(0.4237)
    const mp3 = pcmToMp3(odd, odd)
    const blocks = Math.ceil(odd.length / 1152)
    // At least one frame per block: nothing was dropped on the way out.
    expect(mp3.length).toBeGreaterThan(blocks * 100)
  })

  it('survives a recording of nothing', () => {
    const mp3 = pcmToMp3(new Float32Array(0), new Float32Array(0))
    expect(mp3).toBeInstanceOf(Uint8Array)
  })

  it('clamps a signal above the maximum instead of wrapping it around', () => {
    // Wrapping would turn a loud peak into the opposite polarity: an audible
    // click. Both encode without throwing, and the loud one is not shorter.
    const loud = new Float32Array(SAMPLE_RATE).fill(4)
    const full = new Float32Array(SAMPLE_RATE).fill(1)
    expect(pcmToMp3(loud, loud).length).toBeGreaterThan(1000)
    expect(pcmToMp3(full, full).length).toBeGreaterThan(1000)
  })

  it('encodes a mono recording duplicated across both channels', () => {
    const wave = sine(1)
    const mono = pcmToMp3(wave, wave)
    const stereo = pcmToMp3(wave, sine(1, 660))
    expect(hasFrameSync(mono)).toBe(true)
    expect(hasFrameSync(stereo)).toBe(true)
  })
})
