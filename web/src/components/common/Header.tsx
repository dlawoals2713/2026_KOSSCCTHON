'use client';

import Link from 'next/link';
import { LogOut, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/user-context';
import { UserAvatar } from './UserAvatar';

// 로그인한 본인만 표시한다. (다른 가입자 목록은 노출하지 않는다)
export function Header() {
  const { currentUser, logout } = useAuth();

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
      <Link href="/" className="text-base font-extrabold tracking-tight text-secondary-foreground">
        TripClip
      </Link>
      {currentUser && (
        <div className="flex items-center gap-3">
          <Link
            href="/me/preferences"
            aria-label="내 취향 프로필"
            className="text-muted-foreground transition hover:text-foreground"
          >
            <UserRound className="size-5" />
          </Link>
          <Link href="/me/profile" aria-label="내 계정 설정" className="flex items-center gap-1.5 text-sm">
            <UserAvatar user={currentUser} size="sm" />
            <span className="max-w-24 truncate">{currentUser.name}</span>
          </Link>
          <button
            type="button"
            onClick={logout}
            aria-label="로그아웃"
            className="text-muted-foreground transition hover:text-foreground"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      )}
    </header>
  );
}
