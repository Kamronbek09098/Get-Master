import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customerService } from '../services/customer.service';

const KEY = ['customer', 'favorites'];

export function useFavorites() {
  return useQuery({ queryKey: KEY, queryFn: () => customerService.listFavorites() });
}

/** Ustani saqlash / saqlanganlardan olib tashlash. */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ masterId, saved }: { masterId: string; saved: boolean }) =>
      saved ? customerService.removeFavorite(masterId) : customerService.addFavorite(masterId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
