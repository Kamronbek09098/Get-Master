import { useEffect, useState } from 'react';

/** Sichqoncha bor (hover qila oladigan) qurilma va «harakatni kamaytirish» yoqilmagan bo‘lsa true. */
export function useFinePointer(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const fineQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setFine(fineQuery.matches && !reduceQuery.matches);
    update();
    fineQuery.addEventListener('change', update);
    reduceQuery.addEventListener('change', update);
    return () => {
      fineQuery.removeEventListener('change', update);
      reduceQuery.removeEventListener('change', update);
    };
  }, []);
  return fine;
}
