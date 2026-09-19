'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { deleteTrip, getTrip, leaveTrip } from '@/lib/api/trips'
import { useUser } from '@/lib/user-context'
import { cn } from '@/lib/utils'
import { formatDateRange } from './format'
import MemberAvatar from './MemberAvatar'
import { PageError, PageLoading } from './state-views'

const TABS = [
  { slug: 'add', label: '담기' },
  { slug: 'basket', label: '장바구니' },
  { slug: 'group', label: '그룹 취향' },
  { slug: 'itinerary', label: '일정' },
]

export default function TripShell({ tripId, children }: { tripId: string; children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { currentUser } = useUser()
  const {
    data: trip,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({ queryKey: ['trip', tripId], queryFn: () => getTrip(tripId) })

  const isOwner = !!trip && trip.ownerUserId === currentUser.userId

  // 방장: 여행 취소(삭제) / 멤버: 여행 나가기
  const leaveMutation = useMutation({
    mutationFn: () => (isOwner ? deleteTrip(tripId) : leaveTrip(tripId, currentUser.userId)),
    onSuccess: () => {
      router.replace('/')
    },
  })

  const onLeave = () => {
    const message = isOwner
      ? '이 여행을 취소할까요?\n담은 장소와 일정이 모두 삭제되고 되돌릴 수 없어요.'
      : '이 여행에서 나갈까요?'
    if (window.confirm(message)) leaveMutation.mutate()
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      {isPending && <PageLoading label="여행방을 불러오는 중…" />}

      {isError && (
        <PageError
          message={error instanceof Error ? error.message : '여행방을 불러오지 못했어요.'}
          onRetry={() => refetch()}
        >
          <Link href="/" className="inline-flex h-9 items-center px-3 text-sm underline">
            처음으로
          </Link>
        </PageError>
      )}

      {trip && (
        <>
          <header>
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-700">
              ← TripClip
            </Link>
            <Link href={`/trips/${tripId}`} className="mt-1 block">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{trip.name}</h1>
            </Link>
            <p className="mt-1 text-sm text-slate-600">
              {trip.destination} · {formatDateRange(trip.startDate, trip.endDate)}
            </p>
            <div className="mt-2 flex items-center gap-1">
              {trip.members.map((m) => (
                <MemberAvatar key={m.userId} name={m.name} size="sm" />
              ))}
              <span className="ml-1 text-xs text-slate-500">{trip.members.length}명</span>
              <button
                type="button"
                onClick={onLeave}
                disabled={leaveMutation.isPending}
                className="ml-auto text-xs text-red-600 underline-offset-2 hover:underline disabled:opacity-50"
              >
                {leaveMutation.isPending ? '처리 중…' : isOwner ? '여행 취소' : '여행 나가기'}
              </button>
            </div>
            {leaveMutation.isError && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {leaveMutation.error instanceof Error ? leaveMutation.error.message : '처리에 실패했어요.'}
              </p>
            )}
          </header>

          <nav aria-label="여행방 메뉴" className="mt-4 grid grid-cols-4 border-b border-slate-200">
            {TABS.map((tab) => {
              const href = `/trips/${tripId}/${tab.slug}`
              const active = pathname === href || pathname.startsWith(`${href}/`)
              return (
                <Link
                  key={tab.slug}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    '-mb-px min-w-0 border-b-2 py-2.5 text-center text-xs font-medium transition-colors sm:text-sm',
                    active
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700',
                  )}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>

          <div className="mt-5">{children}</div>
        </>
      )}
    </div>
  )
}
