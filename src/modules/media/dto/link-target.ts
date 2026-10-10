export type LinkTargetType = 'ProblemRequest' | 'Order' | 'Conversation' | 'MasterProfile' | 'Subscription' | 'User';

export interface LinkTarget {
  type: LinkTargetType;
  id: string;
}
