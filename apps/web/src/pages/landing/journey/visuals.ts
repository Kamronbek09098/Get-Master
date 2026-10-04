import type { ComponentType } from 'react';
import type { SceneId } from './journey-content';
import * as S from './scenes';

/** Rolga qarab bir xil `id` turli vizual: `result`, `job`. */
export const VISUALS: Record<'customer' | 'master', Partial<Record<SceneId, ComponentType<S.SceneVisualProps>>>> = {
  customer: { problem: S.Problem, describe: S.Describe, match: S.Match, compare: S.Compare, profile: S.Profile, job: S.JobCustomer, result: S.ResultCustomer },
  master: { work: S.Work, request: S.Request, offer: S.Offer, accepted: S.Accepted, job: S.JobMaster, result: S.ResultMaster, reputation: S.Reputation, earnings: S.Earnings },
};
