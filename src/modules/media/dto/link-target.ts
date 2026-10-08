export type LinkTargetType = 'ProblemRequest' | 'Order' | 'Conversation' | 'MasterProfile' | 'Subscription';

export interface LinkTarget {
  type: LinkTargetType;
  id: string;
}
