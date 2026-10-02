import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reviewService } from '../services/review.service';
import type { CreateReviewInput } from '../types';

export function useMasterReviews(masterId: string) {
  return useQuery({
    queryKey: ['reviews', masterId],
    queryFn: () => reviewService.listByMaster(masterId),
    enabled: !!masterId,
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReviewInput) => reviewService.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reviews'] });
      // Buyurtma sahifasi sharh qoldirilganini ko‘rsatishi uchun.
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
