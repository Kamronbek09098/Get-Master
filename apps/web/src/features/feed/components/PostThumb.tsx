import type { FeedPost } from '../types';

/** Post uchun kichik rasm: muqova bo‘lsa — rasm, aks holda videoning birinchi kadri (brauzer o‘zi chizadi). */
export function PostThumb({ post, className }: { post: FeedPost; className?: string }) {
  const image = post.media.coverUrl ?? post.media.afterUrl;
  if (image) return <img className={className} src={image} alt="" loading="lazy" draggable={false} />;
  if (post.media.videoUrl) return <video className={className} src={`${post.media.videoUrl}#t=0.4`} muted playsInline preload="metadata" tabIndex={-1} aria-hidden="true" />;
  return <span className="gf-tile__blank" />;
}
