import { createMockServer } from "./server";
import type { MockServer } from "./server";

let instance: MockServer | undefined;

/** The browser's mock server, created on first use. Its SIWE domain is the page's own host, as a real backend's is. */
export function getMockServer(): MockServer {
  instance ??= createMockServer({
    siwe: { domain: window.location.host, uri: window.location.origin },
  });
  return instance;
}
