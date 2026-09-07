import sharp from "sharp";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const directory = path.resolve("public/images");
let sourceBytes = 0;
let optimizedBytes = 0;
for (const filename of await readdir(directory)) {
  if (!filename.endsWith(".png")) continue;
  const source = path.join(directory, filename);
  const base = filename.slice(0, -4);
  sourceBytes += (await stat(source)).size;
  for (const width of [480, 960, 1600]) {
    const destination = path.join(directory, `${base}-${width}.webp`);
    const result = await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality: 83, effort: 5 }).toFile(destination);
    if (width === 1600) optimizedBytes += result.size;
  }
}
console.log(`Largest responsive images: ${optimizedBytes} bytes; original PNGs: ${sourceBytes} bytes.`);
