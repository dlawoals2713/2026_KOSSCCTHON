'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createTrip } from '@/lib/api/trips'
import { lookupUserByEmail } from '@/lib/api/users'
import type { User } from '@/lib/types'
import { useUser } from '@/lib/user-context'

const schema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, '여행 이름을 입력해 주세요.')
      .max(40, '40자 이내로 입력해 주세요.'),

    destination: z
      .string()
      .trim()
      .min(1, '목적지를 입력해 주세요.'),

    startDate: z
      .string()
      .min(1, '시작일을 선택해 주세요.'),

    endDate: z
      .string()
      .min(1, '종료일을 선택해 주세요.'),

    memberIds: z
      .array(z.string())
      .min(2, '멤버를 2명 이상 선택해 주세요.')
      .max(4, '멤버는 최대 4명까지 선택할 수 있어요.'),
  })
  .refine(
    (v) =>
      !v.startDate ||
      !v.endDate ||
      v.endDate >= v.startDate,
    {
      path: ['endDate'],
      message:
        '종료일은 시작일과 같거나 이후여야 해요.',
    },
  )

type FormValues = z.infer<typeof schema>

function FieldError({
  message,
}: {
  message?: string
}) {
  if (!message) return null

  return (
    <p
      role="alert"
      className="mt-1 text-xs text-red-600"
    >
      {message}
    </p>
  )
}

export default function NewTripForm() {
  const router = useRouter()

  const { currentUser } = useUser()

  // 초대한 멤버(방장 제외). 전체 가입자 목록 대신 이메일로 한 명씩 찾아 추가한다.
  const [invited, setInvited] = useState<User[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviting, setInviting] = useState(false)

  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),

    defaultValues: {
      name: '',
      destination: '',
      startDate: '',
      endDate: '',

      memberIds: [currentUser.userId],
    },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createTrip({
        ...values,

        // 현재 선택된 사용자가 방장
        ownerUserId:
          currentUser.userId,
      }),

    onSuccess: (trip) => {
      router.push(
        `/trips/${trip.tripId}`,
      )
    },
  })

  const syncMembers = (list: User[]) => {
    setInvited(list)
    setValue(
      'memberIds',
      [currentUser.userId, ...list.map((u) => u.userId)],
      { shouldValidate: true },
    )
  }

  const addByEmail = async () => {
    setInviteError('')
    const email = inviteEmail.trim()
    if (!email) return
    setInviting(true)
    try {
      const user = await lookupUserByEmail(email)
      if (user.userId === currentUser.userId || invited.some((u) => u.userId === user.userId)) {
        setInviteError('이미 추가된 멤버예요.')
      } else {
        syncMembers([...invited, user])
        setInviteEmail('')
      }
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : '사용자를 찾지 못했어요.')
    } finally {
      setInviting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(
        (values) =>
          mutation.mutate(values),
      )}
      className="space-y-5"
      noValidate
    >
      <div>
        <Label htmlFor="name">
          여행 이름
        </Label>

        <Input
          id="name"
          placeholder="예: 성수 데이 트립"
          className="mt-1"
          {...register('name')}
        />

        <FieldError
          message={errors.name?.message}
        />
      </div>

      <div>
        <Label htmlFor="destination">
          목적지
        </Label>

        <Input
          id="destination"
          placeholder="예: 서울 성수동"
          className="mt-1"
          {...register('destination')}
        />

        <FieldError
          message={
            errors.destination?.message
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <Label htmlFor="startDate">
            시작일
          </Label>

          <Input
            id="startDate"
            type="date"
            className="mt-1"
            {...register('startDate')}
          />

          <FieldError
            message={
              errors.startDate?.message
            }
          />
        </div>

        <div className="min-w-0">
          <Label htmlFor="endDate">
            종료일
          </Label>

          <Input
            id="endDate"
            type="date"
            className="mt-1"
            {...register('endDate')}
          />

          <FieldError
            message={
              errors.endDate?.message
            }
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">
          멤버 (2~4명)
        </p>

        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full border border-blue-600 bg-blue-600 px-4 py-1.5 text-sm text-white">
            {currentUser.name}
            <span className="ml-1 text-xs opacity-80">(방장)</span>
          </span>

          {invited.map((user) => (
            <span
              key={user.userId}
              className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-700"
            >
              {user.name}
              <button
                type="button"
                aria-label={`${user.name} 제외`}
                className="text-slate-400 hover:text-slate-700"
                onClick={() => syncMembers(invited.filter((u) => u.userId !== user.userId))}
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <Input
            type="email"
            value={inviteEmail}
            placeholder="초대할 친구의 가입 이메일"
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void addByEmail()
              }
            }}
          />
          <Button type="button" variant="outline" disabled={inviting || !inviteEmail.trim()} onClick={() => void addByEmail()}>
            {inviting ? '찾는 중…' : '추가'}
          </Button>
        </div>
        <FieldError message={inviteError} />

        <FieldError
          message={
            errors.memberIds?.message
          }
        />
      </div>

      {mutation.isError && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {mutation.error instanceof Error
            ? mutation.error.message
            : '여행방을 만들지 못했어요.'}{' '}
          다시 시도해 주세요.
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={mutation.isPending}
      >
        {mutation.isPending
          ? '여행방 만드는 중…'
          : mutation.isError
            ? '다시 시도'
            : '여행방 만들기'}
      </Button>
    </form>
  )
}