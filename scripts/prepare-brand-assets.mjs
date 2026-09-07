import sharp from "sharp";

// Crop only the supplied artwork's surrounding whitespace; do not redraw the mark.
const artwork = sharp("public/brand/fieldio-original.jpg").extract({ left: 286, top: 200, width: 470, height: 602 });
await artwork.clone().resize({ height: 180 }).webp({ lossless: true }).toFile("public/brand/fieldio-monogram.webp");
for (const size of [32, 180, 192, 512]) {
  await artwork.clone().resize({ width: size, height: size, fit: "contain", background: "#fdfcfb" }).png().toFile(`public/brand/fieldio-icon-${size}.png`);
}
console.log("Prepared official Fieldio logo assets from the original supplied image.");
