import { apiDelete, apiGet, apiPost, apiPut } from '@/services/api.client';
import type { CreatePostInput, FeedComment, FeedFilters, FeedPage, FeedPost } from './types';

export const feedService = {
  list(filters: FeedFilters, cursor?: string) {
    const search = new URLSearchParams({ tab: filters.tab, limit: '8' });
    if (filters.category) search.set('category', filters.category);
    if (filters.q) search.set('q', filters.q);
    if (filters.master) search.set('master', filters.master);
    if (cursor) search.set('cursor', cursor);
    return apiGet<FeedPage>(`/feed?${search.toString()}`);
  },
  mine() {
    return apiGet<FeedPage>('/feed/mine');
  },
  get(id: string) {
    return apiGet<FeedPost>(`/feed/${id}`);
  },
  create(input: CreatePostInput) {
    return apiPost<{ id: string }>('/feed', input);
  },
  remove(id: string) {
    return apiDelete<{ deleted: boolean }>(`/feed/${id}`);
  },
  view(id: string) {
    return apiPost<{ ok: boolean }>(`/feed/${id}/view`);
  },
  share(id: string) {
    return apiPost<{ ok: boolean }>(`/feed/${id}/share`);
  },
  like(id: string, on: boolean) {
    return on ? apiPut<{ liked: boolean; likeCount: number }>(`/feed/${id}/like`) : apiDelete<{ liked: boolean; likeCount: number }>(`/feed/${id}/like`);
  },
  save(id: string, on: boolean) {
    return on ? apiPut<{ saved: boolean; saveCount: number }>(`/feed/${id}/save`) : apiDelete<{ saved: boolean; saveCount: number }>(`/feed/${id}/save`);
  },
  follow(masterId: string, on: boolean) {
    return on ? apiPut<{ following: boolean; followers: number }>(`/feed/masters/${masterId}/follow`) : apiDelete<{ following: boolean; followers: number }>(`/feed/masters/${masterId}/follow`);
  },
  comments(id: string) {
    return apiGet<{ items: FeedComment[] }>(`/feed/${id}/comments`);
  },
  addComment(id: string, text: string) {
    return apiPost<{ id: string }>(`/feed/${id}/comments`, { text });
  },
  removeComment(id: string, commentId: string) {
    return apiDelete<{ deleted: boolean }>(`/feed/${id}/comments/${commentId}`);
  },
};
