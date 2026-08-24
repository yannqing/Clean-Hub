import { createServer, request } from "node:http";
import { connect } from "node:net";

const listenPort = Number.parseInt(
  process.env.REALTIME_INTEGRATION_PROXY_PORT ?? "4011",
  10,
);
const targetPort = Number.parseInt(
  process.env.REALTIME_INTEGRATION_TARGET_PORT ?? "4000",
  10,
);

function stripApiPrefix(url: string | undefined): string {
  const value = url ?? "/";
  if (value === "/api") return "/";
  return value.startsWith("/api/") ? value.slice(4) : value;
}

const proxy = createServer((incoming, outgoing) => {
  const upstream = request(
    {
      host: "127.0.0.1",
      port: targetPort,
      method: incoming.method,
      path: stripApiPrefix(incoming.url),
      headers: incoming.headers,
    },
    (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    },
  );
  upstream.on("error", () => {
    if (!outgoing.headersSent) outgoing.writeHead(502);
    outgoing.end();
  });
  incoming.pipe(upstream);
});

proxy.on("upgrade", (incoming, socket, head) => {
  const upstream = connect(targetPort, "127.0.0.1", () => {
    const headers = Object.entries(incoming.headers)
      .flatMap(([name, value]) =>
        Array.isArray(value)
          ? value.map((item) => `${name}: ${item}`)
          : value === undefined
            ? []
            : [`${name}: ${value}`],
      )
      .join("\r\n");
    upstream.write(
      `${incoming.method ?? "GET"} ${stripApiPrefix(incoming.url)} HTTP/${incoming.httpVersion}\r\n${headers}\r\n\r\n`,
    );
    if (head.length > 0) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on("error", () => socket.destroy());
});

await new Promise<void>((resolve, reject) => {
  proxy.once("error", reject);
  proxy.listen(listenPort, "127.0.0.1", resolve);
});

process.env.REALTIME_INTEGRATION_API_URL = `http://127.0.0.1:${listenPort}/api`;

try {
  await import("./realtime.handshake.integration.js");
  console.log("Realtime reverse-proxy prefix integration passed.");
} finally {
  proxy.closeAllConnections();
  await new Promise<void>((resolve) => proxy.close(() => resolve()));
}
