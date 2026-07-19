import { ref } from 'vue'

export interface Recording {
  blob: Blob
  filename: string
}

// Pick the best container the browser supports, and map it to a filename
// extension so the backend (and OpenAI) can detect the format.
function pickMimeType(): { mimeType: string; ext: string } {
  const candidates: Array<{ mimeType: string; ext: string }> = [
    { mimeType: 'audio/webm;codecs=opus', ext: 'webm' },
    { mimeType: 'audio/webm', ext: 'webm' },
    { mimeType: 'audio/mp4', ext: 'mp4' },
    { mimeType: 'audio/ogg;codecs=opus', ext: 'ogg' },
  ]
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mimeType)) {
      return c
    }
  }
  return { mimeType: '', ext: 'webm' }
}

export function useRecorder() {
  const isRecording = ref(false)
  const isSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices

  let mediaRecorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let chunks: Blob[] = []
  let chosen = pickMimeType()

  async function start(): Promise<void> {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    chosen = pickMimeType()
    chunks = []
    mediaRecorder = new MediaRecorder(stream, chosen.mimeType ? { mimeType: chosen.mimeType } : undefined)
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    mediaRecorder.start()
    isRecording.value = true
  }

  function stop(): Promise<Recording> {
    return new Promise((resolve, reject) => {
      if (!mediaRecorder) {
        reject(new Error('Not recording'))
        return
      }
      mediaRecorder.onstop = () => {
        const type = chosen.mimeType || 'audio/webm'
        const blob = new Blob(chunks, { type })
        stream?.getTracks().forEach((t) => t.stop())
        stream = null
        mediaRecorder = null
        isRecording.value = false
        resolve({ blob, filename: `recording.${chosen.ext}` })
      }
      mediaRecorder.stop()
    })
  }

  return { isRecording, isSupported, start, stop }
}
