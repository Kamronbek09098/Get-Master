import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { feedService } from './feed.service';
import type { FeedFilters, FeedPage, FeedPost } from './types';

type Pages = InfiniteData<FeedPage, string | undefined>;

export function useFeed(filters: FeedFilters) {
  return useInfiniteQuery({
    queryKey: ['feed', filters],
    queryFn: ({ pageParam }) => feedService.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}

export function useFeedPost(id: string | null) {
  return useQuery({ queryKey: ['feed', 'post', id], queryFn: () => feedService.get(id as string), enabled: !!id, staleTime: 30_000 });
}

export function useMyPosts() {
  return useQuery({ queryKey: ['feed', 'mine'], queryFn: () => feedService.mine() });
}

/** Barcha keshlangan ro‘yxatlardagi postni (va bitta post keshini) yangilaydi: layk/saqlash/kuzatish darhol ko‘rinadi. */
function usePatchPosts() {
  const queryClient = useQueryClient();
  return (update: (post: FeedPost) => FeedPost, match: (post: FeedPost) => boolean) => {
    queryClient.setQueriesData<Pages>({ queryKey: ['feed'] }, (old) => {
      if (!old || !('pages' in old)) return old;
      return { ...old, pages: old.pages.map((page) => ({ ...page, items: page.items.map((post) => (match(post) ? update(post) : post)) })) };
    });
    queryClient.setQueriesData<FeedPost>({ queryKey: ['feed', 'post'] }, (old) => (old && match(old) ? update(old) : old));
  };
}

export function useToggleLike() {
  const patch = usePatchPosts();
  return useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => feedService.like(id, on),
    onMutate: ({ id, on }) =>
      patch(
        (post) => (post.viewer.liked === on ? post : { ...post, viewer: { ...post.viewer, liked: on }, counts: { ...post.counts, likes: Math.max(0, post.counts.likes + (on ? 1 : -1)) } }),
        (post) => post.id === id,
      ),
    onError: (_error, { id, on }) =>
      patch(
        (post) => ({ ...post, viewer: { ...post.viewer, liked: !on }, counts: { ...post.counts, likes: Math.max(0, post.counts.likes + (on ? -1 : 1)) } }),
        (post) => post.id === id,
      ),
  });
}

export function useToggleSave() {
  const patch = usePatchPosts();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => feedService.save(id, on),
    onMutate: ({ id, on }) =>
      patch(
        (post) => (post.viewer.saved === on ? post : { ...post, viewer: { ...post.viewer, saved: on }, counts: { ...post.counts, saves: Math.max(0, post.counts.saves + (on ? 1 : -1)) } }),
        (post) => post.id === id,
      ),
    onError: (_error, { id, on }) =>
      patch(
        (post) => ({ ...post, viewer: { ...post.viewer, saved: !on }, counts: { ...post.counts, saves: Math.max(0, post.counts.saves + (on ? -1 : 1)) } }),
        (post) => post.id === id,
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['feed'], predicate: (query) => (query.queryKey[1] as { tab?: string } | undefined)?.tab === 'saved' }),
  });
}

export function useToggleFollow() {
  const patch = usePatchPosts();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ masterId, on }: { masterId: string; on: boolean }) => feedService.follow(masterId, on),
    onMutate: ({ masterId, on }) =>
      patch(
        (post) => ({ ...post, viewer: { ...post.viewer, following: on } }),
        (post) => post.master.id === masterId,
      ),
    onError: (_error, { masterId, on }) =>
      patch(
        (post) => ({ ...post, viewer: { ...post.viewer, following: !on } }),
        (post) => post.master.id === masterId,
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['feed'], predicate: (query) => (query.queryKey[1] as { tab?: string } | undefined)?.tab === 'following' }),
  });
}

export function useComments(id: string | null) {
  return useQuery({ queryKey: ['feed', 'comments', id], queryFn: () => feedService.comments(id as string), enabled: !!id });
}

export function useAddComment(id: string) {
  const queryClient = useQueryClient();
  const patch = usePatchPosts();
  return useMutation({
    mutationFn: (text: string) => feedService.addComment(id, text),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['feed', 'comments', id] });
      patch((post) => ({ ...post, counts: { ...post.counts, comments: post.counts.comments + 1 } }), (post) => post.id === id);
    },
  });
}

export function useRemoveComment(id: string) {
  const queryClient = useQueryClient();
  const patch = usePatchPosts();
  return useMutation({
    mutationFn: (commentId: string) => feedService.removeComment(id, commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['feed', 'comments', id] });
      patch((post) => ({ ...post, counts: { ...post.counts, comments: Math.max(0, post.counts.comments - 1) } }), (post) => post.id === id);
    },
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: feedService.create,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });
}

export function useRemovePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => feedService.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });
}
