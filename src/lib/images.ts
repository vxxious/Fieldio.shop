export function responsiveImage(url: string | undefined) {
  if (!url) return {};
  if (!url.startsWith("/images/") || !url.endsWith(".png")) return { src: url };
  const base = url.slice(0, -4);
  return {
    src: `${base}-960.webp`,
    srcSet: `${base}-480.webp 480w, ${base}-960.webp 960w, ${base}-1600.webp 1600w`
  };
}
