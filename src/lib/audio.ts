// Small audio helpers: decode base64 MP3 into a playable object URL, and a
// single shared <audio> element so only one clip plays at a time.

export function base64ToBlobUrl(base64: string, mimeType: string): string {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }))
}

let current: HTMLAudioElement | null = null

export function playAudio(url: string): void {
  if (current) {
    current.pause()
    current = null
  }
  const audio = new Audio(url)
  current = audio
  // Autoplay can reject if the user hasn't interacted; ignore quietly.
  audio.play().catch(() => {})
}
