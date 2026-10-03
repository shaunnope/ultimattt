// A small static file server for the built site, used by the audit and the screenshot script.
//
// It runs inside the calling process rather than as a child process, so it behaves the same on Linux,
// macOS and Windows and stopping it never needs to kill a process tree. Files are never cached, so a
// rebuilt site is what the next request gets.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

/** Serve `dir` on `port` (0 picks a free one). Resolves with the address and a stop() that frees the port. */
export function startStaticServer(dir, port = 0) {
  const root = resolve(dir);
  const server = createServer((req, res) => {
    let path;
    try {
      path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    } catch {
      res.writeHead(400).end("bad request");
      return;
    }
    const wanted = normalize(join(root, path.endsWith("/") ? path + "index.html" : path));
    const inside = wanted === root || wanted.startsWith(root + sep);
    if (!inside || !existsSync(wanted) || statSync(wanted).isDirectory()) {
      res.writeHead(404, { "content-type": "text/plain" }).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(wanted).toLowerCase()] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(readFileSync(wanted));
  });
  let stopped = null;
  return new Promise((resolveStart, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      const { port: actual } = server.address();
      resolveStart({
        url: `http://localhost:${actual}/`,
        stop() {
          stopped ??= new Promise((done) => {
            server.close(() => done());
            server.closeAllConnections?.(); // do not wait for idle keep-alive connections
          });
          return stopped;
        },
      });
    });
  });
}
