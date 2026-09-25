export const EXTENSIONS_BY_MIME: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/heic': ['.heic'],
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'audio/ogg': ['.ogg'],
  'audio/mp4': ['.m4a'],
  'audio/mpeg': ['.mp3'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

export const ALLOWED_MIME_TYPES = new Set(Object.keys(EXTENSIONS_BY_MIME));
