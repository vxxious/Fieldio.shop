import sharp from "sharp";

const sourcePath = process.argv[2];

if (!sourcePath) {
  throw new Error("Pass the generated editorial background path as the first argument.");
}

const width = 1200;
const height = 630;
const markSource = sharp("public/brand/fieldio-original.jpg").greyscale();
const { data, info } = await markSource.raw().toBuffer({ resolveWithObject: true });
const markPixels = Buffer.alloc(info.width * info.height * 4);

for (let index = 0; index < data.length; index += 1) {
  const alpha = 255 - data[index];
  const offset = index * 4;
  markPixels[offset] = 20;
  markPixels[offset + 1] = 21;
  markPixels[offset + 2] = 18;
  markPixels[offset + 3] = alpha;
}

const mark = await sharp(markPixels, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .trim({ threshold: 10 })
  .resize({ height: 96 })
  .png()
  .toBuffer();

const typography = Buffer.from(`
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="veil" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#f2f0e9" stop-opacity="0.94"/>
        <stop offset="0.72" stop-color="#f2f0e9" stop-opacity="0.66"/>
        <stop offset="1" stop-color="#f2f0e9" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="620" height="630" fill="url(#veil)"/>
    <text x="82" y="190" fill="#151612" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="600" letter-spacing="7">FIELDIO</text>
    <text x="80" y="272" fill="#151612" font-family="Georgia, 'Times New Roman', serif" font-size="52">Everything fashion.</text>
    <text x="80" y="333" fill="#151612" font-family="Georgia, 'Times New Roman', serif" font-size="52">Worldwide shipment.</text>
    <line x1="82" y1="388" x2="484" y2="388" stroke="#151612" stroke-opacity="0.5" stroke-width="1"/>
    <text x="82" y="430" fill="#151612" font-family="Arial, Helvetica, sans-serif" font-size="14" letter-spacing="2.2">PERSONAL SHOPPING · LUXURY SOURCING</text>
    <text x="82" y="548" fill="#151612" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="600" letter-spacing="1.2">fieldio.shop</text>
  </svg>
`);

await sharp(sourcePath)
  .resize(width, height, { fit: "cover", position: "center" })
  .composite([
    { input: typography, left: 0, top: 0 },
    { input: mark, left: 82, top: 58 },
  ])
  .jpeg({ quality: 90, chromaSubsampling: "4:4:4", progressive: true })
  .toFile("public/og-image.jpg");

const metadata = await sharp("public/og-image.jpg").metadata();
console.log(`Created public/og-image.jpg (${metadata.width}x${metadata.height})`);
