import { useMutation, useQuery } from '@tanstack/react-query';
import { warrantyService } from '../services/warranty.service';
import type { WarrantyClaimInput } from '../types';

export function useMyWarranties() {
  return useQuery({ queryKey: ['warranties', 'mine'], queryFn: () => warrantyService.listMine() });
}

export function useCreateWarrantyClaim(warrantyId: string) {
  return useMutation({
    mutationFn: (input: WarrantyClaimInput) => warrantyService.createClaim(warrantyId, input),
  });
}
