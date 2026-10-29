const STORAGE_KEY = 'rashko_admin_seen_orders'
const MUTE_KEY = 'rashko_admin_notify_muted'
const SOUND_KEY = 'rashko_admin_notify_sound'

export const SOUND_OPTIONS = [
  { id: 'chime1', name: 'Chime 1', file: '/chime1.mp3' },
  { id: 'chime3', name: 'Chime 2', file: '/chime3.mp3' },
  { id: 'dime1', name: 'Dime/Soft', file: '/dime1.mp3' },
] as const

export type SoundId = typeof SOUND_OPTIONS[number]['id']

let audio: HTMLAudioElement | null = null
let queue: number[] = []
let playing = false
let currentSound: string = '/chime1.mp3'

function getAudio() {
  if (!audio) {
    audio = new Audio()
    audio.preload = 'auto'
    audio.volume = 0.9
  }
  return audio
}

export function getSelectedSound(): string {
  try {
    const saved = localStorage.getItem(SOUND_KEY) as SoundId | null
    if (saved) {
      const opt = SOUND_OPTIONS.find((o) => o.id === saved)
      if (opt) {
        currentSound = opt.file
        return opt.file
      }
    }
  } catch {}
  currentSound = '/chime1.mp3'
  return currentSound
}

export function setSelectedSound(id: SoundId) {
  try {
    localStorage.setItem(SOUND_KEY, id)
    const opt = SOUND_OPTIONS.find((o) => o.id === id)
    if (opt) {
      currentSound = opt.file
      if (audio) {
        audio.src = currentSound
      }
    }
  } catch {}
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === 'true'
  } catch {
    return false
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? 'true' : 'false')
  } catch {}
}

export function getSeenOrders(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return new Set(arr.map((x) => String(x)))
  } catch {}
  return new Set()
}

export function markSeen(orderId: string | number) {
  try {
    const seen = getSeenOrders()
    seen.add(String(orderId))
    const arr = Array.from(seen).slice(-200)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
  } catch {}
}

export function unlockAudio() {
  try {
    const a = getAudio()
    const src = getSelectedSound()
    if (!a.src || !a.src.includes(src)) a.src = src
    a.muted = true
    const p = a.play()
    if (p) {
      p.then(() => {
        a.pause()
        a.currentTime = 0
        a.muted = false
      }).catch(() => {
        a.muted = false
      })
    } else {
      a.muted = false
    }
  } catch {}
}

async function playNext() {
  if (playing) return
  if (queue.length === 0) return
  playing = true
  const muted = isMuted()
  if (muted) {
    queue = []
    playing = false
    return
  }
  try {
    const a = getAudio()
    const src = getSelectedSound()
    if (!a.src || !a.src.includes(src)) a.src = src
    a.currentTime = 0
    const p = a.play()
    if (p) await p
    queue.shift()
    a.onended = () => {
      playing = false
      if (queue.length > 0) {
        void playNext()
      }
    }
  } catch (e) {
    playing = false
    throw e
  }
}

export function enqueueOrderSound(orderId: string | number): boolean {
  if (isMuted()) {
    markSeen(orderId)
    return false
  }
  const seen = getSeenOrders()
  if (seen.has(String(orderId))) {
    return false
  }
  markSeen(orderId)
  queue.push(Number(orderId))
  try {
    void playNext().catch(() => {})
    return true
  } catch {
    return false
  }
}

export async function testSound(id?: SoundId) {
  try {
    const a = getAudio()
    const src = id ? (SOUND_OPTIONS.find((o) => o.id === id)?.file || getSelectedSound()) : getSelectedSound()
    a.src = src
    a.currentTime = 0
    await a.play()
  } catch (e) {
    throw e
  }
}

export function markAutoplayUnlocked() {}
export function canAutoplay() { return true }
