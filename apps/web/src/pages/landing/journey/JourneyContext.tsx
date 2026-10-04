import { createContext, useContext, useEffect } from 'react';

type Listener = (sceneProgress: number) => void;

export interface JourneyBus {
  subscribe: (listener: Listener) => () => void;
  /** Skroll bilan boshqarilmaydi (harakat kamaytirilgan): hamma qiymat yakuniy holatda. */
  isStatic: boolean;
}

export const JourneyContext = createContext<JourneyBus>({ subscribe: () => () => undefined, isStatic: true });

/** Sahna ichidagi skroll foizi (0..1) — React qayta chizilmasdan, to‘g‘ridan-to‘g‘ri DOM yangilash uchun. */
export function useSceneProgress(listener: Listener) {
  const { subscribe } = useContext(JourneyContext);
  useEffect(() => subscribe(listener), [subscribe, listener]);
}

export const useIsStatic = () => useContext(JourneyContext).isStatic;
