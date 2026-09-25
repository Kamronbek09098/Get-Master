import { useQuery } from '@tanstack/react-query';
import { matchingService } from '../services/matching.service';

export function useMatching(requestId: string) {
  return useQuery({
    queryKey: ['matching', requestId],
    queryFn: () => matchingService.getForRequest(requestId),
    enabled: !!requestId,
    refetchInterval: (query) => (query.state.data?.run?.status === 'COMPLETED' ? 60_000 : 8_000),
  });
}
