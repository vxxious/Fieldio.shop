import { renameSync } from "node:fs";

// Vercel serves a static index.html before applying the homepage rewrite.
renameSync("dist/index.html", "dist/app-shell.html");
