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

export function useMasters(q: string, categoryId?: string, mode?: string, region?: string) {
  return useInfiniteQuery({
    queryKey: ['masters', q, categoryId ?? null, mode ?? null, region ?? null],
    queryFn: ({ pageParam }: { pageParam?: string }) => masterService.list({ q, categoryId, mode, region, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useMasterAvailability(id: string) {
  return useQuery({ queryKey: ['masters', 'availability', id], queryFn: () => masterService.availability(id), enabled: !!id });
}

export function useMasterCompletedJobs(id: string) {
  return useQuery({ queryKey: ['masters', 'completed-jobs', id], queryFn: () => masterService.completedJobs(id), enabled: !!id });
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

/** Faqat ish hududi maydonlarini (markaz, radius, hududlar) yangilaydi. */
export function useUpdateWorkArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<MasterInput>) => masterService.updateMine(input),
    onSuccess: (profile) => {
      queryClient.setQueryData(['master', 'me'], profile);
    },
  });
}
