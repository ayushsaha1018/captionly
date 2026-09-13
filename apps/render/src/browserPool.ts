import { existsSync } from "node:fs";
import { platform } from "node:os";
import { openBrowser, type ChromiumOptions } from "@remotion/renderer";

type GlRenderer = NonNullable<ChromiumOptions["gl"]>;

// A GPU render backend (ANGLE) is real hardware acceleration but needs an
// actual GPU device visible to the process; "swangle" is ANGLE's own
// software fallback and works identically on any OS/container, just slower.
// ponytail: presence-check only (no in-process render probe), override with
// REMOTION_GL if a specific box needs a different choice than we'd guess.
export function detectGlRenderer(): GlRenderer {
  const override = process.env.REMOTION_GL;
  if (override) return override as GlRenderer;

  if (platform() === "linux") {
    // Docker/VMs commonly have no GPU passed through; only trust ANGLE's
    // hardware path if a DRM render node or nvidia-smi is actually present.
    const hasGpu = existsSync("/dev/dri") || Bun.which("nvidia-smi") !== null;
    return hasGpu ? "angle" : "swangle";
  }

  // macOS and Windows desktops/VMs almost always expose a real (at least
  // integrated) GPU to Chromium.
  return "angle";
}

// Remotion's own default (null -> half of CPU threads) already leaves
// headroom for the concurrent x264 encode + browser/OS overhead; forcing
// every core to render tabs was the regression — contention, not throughput.
// RENDER_CONCURRENCY lets a specific box override it (number or "N%" string).
export function detectConcurrency(): number | string | null {
  const override = process.env.RENDER_CONCURRENCY;
  if (override) return /^\d+$/.test(override) ? Number(override) : override;
  return null;
}

let browserPromise: Promise<Awaited<ReturnType<typeof openBrowser>>> | null = null;

// Launching headless Chromium takes real time; since renders are already
// serialized through one queue worker, one browser instance can be reused
// across every job for the life of the process instead of relaunching per job.
export function getBrowser() {
  if (!browserPromise) {
    browserPromise = openBrowser("chrome", {
      chromiumOptions: {
        gl: detectGlRenderer(),
        // Already Remotion's own default, but the docs explicitly call this
        // out as worth setting for Docker/Linux render boxes.
        enableMultiProcessOnLinux: true,
      },
    }).then((browser) => {
      browser.on("closed", () => {
        browserPromise = null;
      });
      return browser;
    });
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = null;
  await browser.close({ silent: true });
}
