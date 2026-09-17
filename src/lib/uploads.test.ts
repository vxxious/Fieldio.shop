import { expect, it } from "vitest";
import { IMAGE_UPLOAD_TYPES, MAX_UPLOAD_BYTES, uploadExtension, validateUpload } from "./uploads";

it("uses the verified MIME type for upload names and rejects invalid files", () => {
  const disguisedImage = new File(["image"], "payload.html", { type: "image/jpeg" });
  expect(uploadExtension(disguisedImage)).toBe("jpg");
  expect(validateUpload(disguisedImage, IMAGE_UPLOAD_TYPES)).toBe("");

  const executable = new File(["binary"], "payload.exe", { type: "application/x-msdownload" });
  expect(validateUpload(executable, IMAGE_UPLOAD_TYPES)).toBe("Choose a supported file type.");

  const oversized = new File(["image"], "large.jpg", { type: "image/jpeg" });
  Object.defineProperty(oversized, "size", { value: MAX_UPLOAD_BYTES + 1 });
  expect(validateUpload(oversized, IMAGE_UPLOAD_TYPES)).toBe("Each file must be under 10 MB.");
});
