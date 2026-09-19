'use client'

import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { deleteAccount, updateProfile } from '@/lib/api/users'
import { setToken } from '@/lib/auth'
import { useUser } from '@/lib/user-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : '요청에 실패했어요.')

export default function ProfilePage() {
  const { currentUser } = useUser()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [name, setName] = useState(currentUser.name)
  const [bio, setBio] = useState(currentUser.bio ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [notice, setNotice] = useState('')

  const profileMutation = useMutation({
    mutationFn: () => updateProfile({ name: name.trim(), bio }),
    onSuccess: () => {
      setNotice('프로필을 저장했어요.')
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })

  const passwordMutation = useMutation({
    mutationFn: () => updateProfile({ currentPassword, newPassword }),
    onSuccess: () => {
      setNotice('비밀번호를 변경했어요.')
      setCurrentPassword('')
      setNewPassword('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteAccount(deletePassword),
    onSuccess: () => {
      queryClient.clear()
      setToken('')
      router.replace('/login')
    },
  })

  const submit = (fn: () => void) => (e: FormEvent) => {
    e.preventDefault()
    setNotice('')
    fn()
  }

  const onDelete = (e: FormEvent) => {
    e.preventDefault()
    if (
      window.confirm(
        '정말 계정을 삭제할까요?\n내가 담은 장소와 취향 데이터가 모두 사라지고 되돌릴 수 없어요.\n(다른 멤버가 있는 내 여행은 다른 멤버에게 방장이 넘어가요)',
      )
    ) {
      deleteMutation.mutate()
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-10 px-4 py-8">
      <h1 className="text-lg font-semibold">내 계정</h1>

      {notice && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}

      <form onSubmit={submit(() => profileMutation.mutate())} className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground">프로필</h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">이메일</Label>
          <Input id="email" value={currentUser.email ?? ''} disabled />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">이름</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bio">소개</Label>
          <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={1000} rows={3} />
        </div>
        {profileMutation.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(profileMutation.error)}</p>}
        <Button type="submit" disabled={profileMutation.isPending || !name.trim()}>
          {profileMutation.isPending ? '저장 중…' : '프로필 저장'}
        </Button>
      </form>

      <form onSubmit={submit(() => passwordMutation.mutate())} className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground">비밀번호 변경</h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cur">현재 비밀번호</Label>
          <Input id="cur" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new">새 비밀번호 (6자 이상)</Label>
          <Input id="new" type="password" autoComplete="new-password" minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        </div>
        {passwordMutation.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(passwordMutation.error)}</p>}
        <Button type="submit" variant="outline" disabled={passwordMutation.isPending}>
          {passwordMutation.isPending ? '변경 중…' : '비밀번호 변경'}
        </Button>
      </form>

      <form onSubmit={onDelete} className="flex flex-col gap-4 rounded-xl border border-destructive/30 p-4">
        <h2 className="text-sm font-semibold text-destructive">계정 삭제</h2>
        <p className="text-sm text-muted-foreground">삭제하면 되돌릴 수 없어요. 비밀번호를 입력해 확인해 주세요.</p>
        <Input type="password" autoComplete="current-password" placeholder="비밀번호" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} required />
        {deleteMutation.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(deleteMutation.error)}</p>}
        <Button type="submit" variant="destructive" disabled={deleteMutation.isPending}>
          {deleteMutation.isPending ? '삭제 중…' : '계정 삭제'}
        </Button>
      </form>
    </div>
  )
}
