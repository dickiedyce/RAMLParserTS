#!/usr/bin/env node
/**
 * Converts the recorded viewer walkthrough (docs/assets/demo.webm, recorded by
 * `npx playwright test @demo`) into docs/assets/demo.gif.
 *
 * Uses ffmpeg with a generated palette for quality. Usage:
 *   node scripts/make-gif.mjs
 * Set FFMPEG=/path/to/ffmpeg if it is not on PATH.
 */
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const input = "docs/assets/demo.webm";
const output = "docs/assets/demo.gif";
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
const scale = "scale=880:-1:flags=lanczos";
const vf = `fps=10,${scale}`;

if (!existsSync(input)) {
  console.error(
    `Missing ${input}. Record it first: npx playwright test --grep @demo`,
  );
  process.exit(1);
}

const palette = join(tmpdir(), "raml-parser-ts-demo-palette.png");
try {
  execFileSync(
    ffmpeg,
    ["-y", "-i", input, "-vf", `${vf},palettegen=stats_mode=diff`, palette],
    { stdio: "ignore" },
  );
  execFileSync(
    ffmpeg,
    [
      "-y",
      "-i",
      input,
      "-i",
      palette,
      "-lavfi",
      `${vf}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`,
      output,
    ],
    { stdio: "ignore" },
  );
  console.log(`Wrote ${output}`);
} catch {
  console.error(
    `ffmpeg failed (${ffmpeg}). Install it (brew install ffmpeg) or set FFMPEG=/path/to/ffmpeg.`,
  );
  process.exit(1);
} finally {
  rmSync(palette, { force: true });
}
