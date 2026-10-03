import { useEffect, useState } from 'react';
import { buildStories, type StoryDef } from './stories';

export const storyBase = (id: string) => `/media/stories/${id}/film`;

async function exists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok && (res.headers.get('content-type') ?? '').startsWith('video/');
  } catch {
    return false;
  }
}

/** Haqiqiy video fayli mavjud hikoyalarni aniqlaydi. Hech biri bo‘lmasa, landing 3D zaxira «film»ni ko‘rsatadi. */
export function useAvailableStories(): { status: 'pending' | 'ready'; stories: StoryDef[] } {
  const [state, setState] = useState<{ status: 'pending' | 'ready'; stories: StoryDef[] }>({ status: 'pending', stories: [] });
  useEffect(() => {
    let cancelled = false;
    const all = buildStories();
    void Promise.all(all.map((story) => exists(`${storyBase(story.id)}.mp4`))).then((flags) => {
      if (!cancelled) setState({ status: 'ready', stories: all.filter((_, i) => flags[i]) });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
