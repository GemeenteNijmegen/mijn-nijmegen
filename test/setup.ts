import { vi } from "vitest";

if (process.env.VERBOSETESTS != 'True') {
  global.console = {
    ...console,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }
}