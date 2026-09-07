import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Import only the image in the user's official-logo message from this session.
const sessionPath = process.argv[2];
if (!sessionPath) throw new Error("Pass the current session attachment record.");
const lines = (await readFile(sessionPath, "utf8")).split("\n");
let dataUrl;
for (const line of lines) {
  if (!line.includes("official brand logo")) continue;
  let entry;
  try { entry = JSON.parse(line); } catch { continue; }
  const message = entry.payload;
  if (entry.type !== "response_item" || message?.role !== "user" || !Array.isArray(message.content)) continue;
  const matches = message.content.some((item) => item.type === "input_text" && item.text.includes("official brand logo"));
  if (!matches) continue;
  const image = message.content.find((item) => item.type === "input_image");
  if (image) dataUrl = image.image_url;
}
if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) throw new Error("No inline logo attachment was found in the matching user message.");
const match = /^data:image\/(png|jpeg|webp);base64,(.+)$/s.exec(dataUrl);
if (!match) throw new Error("Unsupported attachment encoding.");
const directory = path.resolve("public/brand");
await mkdir(directory, { recursive: true });
const destination = path.join(directory, `fieldio-original.${match[1] === "jpeg" ? "jpg" : match[1]}`);
await writeFile(destination, Buffer.from(match[2], "base64"));
console.log(`Imported user-supplied logo: ${destination}`);
