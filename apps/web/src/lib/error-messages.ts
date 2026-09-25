import { ApiError } from '@/types/api';

const CODE_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'Internet aloqasi yo‘q yoki server javob bermayapti.',
  UNAUTHORIZED: 'Telefon raqami yoki parol noto‘g‘ri.',
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.details.length > 0) return error.details.join('\n');
    return CODE_MESSAGES[error.code] ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Kutilmagan xatolik yuz berdi.';
}
