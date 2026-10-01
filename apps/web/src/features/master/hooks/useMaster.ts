import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { masterService } from '../services/master.service';
import type { MasterInput } from '../types';

export function useMyMasterProfile() {
  return useQuery({ queryKey: ['master', 'me'], queryFn: () => masterService.getMine(), retry: false });
}

export function useSaveMasterProfile(isNew: boolean) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MasterInput) => (isNew ? masterService.createMine(input) : masterService.updateMine(input)),
    onSuccess: (profile) => {
      queryClient.setQueryData(['master', 'me'], profile);
      void queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
    },
  });
}

export function useMasters(q: string, categoryId?: string) {
  return useInfiniteQuery({
    queryKey: ['masters', q, categoryId ?? null],
    queryFn: ({ pageParam }: { pageParam?: string }) => masterService.list({ q, categoryId, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useMaster(id: string) {
  return useQuery({ queryKey: ['masters', 'one', id], queryFn: () => masterService.get(id), enabled: !!id });
}

/** Berilgan nuqtaga kela oladigan ustalar (mijoz manzili). */
export function useCoveringMasters(lat: number | null, lon: number | null) {
  const enabled = lat != null && lon != null;
  return useQuery({
    queryKey: ['masters', 'covering', lat?.toFixed(4) ?? null, lon?.toFixed(4) ?? null],
    queryFn: () => masterService.covering(lat as number, lon as number),
    enabled,
    staleTime: 60_000,
  });
}
