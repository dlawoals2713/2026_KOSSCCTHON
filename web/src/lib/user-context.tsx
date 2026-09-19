'use client'

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { User } from '@/lib/types'
import { getMe } from '@/lib/api/users'
import { USE_MOCK } from '@/lib/api/http'
import { DEMO_USERS } from '@/lib/mocks/seed'
import { TOKEN_EVENT, clearToken, getToken } from '@/lib/auth'

const PUBLIC_PATHS = ['/login']

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(TOKEN_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(TOKEN_EVENT, callback)
  }
}

interface AuthContextValue {
  currentUser: User | null
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">{children}</div>
}

export function UserProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const token = useSyncExternalStore(subscribe, getToken, () => '')
  const isPublic = PUBLIC_PATHS.includes(pathname)

  const meQuery = useQuery({
    queryKey: ['me', token],
    queryFn: getMe,
    enabled: !USE_MOCK && !!token,
    retry: false,
  })

  const currentUser = USE_MOCK ? DEMO_USERS[0] : (token ? (meQuery.data ?? null) : null)

  useEffect(() => {
    if (USE_MOCK) return
    if (!token && !isPublic) router.replace('/login')
    if (token && isPublic && meQuery.data) router.replace('/')
  }, [token, isPublic, meQuery.data, router])

  const logout = () => {
    clearToken()
    queryClient.clear() // 이전 계정의 캐시가 다음 계정에 보이지 않도록 비운다
    router.replace('/login')
  }

  if (!USE_MOCK && !isPublic) {
    if (!token) return <Centered>로그인 화면으로 이동 중…</Centered>
    if (meQuery.isPending) return <Centered>사용자 정보를 불러오는 중…</Centered>
    if (meQuery.isError) {
      return (
        <Centered>
          <div className="flex flex-col items-center gap-3">
            <p>사용자 정보를 불러오지 못했어요.</p>
            <button className="underline" onClick={() => meQuery.refetch()}>다시 시도</button>
            <button className="text-slate-400 underline" onClick={logout}>로그아웃</button>
          </div>
        </Centered>
      )
    }
  }

  return <AuthContext.Provider value={{ currentUser, logout }}>{children}</AuthContext.Provider>
}

// 로그인 여부와 무관하게 쓰는 훅 (Header, 로그인 페이지)
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within a UserProvider')
  return context
}

// 로그인된 페이지에서 쓰는 훅. currentUser는 항상 존재한다.
export function useUser(): { currentUser: User; logout: () => void } {
  const { currentUser, logout } = useAuth()
  if (!currentUser) throw new Error('useUser must be used on a logged-in page')
  return { currentUser, logout }
}
