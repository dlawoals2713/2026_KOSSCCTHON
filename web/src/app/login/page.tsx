'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { login, signup } from '@/lib/api/auth'
import { setToken } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'signup' ? signup(name.trim(), email.trim(), password) : login(email.trim(), password),
    onSuccess: (token) => {
      queryClient.clear()
      setToken(token)
      router.replace('/')
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{mode === 'login' ? '로그인' : '회원가입'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">SNS 속 여행을 실제 여행으로, TripClip</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {mode === 'signup' && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">이름</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">이메일</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">비밀번호{mode === 'signup' && ' (6자 이상)'}</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={mode === 'signup' ? 6 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {mutation.isError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {mutation.error instanceof Error ? mutation.error.message : '실패했어요. 다시 시도해 주세요.'}
          </p>
        )}

        <Button type="submit" size="lg" disabled={mutation.isPending}>
          {mutation.isPending ? '처리 중…' : mode === 'login' ? '로그인' : '가입하고 시작하기'}
        </Button>
      </form>

      <button
        type="button"
        className="text-sm text-muted-foreground underline"
        onClick={() => {
          mutation.reset()
          setMode(mode === 'login' ? 'signup' : 'login')
        }}
      >
        {mode === 'login' ? '계정이 없나요? 회원가입' : '이미 계정이 있나요? 로그인'}
      </button>
    </main>
  )
}
