import type { Browser, BrowserContext, Page } from "@playwright/test";
import { join } from "node:path";

// The test's stand-in for the PeerJS broker and the network between devices. Each "device" is its own
// browser context (its own storage, as a real second device has). The page-side stand-in
// (fake-peerjs.js) hands every message to window.__relaySend; the relay delivers it to the pages of every
// other device through window.__relayReceive, in order.

interface Message {
  kind: string;
  id?: string;
  conn?: string;
}

export class Relay {
  private readonly pages = new Set<Page>();
  private readonly queue = new Map<Page, Promise<unknown>>();
  private readonly devices: BrowserContext[] = [];

  /** Make a context part of the network: the stand-in replaces PeerJS and its messages go through the relay. */
  async attach(context: BrowserContext): Promise<void> {
    await context.exposeBinding("__relaySend", ({ page }, message: unknown) => {
      this.note(page, message as Message);
      for (const other of this.pages) if (other !== page && other.context() !== page.context()) this.deliver(other, message);
    });
    await context.route("**/peerjs.min.js", (route) => route.fulfill({ path: join(import.meta.dirname, "fake-peerjs.js"), contentType: "text/javascript" }));
    const track = (page: Page) => {
      this.pages.add(page);
      // a page that reloads or closes takes its ids and connections with it, as on a real network. A change of the #/ part of the
      // address (opening help over a game, moving between screens) is the same page, so its connections stay.
      let last = "about:blank";
      page.on("framenavigated", (frame) => {
        if (frame !== page.mainFrame()) return;
        const now = frame.url();
        const sameDocument = now !== last && now.split("#")[0] === last.split("#")[0];
        last = now;
        if (!sameDocument) this.vanish(page);
      });
      page.on("close", () => {
        this.vanish(page);
        this.pages.delete(page);
      });
    };
    context.pages().forEach(track);
    context.on("page", track);
  }

  /** What each page has registered and connected, so the relay can undo it when the page goes. */
  private readonly owned = new Map<Page, { ids: Set<string>; conns: Set<string> }>();

  private note(page: Page, m: Message): void {
    const own = this.owned.get(page) ?? { ids: new Set<string>(), conns: new Set<string>() };
    this.owned.set(page, own);
    if (m.kind === "register" && m.id) own.ids.add(m.id);
    else if (m.kind === "unregister" && m.id) own.ids.delete(m.id);
    else if (m.kind === "connect" && m.conn) own.conns.add(m.conn);
    else if (m.kind === "ack" && m.conn) own.conns.add(m.conn);
    else if (m.kind === "close" && m.conn) own.conns.delete(m.conn);
  }

  private vanish(page: Page): void {
    const own = this.owned.get(page);
    if (!own) return;
    this.owned.delete(page);
    const messages: Message[] = [...own.conns].map((conn) => ({ kind: "close", conn }));
    messages.push(...[...own.ids].map((id) => ({ kind: "unregister", id })));
    for (const other of this.pages) {
      if (other === page || other.context() === page.context()) continue;
      for (const m of messages) this.deliver(other, m);
    }
  }

  private deliver(page: Page, message: unknown): void {
    const previous = this.queue.get(page) ?? Promise.resolve();
    const next = previous.then(() => page.evaluate((m) => (window as unknown as { __relayReceive?: (m: unknown) => void }).__relayReceive?.(m), message)).catch(() => undefined);
    this.queue.set(page, next);
  }

  /** A new device: its own browser context on the network, with one page open. */
  async device(browser: Browser, options: { colorScheme?: "light" | "dark" } = {}): Promise<{ context: BrowserContext; page: Page }> {
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, ...options });
    this.devices.push(context);
    await this.attach(context);
    const page = await context.newPage();
    return { context, page };
  }

  async closeAll(): Promise<void> {
    await Promise.all(this.devices.map((c) => c.close().catch(() => undefined)));
  }
}
