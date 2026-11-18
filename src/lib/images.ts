export function responsiveImage(url: string | undefined) {
  if (!url) return {};
  const localUrl = url.replace(/^https:\/\/fieldio\.shop(?=\/images\/)/, "");
  const zara = /^(\/images\/brand-catalog\/zara\/.+)\.webp(\?.*)?$/.exec(localUrl);
  if (zara) {
    const [, base, query = ""] = zara;
    return { src: localUrl, srcSet: `${base}-480.webp${query} 480w, ${base}-960.webp${query} 960w, ${localUrl} 1200w` };
  }
  if (!localUrl.startsWith("/images/") || !localUrl.endsWith(".png")) return { src: url };
  const base = localUrl.slice(0, -4);
  return {
    src: `${base}-960.webp`,
    srcSet: `${base}-480.webp 480w, ${base}-960.webp 960w, ${base}-1600.webp 1600w`
  };
}
