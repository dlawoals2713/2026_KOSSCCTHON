'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { deleteContent, getTrip, listTripContents } from '@/lib/api';
import { useUser } from '@/lib/user-context';
import { CATEGORY_LABEL, CATEGORY_LIST } from '@/lib/constants';
import type { Category, Content } from '@/lib/types';
import { EmptyState, ErrorState, LoadingSteps, UserAvatar } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ALL = 'all';

export default function BasketPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const { currentUser } = useUser();
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState<Category | typeof ALL>(ALL);
  const [memberFilter, setMemberFilter] = useState<string>(ALL);

  const tripQuery = useQuery({ queryKey: ['trip', tripId], queryFn: () => getTrip(tripId) });
  const contentsQuery = useQuery({
    queryKey: ['tripContents', tripId],
    queryFn: () => listTripContents(tripId),
  });

  const contents = contentsQuery.data ?? [];
  const members = tripQuery.data?.members ?? [];

  const memberById = new Map(members.map((m) => [m.userId, m]));

  const countsByMember = new Map<string, number>();
  for (const content of contents) {
    countsByMember.set(content.userId, (countsByMember.get(content.userId) ?? 0) + 1);
  }

  const filteredContents = contents.filter(
    (c) =>
      (categoryFilter === ALL || c.category === categoryFilter) &&
      (memberFilter === ALL || c.userId === memberFilter)
  );

  const deleteMutation = useMutation({
    mutationFn: (contentId: string) => deleteContent(tripId, contentId),
    // 취향·일정 등 파생 데이터도 함께 갱신되도록 전체를 무효화한다.
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const onDelete = (content: Content) => {
    if (window.confirm(`'${content.place.name || '이 항목'}'을(를) 장바구니에서 삭제할까요?`)) {
      deleteMutation.mutate(content.contentId);
    }
  };

  // 내가 담은 항목이거나 내가 방장이면 수정/삭제할 수 있다.
  const canEdit = (content: Content) =>
    content.userId === currentUser.userId || tripQuery.data?.ownerUserId === currentUser.userId;

  const isPending = tripQuery.isPending || contentsQuery.isPending;
  const isError = tripQuery.isError || contentsQuery.isError;

  if (isPending) {
    return <LoadingSteps steps={['장바구니 불러오는 중']} className="mx-auto w-full max-w-2xl flex-1" />;
  }
  if (isError) {
    return (
      <ErrorState
        className="mx-auto mt-10 w-full max-w-2xl"
        onRetry={() => {
          tripQuery.refetch();
          contentsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-lg font-semibold text-foreground">여행 장바구니</h1>
        <p className="text-sm text-muted-foreground">멤버들이 저장한 장소를 한눈에 확인해요.</p>
      </div>

      {members.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {members.map((member) => (
            <span key={member.userId} className="flex items-center gap-1.5 text-muted-foreground">
              <UserAvatar user={member} size="sm" />
              {member.name} {countsByMember.get(member.userId) ?? 0}개
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as Category | typeof ALL)}>
          <SelectTrigger size="sm">
            <SelectValue>
              {(value: Category | typeof ALL) => (value === ALL ? '전체 카테고리' : CATEGORY_LABEL[value])}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>전체 카테고리</SelectItem>
            {CATEGORY_LIST.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={memberFilter} onValueChange={(v) => setMemberFilter(v ?? ALL)}>
          <SelectTrigger size="sm">
            <SelectValue>
              {(value: string) => (value === ALL ? '전체 멤버' : (memberById.get(value)?.name ?? value))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>전체 멤버</SelectItem>
            {members.map((member) => (
              <SelectItem key={member.userId} value={member.userId}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {contents.length === 0 ? (
        <EmptyState
          title="첫 숏폼을 담아보세요"
          description="릴스·쇼츠·틱톡 링크를 저장하면 여기에 쌓여요."
          action={
            <Link href={`/trips/${tripId}/add`} className={buttonVariants()}>
              숏폼 담으러 가기
            </Link>
          }
        />
      ) : filteredContents.length === 0 ? (
        <EmptyState title="조건에 맞는 장소가 없어요" description="필터를 바꿔서 다시 찾아보세요." />
      ) : (
        <>
          {deleteMutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteMutation.error instanceof Error ? deleteMutation.error.message : '삭제에 실패했어요.'}
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {filteredContents.map((content) => (
              <ContentCard
                key={content.contentId}
                content={content}
                saver={memberById.get(content.userId)}
                editHref={canEdit(content) ? `/trips/${tripId}/review/${content.contentId}` : undefined}
                onDelete={canEdit(content) ? () => onDelete(content) : undefined}
                deleting={deleteMutation.isPending && deleteMutation.variables === content.contentId}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ContentCard({
  content,
  saver,
  editHref,
  onDelete,
  deleting,
}: {
  content: Content;
  saver?: { userId: string; name: string };
  editHref?: string;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">{content.place.name}</p>
          <p className="text-sm text-muted-foreground">
            {content.area} · {CATEGORY_LABEL[content.category]}
          </p>
        </div>
        {saver && (
          <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
            <UserAvatar user={saver} size="sm" />
            {saver.name}
          </span>
        )}
      </div>

      {content.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {content.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <a
        href={content.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-fit items-center gap-1 text-sm text-secondary-foreground hover:underline"
      >
        원본 보기 <ExternalLink className="size-3.5" />
      </a>

      {(editHref || onDelete) && (
        <div className="flex gap-2">
          {editHref && (
            <Link href={editHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              수정
            </Link>
          )}
          {onDelete && (
            <Button type="button" variant="destructive" size="sm" onClick={onDelete} disabled={deleting}>
              {deleting ? '삭제 중…' : '삭제'}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
