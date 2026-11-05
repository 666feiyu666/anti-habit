const DRAFT_PREFIX = 'anti-habit:memo-draft:'

function storageKey(key: string): string {
  return `${DRAFT_PREFIX}${key}`
}

export function readMemoDraft(key: string): string | null {
  if (!import.meta.client) return null
  try {
    return window.localStorage.getItem(storageKey(key))
  } catch {
    return null
  }
}

export function writeMemoDraft(key: string, content: string): void {
  if (!import.meta.client) return
  try {
    if (content.trim()) {
      window.localStorage.setItem(storageKey(key), content)
    } else {
      window.localStorage.removeItem(storageKey(key))
    }
  } catch {
    // 本地存储不可用时不影响写作，只是无法恢复草稿。
  }
}

export function clearMemoDraft(key: string): void {
  if (!import.meta.client) return
  try {
    window.localStorage.removeItem(storageKey(key))
  } catch {
    // 同上。
  }
}
