import { http } from './http'

interface LoginResponse {
  token: string
  user: { user_id: string; name: string }
}

export async function login(email: string, password: string): Promise<string> {
  const res = await http<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  return res.token
}

// 가입 후 바로 로그인해 토큰을 반환한다.
export async function signup(name: string, email: string, password: string): Promise<string> {
  await http('/api/users', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })
  return login(email, password)
}
