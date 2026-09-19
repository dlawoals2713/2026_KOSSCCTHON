import type { User } from '@/lib/types'
import { HttpError, http, USE_MOCK } from './http'
import { DEMO_USERS } from '@/lib/mocks/seed'

interface BackendUser {
  user_id: string
  name: string
  email?: string
  bio?: string | null
}

interface UserResponse {
  status: string
  data: BackendUser
}

const toUser = (u: BackendUser): User => ({
  userId: u.user_id,
  name: u.name,
  email: u.email,
  bio: u.bio ?? '',
})

const mockUnsupported = () => new HttpError(0, '목(mock) 모드에서는 지원하지 않는 기능이에요.')

export async function getMe(): Promise<User> {
  if (USE_MOCK) return DEMO_USERS[0]
  return toUser((await http<UserResponse>('/api/users/me')).data)
}

export async function updateProfile(input: {
  name?: string
  bio?: string
  currentPassword?: string
  newPassword?: string
}): Promise<User> {
  if (USE_MOCK) throw mockUnsupported()
  const res = await http<UserResponse>('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify({
      name: input.name,
      bio: input.bio,
      current_password: input.currentPassword,
      new_password: input.newPassword,
    }),
  })
  return toUser(res.data)
}

export async function deleteAccount(password: string): Promise<void> {
  if (USE_MOCK) throw mockUnsupported()
  await http('/api/users/me', { method: 'DELETE', body: JSON.stringify({ password }) })
}

// 여행 초대용: 이메일이 정확히 일치하는 1명만 찾는다 (전체 사용자 목록은 노출하지 않는다).
export async function lookupUserByEmail(email: string): Promise<User> {
  if (USE_MOCK) {
    const found = DEMO_USERS.find((u) => u.name === email.trim())
    if (!found) throw new HttpError(404, '해당 사용자를 찾을 수 없어요.')
    return found
  }
  const res = await http<UserResponse>(`/api/users/lookup?email=${encodeURIComponent(email.trim())}`)
  return toUser(res.data)
}
