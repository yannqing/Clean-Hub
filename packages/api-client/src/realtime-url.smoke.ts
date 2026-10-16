import assert from "node:assert/strict";

import { buildWebSocketUrl } from "./http-client.js";

const previousLocation = globalThis.location;

try {
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { origin: "https://pos.cleanhub.example.com" },
  });

  assert.equal(
    buildWebSocketUrl("/api", "/realtime/pos"),
    "wss://pos.cleanhub.example.com/api/realtime/pos",
  );
  assert.equal(
    buildWebSocketUrl(
      "https://api.cleanhub.example.com/v1",
      "/realtime/tenant",
    ),
    "wss://api.cleanhub.example.com/v1/realtime/tenant",
  );
  assert.equal(
    buildWebSocketUrl("http://localhost:4000", "/realtime/pos"),
    "ws://localhost:4000/realtime/pos",
  );
} finally {
  if (previousLocation) {
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: previousLocation,
    });
  } else {
    Reflect.deleteProperty(globalThis, "location");
  }
}

console.log("Realtime URL resolution smoke passed.");
