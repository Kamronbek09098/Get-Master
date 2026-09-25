import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { complaintService } from '../services/complaint.service';
import type { CreateComplaintInput } from '../types';

export function useMyComplaints() {
  return useQuery({ queryKey: ['complaints', 'mine'], queryFn: () => complaintService.listMine() });
}

export function useCreateComplaint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateComplaintInput) => complaintService.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['complaints', 'mine'] }),
  });
}
