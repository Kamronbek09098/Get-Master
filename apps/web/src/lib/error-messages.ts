import { ApiError } from '@/types/api';
import { t } from '@/i18n';

const CODE_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: t('Internet aloqasi yo‘q yoki server javob bermayapti.'),
  UNAUTHORIZED: t('Telefon raqami yoki parol noto‘g‘ri.'),
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.sessionExpired) return t('Sessiya muddati tugadi. Iltimos, qayta kiring.');
    if (error.details.length > 0) return error.details.map((detail) => t(detail)).join('\n');
    return CODE_MESSAGES[error.code] ?? t(error.message);
  }
  if (error instanceof Error) return error.message;
  return t('Kutilmagan xatolik yuz berdi.');
}
