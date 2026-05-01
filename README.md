# Monobank MCP Server (Node.js/TypeScript)

> **Node.js/TypeScript implementation** of the [Monobank MCP Server](https://github.com/nklymok/Monobank-MCP) originally written in Python.

Monobank MCP Server exposes your Monobank personal account (and public exchange rates) as Model Context Protocol (MCP) tools.

## About This Version

This is a **Node.js/TypeScript port** of the original Python implementation by [@nklymok](https://github.com/nklymok).

- **Original Python version**: https://github.com/nklymok/Monobank-MCP
- **This TypeScript version**: Maintains the same core personal-account tools with Node.js/TypeScript ecosystem benefits, plus a public rates tool that needs no token.

## Features

- TypeScript/Node.js MCP server using the official `@modelcontextprotocol/sdk`
- MCP tools:
  - **`get_client_info`** – client identity, accounts, and jars. Pass **`api_token`** (Monobank personal token) per request, or set **`MONOBANK_API_TOKEN`** on the server as a default.
  - **`get_statement`** – account statement for a time window (same token rules as `get_client_info`). Validates the period before calling the API; responses use amounts in main units and ISO 8601 UTC times for transactions.
  - **`get_currency_rates`** – public currency exchange rates from Monobank (`GET /bank/currency`). **No API token required.**

## Usage (Published Package)

The easiest way to use this MCP server is via the published npm package:

1. **Register the server in your MCP configuration**

   ```json
   {
     "mcpServers": {
       "monobank-mcp": {
         "command": "npx",
         "args": ["-y", "@alerix/monobank-mcp"],
         "env": {
           "MONOBANK_API_TOKEN": "your_token_here"
         }
       }
     }
   }
   ```

   Set `MONOBANK_API_TOKEN` only as a **default** for your own machine, or omit it when each user passes **`api_token`** on **`get_client_info`** / **`get_statement`** (needed for shared or hosted MCP so every user reaches **their** Monobank account). **`get_currency_rates`** works without any token.

2. **Run your MCP client** – the tools will be available according to your configuration.

## Development

If you want to contribute or modify the server:

1. **Clone and install dependencies**

   ```bash
   git clone https://github.com/aler1x/monobank-mcp.git
   cd monobank-mcp
   npm install
   ```

2. **Run the server** after install (`prepare` runs `npm run build`). For personal tools, either pass **`api_token`** in tool calls or set **`MONOBANK_API_TOKEN`** as a default.

   **Windows (PowerShell):**

   ```powershell
   $env:MONOBANK_API_TOKEN="your_token_here"
   node dist/index.js
   ```

   **Windows (Command Prompt):**

   ```cmd
   set MONOBANK_API_TOKEN=your_token_here
   node dist\index.js
   ```

   **macOS/Linux:**

   ```bash
   export MONOBANK_API_TOKEN=your_token_here
   node dist/index.js
   ```

   **Or one line:**

   ```bash
   MONOBANK_API_TOKEN=your_token_here node dist/index.js
   ```

3. **Development with hot reload** (uses `tsx --watch`):

   ```bash
   MONOBANK_API_TOKEN=your_token_here npm run dev
   ```

4. **Build** (TypeScript → `dist/`):

   ```bash
   npm run build
   ```

## Tool Reference

| Tool                  | Description                                                                                                                                                                                                                                                                                                                                                              | Token | Rate limits (Monobank) |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ---------------------- |
| `get_client_info`     | Fetches client profile, list of accounts and jars. Optional **`api_token`**: caller’s Monobank token; if omitted, **`MONOBANK_API_TOKEN`** env is used when set.                                                                                                                                                                                                                                                                                                                       | Yes¹  | 1 request / 60 s       |
| `get_statement`     | Retrieves transactions for an account and period. Same **`api_token`** rules as `get_client_info`. Parameters: **`account_id`** (from `get_client_info` or `'0'` for default), **`from_timestamp`** (Unix seconds), optional **`to_timestamp`** (Unix seconds; omit for “now”). Period from `from_timestamp` to the end (`to_timestamp` or now) must be **≤ 31 days + 1 hour** (aligned with the API). Amounts are returned in major units; times as ISO 8601 UTC. Omits `id`, `invoiceId`, `counterEdrpou`, `counterIban`. | Yes¹  | 1 request / 60 s       |
| `get_currency_rates` | Public exchange rates (ISO 4217 numeric currency codes). Same data as Monobank `GET /bank/currency`.                                                                                                                                                                                                                                                                      | No    | Per Monobank public API |

¹ Token via **`api_token`** argument and/or **`MONOBANK_API_TOKEN`** (argument wins when both are present).

## API Token

Personal tools need a Monobank personal API token. See the official docs: https://api.monobank.ua/index.html

## Environment Variables

| Name                 | Required | Description |
| -------------------- | -------- | ----------- |
| `MONOBANK_API_TOKEN` | Optional | Default Monobank personal API token when **`api_token`** is not passed to **`get_client_info`** / **`get_statement`**. For multi-user setups, prefer **`api_token`** per call instead of sharing one env var on the server. Not used by **`get_currency_rates`**. |

## License

MIT
