export const IMAGE_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const DOCUMENT_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "application/pdf": "pdf"
};

export function validateUpload(file: File, allowedTypes: readonly string[], maxBytes = MAX_UPLOAD_BYTES) {
  if (!allowedTypes.includes(file.type)) return "Choose a supported file type.";
  if (file.size > maxBytes) return `Each file must be under ${Math.round(maxBytes / 1024 / 1024)} MB.`;
  return "";
}

export function uploadExtension(file: File) {
  const value = extensions[file.type];
  if (!value) throw new Error("Unsupported file type.");
  return value;
}
