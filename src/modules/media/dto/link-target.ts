export type LinkTargetType = 'ProblemRequest' | 'Order' | 'Conversation' | 'MasterProfile';

export interface LinkTarget {
  type: LinkTargetType;
  id: string;
}
