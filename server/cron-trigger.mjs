#!/usr/bin/env node
// Trigger a cron job via OpenClaw gateway WebSocket
// Usage: node cron-trigger.mjs <jobId>
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import WebSocket from "ws";

const jobId = process.argv[2];
if (!jobId) { console.log(JSON.stringify({success:false, error:"missing jobId"})); process.exit(1); }

const configPath = join(homedir(), ".openclaw", "openclaw.json");
const config = JSON.parse(readFileSync(configPath, "utf-8"));
const port = config.gateway?.port || 18789;
const token = config.gateway?.auth?.token || "";

const ws = new WebSocket(`ws://127.0.0.1:${port}`);
let connectNonce = null;
let connected = false;
const pending = new Map();

const timeout = setTimeout(() => {
  console.log(JSON.stringify({success:false, error:"timeout"}));
  ws.close();
  process.exit(1);
}, 10000);

function send(obj) { ws.send(JSON.stringify(obj)); }

function request(method, params) {
  const id = randomUUID();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    send({ type: "req", id, method, params });
  });
}

ws.on("message", (data) => {
  try {
    const msg = JSON.parse(data.toString());

    // Event frame
    if (msg.type === "event") {
      if (msg.event === "connect.challenge") {
        connectNonce = msg.payload?.nonce;
        // Send connect request
        request("connect", {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: "gateway-client",
            displayName: "Memory Viewer",
            version: "1.0.0",
            platform: "linux",
            mode: "backend",
          },
          caps: [],
          auth: { token },
          role: "operator",
          scopes: ["operator.admin"],
        }).then(() => {
          connected = true;
          // Send cron.run — it's async, so fire and consider it triggered
          const cronId = randomUUID();
          ws.send(JSON.stringify({type:'req', id:cronId, method:'cron.run', params:{id: jobId}}));
          // Give it a moment to dispatch, then report success
          setTimeout(() => {
            clearTimeout(timeout);
            console.log(JSON.stringify({success:true, result:'triggered'}));
            ws.close();
            process.exit(0);
          }, 500);
        }).catch((err) => {
          clearTimeout(timeout);
          console.log(JSON.stringify({success:false, error: err.message}));
          ws.close();
          process.exit(1);
        });
      }
      return;
    }

    // Response frame
    if (msg.type === "res") {
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.payload);
      else p.reject(new Error(msg.error?.message || "unknown error"));
    }
  } catch {}
});

ws.on("error", (err) => {
  clearTimeout(timeout);
  console.log(JSON.stringify({success:false, error: err.message}));
  process.exit(1);
});
