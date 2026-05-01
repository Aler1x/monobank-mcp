#!/usr/bin/env node

import { startMonobankMcpHttpServer } from "./http-server.js";

const portRaw = process.env.PORT ?? "3333";
const port = Number.parseInt(portRaw, 10);
if (!Number.isFinite(port) || port < 1 || port > 65535) {
  console.error(`Invalid PORT: ${portRaw}`);
  process.exit(1);
}

const host = process.env.HOST ?? "0.0.0.0";
startMonobankMcpHttpServer(port, host);
