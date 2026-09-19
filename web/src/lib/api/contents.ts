import type {
  Category,
  Content,
  TimeSlot,
} from '@/lib/types'

import {
  HttpError,
  http,
  USE_MOCK,
} from './http'

import * as mocks from '@/lib/mocks'

interface BackendShortform {
  content_id: string
  trip_id: string
  user_id: string

  url: string
  platform?: string | null
  title?: string | null

  category?: string | null
  keywords?: string[] | null
  area?: string | null
  activity?: string | null
  place_name?: string | null
  recommended_time?: string | null

  created_at?: string | null

  place_id?: string | null
  place_verified?: boolean

  verified_place_name?: string | null
  place_address?: string | null

  place_latitude?: number | null
  place_longitude?: number | null
}

interface ShortformListResponse {
  status: string
  data: BackendShortform[]
}

interface CreateShortformResponse {
  content_id: string
  trip_id: string
  user_id: string

  analysis: {
    category?: string | null
    keywords?: string[] | null
    area?: string | null
    activity?: string | null
    place_name?: string | null
    recommended_time?: string | null

    title?: string | null
    url?: string | null
    platform?: string | null
  }

  preference_profile: unknown
}

function normalizeCategory(
  category?: string | null,
): Category {
  switch (category) {
    case 'cafe':
      return 'cafe'

    case 'food':
      return 'food'

    case 'exhibition':
      return 'exhibition'

    case 'shopping':
      return 'shopping'

    case 'sightseeing':
      return 'sightseeing'

    case 'activity':
      return 'activity'

    // 현재 FE taxonomy에 없는 Backend category는
    // 임시로 가장 가까운 화면 category로 변환
    case 'outdoor':
      return 'sightseeing'

    case 'nightlife':
    case 'accommodation':
    case 'other':
    default:
      return 'activity'
  }
}

function normalizeTimeSlot(
  value?: string | null,
): TimeSlot | undefined {
  if (
    value === 'morning' ||
    value === 'afternoon' ||
    value === 'evening' ||
    value === 'night'
  ) {
    return value
  }

  return undefined
}

function normalizePlatform(
  value?: string | null,
): Content['platform'] {
  return value === 'instagram' ||
    value === 'youtube' ||
    value === 'tiktok'
    ? value
    : 'other'
}

function toContent(
  item: BackendShortform,
): Content {
  return {
    contentId: item.content_id,
    tripId: item.trip_id,
    userId: item.user_id,

    url: item.url,
    platform: normalizePlatform(item.platform),

    place: {
      name:
        item.verified_place_name ??
        item.place_name ??
        '',

      address:
        item.place_address ??
        undefined,

      lat:
        item.place_latitude ??
        undefined,

      lng:
        item.place_longitude ??
        undefined,

      verified:
        item.place_verified === true,
    },

    category:
      normalizeCategory(
        item.category,
      ),

    area:
      item.area ?? '',

    tags:
      item.keywords ?? [],

    activityType:
      item.activity ?? undefined,

    recommendedTime:
      normalizeTimeSlot(
        item.recommended_time,
      ),

    // 현재 Backend 분석 결과에는 별도 confidence가 없음
    confidence: 0,

    userEdited: false,

    savedAt:
      item.created_at ??
      new Date().toISOString(),
  }
}

export async function createContent(
  input: {
    url: string
    userId: string
    tripId: string
    note?: string
  },
): Promise<Content> {
  if (USE_MOCK) {
    return mocks.createContent(
      input,
    )
  }

  const response =
    await http<CreateShortformResponse>(
      `/api/trips/${encodeURIComponent(input.tripId)}/shortforms`,
      {
        method: 'POST',
        body: JSON.stringify({
          user_id: input.userId,
          url: input.url,
          note: input.note,
        }),
      },
    )

  return toContent({
    content_id:
      response.content_id,

    trip_id:
      response.trip_id,

    user_id:
      response.user_id,

    url:
      response.analysis.url ??
      input.url,

    title:
      response.analysis.title,

    platform:
      response.analysis.platform,

    category:
      response.analysis.category,

    keywords:
      response.analysis.keywords,

    area:
      response.analysis.area,

    activity:
      response.analysis.activity,

    place_name:
      response.analysis.place_name,

    recommended_time:
      response.analysis.recommended_time,

    created_at:
      new Date().toISOString(),
  })
}

export async function listTripContents(
  tripId: string,
): Promise<Content[]> {
  if (USE_MOCK) {
    return mocks.listTripContents(
      tripId,
    )
  }

  const response =
    await http<ShortformListResponse>(
      `/api/trips/${encodeURIComponent(tripId)}/shortforms`,
    )

  return response.data.map(
    toContent,
  )
}

interface UpdateShortformResponse {
  status: string
  data: BackendShortform
  preference_profile: unknown
}

export async function patchContent(
  tripId: string,
  contentId: string,
  patch: Partial<Content>,
): Promise<Content> {
  if (USE_MOCK) {
    return mocks.patchContent(
      contentId,
      patch,
    )
  }

  const response =
    await http<UpdateShortformResponse>(
      `/api/trips/${encodeURIComponent(tripId)}/shortforms/${encodeURIComponent(contentId)}`,
      {
        method: 'PATCH',

        body: JSON.stringify({
          place_name:
            patch.place?.name,

          category:
            patch.category,

          keywords:
            patch.tags,

          recommended_time:
            patch.recommendedTime,
        }),
      },
    )

  return toContent(
    response.data,
  )
}

export async function deleteContent(
  tripId: string,
  contentId: string,
): Promise<void> {
  if (USE_MOCK) {
    throw new HttpError(
      0,
      '목(mock) 모드에서는 지원하지 않는 기능이에요.',
    )
  }

  await http(
    `/api/trips/${encodeURIComponent(tripId)}/shortforms/${encodeURIComponent(contentId)}`,
    { method: 'DELETE' },
  )
}
