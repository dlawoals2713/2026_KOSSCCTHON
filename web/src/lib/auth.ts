const TOKEN_KEY = 'tripclip:token'
export const TOKEN_EVENT = 'tripclip:token'

export function getToken(): string {
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setToken(token: string) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token)
    else window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    // localStorage 사용 불가 시 무시
  }
  window.dispatchEvent(new Event(TOKEN_EVENT))
}

export const clearToken = () => setToken('')
