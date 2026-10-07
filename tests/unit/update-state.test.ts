import { test } from "node:test";
import assert from "node:assert/strict";
import { createUpdateState, UPDATE_READY_EVENT, type Snapshot } from "../../src/ui/update-state.ts";

// The state behind the update bar (contracts C3.6 and C3.7): a worker waits, the bar shows, nothing happens until the
// player presses Update, and a replacement takes over only then. Framework-free and store-compatible, so a component
// subscribes to it and this test runs in node.

class FakeContainer extends EventTarget {
  controller: object | null;
  registered: { url: string; options: unknown }[] = [];
  registration: FakeRegistration;
  constructor(controller: object | null = null, registration = new FakeRegistration()) {
    super();
    this.controller = controller;
    this.registration = registration;
  }
  register(url: URL, options: unknown): Promise<FakeRegistration> {
    this.registered.push({ url: url.href, options });
    return Promise.resolve(this.registration);
  }
}

class FakeRegistration extends EventTarget {
  waiting: FakeWorker | null = null;
  installing: FakeWorker | null = null;
  updates = 0;
  update(): Promise<void> {
    this.updates++;
    return Promise.resolve();
  }
}

class FakeWorker extends EventTarget {
  state = "installing";
  messages: unknown[] = [];
  postMessage(message: unknown): void {
    this.messages.push(message);
  }
}

const options = (extra: Partial<Parameters<typeof createUpdateState>[0]> = {}) => ({
  events: new EventTarget(),
  container: new FakeContainer() as never,
  reload: () => undefined,
  baseURI: "https://example.test/ultimattt/",
  ...extra,
});

function snapshots(state: ReturnType<typeof createUpdateState>): Snapshot[] {
  const seen: Snapshot[] = [];
  state.subscribe((s) => seen.push(s));
  return seen;
}

test("nothing waits at first, and a subscriber is called at once with that", () => {
  const state = createUpdateState(options());
  const seen = snapshots(state);
  assert.deepEqual(seen, [{ waiting: null, applying: false }]);
});

test("offer sets the waiting worker and tells subscribers; unsubscribing stops the calls", () => {
  const state = createUpdateState(options());
  const worker = new FakeWorker();
  const seen: Snapshot[] = [];
  const stop = state.subscribe((s) => seen.push(s));
  state.offer(worker);
  assert.equal(seen.length, 2);
  assert.equal(seen[1]!.waiting, worker);
  stop();
  state.offer(new FakeWorker());
  assert.equal(seen.length, 2);
});

test("the ttt:update-ready window event offers the worker in its detail", () => {
  const events = new EventTarget();
  const state = createUpdateState(options({ events }));
  const worker = { postMessage() {} };
  events.dispatchEvent(new CustomEvent(UPDATE_READY_EVENT, { detail: worker }));
  assert.equal(state.get().waiting, worker);
  assert.equal(UPDATE_READY_EVENT, "ttt:update-ready");
});

test("an event with no worker in it is ignored", () => {
  const events = new EventTarget();
  const state = createUpdateState(options({ events }));
  events.dispatchEvent(new CustomEvent(UPDATE_READY_EVENT, { detail: null }));
  events.dispatchEvent(new Event(UPDATE_READY_EVENT));
  assert.equal(state.get().waiting, null);
});

test("apply posts skip-waiting once, marks the state applying, and ignores a second press", () => {
  const state = createUpdateState(options());
  const worker = new FakeWorker();
  state.offer(worker);
  state.apply();
  state.apply();
  assert.deepEqual(worker.messages, [{ type: "skip-waiting" }]);
  assert.equal(state.get().applying, true);
});

test("apply with nothing waiting does nothing", () => {
  const state = createUpdateState(options());
  assert.doesNotThrow(() => state.apply());
  assert.equal(state.get().applying, false);
});

test("a new worker taking control reloads the page when a worker already controlled it", () => {
  let reloads = 0;
  const container = new FakeContainer({});
  createUpdateState(options({ container: container as never, reload: () => void reloads++ }));
  container.dispatchEvent(new Event("controllerchange"));
  container.dispatchEvent(new Event("controllerchange"));
  assert.equal(reloads, 1);
});

test("the first worker taking control of a first visit needs no reload", () => {
  let reloads = 0;
  const container = new FakeContainer(null);
  createUpdateState(options({ container: container as never, reload: () => void reloads++ }));
  container.dispatchEvent(new Event("controllerchange"));
  assert.equal(reloads, 0);
});

test("register resolves the worker's address and scope from the document base", async () => {
  const container = new FakeContainer();
  const state = createUpdateState(options({ container: container as never, baseURI: "https://example.test/ultimattt/?watch=abc" }));
  await state.register();
  assert.deepEqual(container.registered, [{ url: "https://example.test/ultimattt/service-worker.js", options: { scope: "/ultimattt/" } }]);
});

test("register at the site root uses the root", async () => {
  const container = new FakeContainer();
  const state = createUpdateState(options({ container: container as never, baseURI: "https://example.test/" }));
  await state.register();
  assert.deepEqual(container.registered, [{ url: "https://example.test/service-worker.js", options: { scope: "/" } }]);
});

test("register offers a worker that is already waiting when a worker controls the page", async () => {
  const registration = new FakeRegistration();
  const waiting = new FakeWorker();
  registration.waiting = waiting;
  const state = createUpdateState(options({ container: new FakeContainer({}, registration) as never }));
  await state.register();
  assert.equal(state.get().waiting, waiting);
});

test("register does not offer a waiting worker on a first visit", async () => {
  const registration = new FakeRegistration();
  registration.waiting = new FakeWorker();
  const state = createUpdateState(options({ container: new FakeContainer(null, registration) as never }));
  await state.register();
  assert.equal(state.get().waiting, null);
});

test("register offers a worker that finishes installing while one controls the page", async () => {
  const registration = new FakeRegistration();
  const state = createUpdateState(options({ container: new FakeContainer({}, registration) as never }));
  await state.register();
  const installing = new FakeWorker();
  registration.installing = installing;
  registration.dispatchEvent(new Event("updatefound"));
  installing.state = "installed";
  installing.dispatchEvent(new Event("statechange"));
  assert.equal(state.get().waiting, installing);
});

test("register swallows a failed registration, so the app still plays online", async () => {
  const container = new FakeContainer();
  container.register = () => Promise.reject(new Error("no worker here"));
  const state = createUpdateState(options({ container: container as never }));
  await assert.doesNotReject(state.register());
});

test("with no service worker support, register does nothing", async () => {
  const state = createUpdateState(options({ container: undefined }));
  await assert.doesNotReject(state.register());
  assert.equal(state.get().waiting, null);
});
