/**
 * Was anything actually said?
 *
 * Transcription models hallucinate when handed silence — they return a plausible
 * sentence rather than nothing — so a recording with no speech in it should never
 * reach the API. Measuring loudness locally is both more reliable and free.
 */

/** Loudness below which we treat a recording as silence. Speech sits far above this. */
const SILENCE_RMS = 0.012
/** Recordings shorter than this can't contain a word. */
const MIN_SECONDS = 0.35

export interface Loudness {
  seconds: number
  rms: number
  /** Loudest short window — catches a quiet word in an otherwise silent clip. */
  peakRms: number
}

export async function measureLoudness(blob: Blob): Promise<Loudness | null> {
  const Ctor = window.AudioContext || (window as any).webkitAudioContext
  if (!Ctor) return null
  const ctx = new Ctor()
  try {
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer())
    const data = buffer.getChannelData(0)
    let total = 0
    let peakRms = 0
    // ~50ms windows, so one short word doesn't get averaged away by surrounding quiet.
    const window = Math.max(1, Math.floor(buffer.sampleRate * 0.05))
    for (let start = 0; start < data.length; start += window) {
      let sum = 0
      const end = Math.min(start + window, data.length)
      for (let i = start; i < end; i++) sum += data[i]! * data[i]!
      total += sum
      peakRms = Math.max(peakRms, Math.sqrt(sum / (end - start)))
    }
    return { seconds: buffer.duration, rms: Math.sqrt(total / data.length), peakRms }
  } catch {
    return null // undecodable — let the server decide rather than blocking the user
  } finally {
    ctx.close().catch(() => {})
  }
}

/** True when we're confident the clip contains no speech. */
export async function isSilent(blob: Blob): Promise<boolean> {
  const level = await measureLoudness(blob)
  if (!level) return false
  return level.seconds < MIN_SECONDS || level.peakRms < SILENCE_RMS
}
