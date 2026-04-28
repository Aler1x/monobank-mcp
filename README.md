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
  - **`get_client_info`** – client identity, accounts, and jars (requires `MONOBANK_API_TOKEN`).
  - **`get_statement`** – account statement for a time window (requires token). Validates the period before calling the API; responses use amounts in main units and ISO 8601 UTC times for transactions.
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

   Set `MONOBANK_API_TOKEN` only if you use **`get_client_info`** or **`get_statement`**. **`get_currency_rates`** works without it.

2. **Run your MCP client** – the tools will be available according to your configuration.

## Development

If you want to contribute or modify the server:

1. **Clone and install dependencies**

   ```bash
   git clone https://github.com/aler1x/monobank-mcp.git
   cd monobank-mcp
   npm install
   ```

2. **Run the server** after install (`prepare` runs `npm run build`). For personal tools, set `MONOBANK_API_TOKEN`.

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
| `get_client_info`     | Fetches client profile, list of accounts and jars.                                                                                                                                                                                                                                                                                                                       | Yes   | 1 request / 60 s       |
| `get_statement`     | Retrieves transactions for an account and period. Parameters: **`account_id`** (from `get_client_info` or `'0'` for default), **`from_timestamp`** (Unix seconds), optional **`to_timestamp`** (Unix seconds; omit for “now”). Period from `from_timestamp` to the end (`to_timestamp` or now) must be **≤ 31 days + 1 hour** (aligned with the API). Amounts are returned in major units; times as ISO 8601 UTC. Omits `id`, `invoiceId`, `counterEdrpou`, `counterIban`. | Yes   | 1 request / 60 s       |
| `get_currency_rates` | Public exchange rates (ISO 4217 numeric currency codes). Same data as Monobank `GET /bank/currency`.                                                                                                                                                                                                                                                                      | No    | Per Monobank public API |

## API Token

Personal tools need a Monobank personal API token. See the official docs: https://api.monobank.ua/index.html

## Environment Variables

| Name                 | Required | Description |
| -------------------- | -------- | ----------- |
| `MONOBANK_API_TOKEN` | For **`get_client_info`** and **`get_statement`** only | Your personal Monobank API token from https://api.monobank.ua/index.html. Not used by **`get_currency_rates`**. |

## License

MIT
