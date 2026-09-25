import { accountName } from '@/lib/account-name';
import type { Role } from '@/types/common';
import type { Conversation } from './types';

export function counterpartName(conversation: Conversation, _myRole: Role | null): string {
  return accountName(conversation.counterpart);
}
