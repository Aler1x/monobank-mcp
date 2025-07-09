# Monobank MCP Server (Node.js/TypeScript)

> **Node.js/TypeScript implementation** of the [Monobank MCP Server](https://github.com/nklymok/Monobank-MCP) originally written in Python.

Monobank MCP Server exposes your Monobank personal account as Model Context Protocol (MCP) tools.

## About This Version

This is a **Node.js/TypeScript port** of the original Python implementation by [@nklymok](https://github.com/nklymok). 

- **Original Python version**: https://github.com/nklymok/Monobank-MCP
- **This TypeScript version**: Maintains the same functionality with Node.js/TypeScript ecosystem benefits

## Features

- TypeScript/Node.js MCP server using the official @modelcontextprotocol/sdk
- Two ready-to-use MCP tools:
  - `get_client_info` – returns client, accounts and jars metadata.
  - `get_statement` – returns account statement for a given period (≤ 31 days).

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set your Monobank API token** (choose one method):
   
   **Windows (PowerShell):**
   ```powershell
   $env:MONOBANK_API_TOKEN="your_token_here"
   npm start
   ```
   
   **Windows (Command Prompt):**
   ```cmd
   set MONOBANK_API_TOKEN=your_token_here
   npm start
   ```
   
   **macOS/Linux:**
   ```bash
   export MONOBANK_API_TOKEN=your_token_here
   npm start
   ```
   
   **Or run directly with environment variable:**
   ```bash
   MONOBANK_API_TOKEN=your_token_here npm start
   ```

4. **Register the server in your MCP configuration**
   ```json
   {
     "mcpServers": {
       "monobank-mcp": {
         "command": "npx",
         "args": ["-y","monobank-mcp"],
         "env": {
           "MONOBANK_API_TOKEN": "your_token_here"
         }
       }
     }
   }
   ```

5. **Run your MCP client** – the two tools will be available immediately.

## Development

For development with hot reload:
```bash
MONOBANK_API_TOKEN=your_token_here npm run dev
```

## Tool Reference

| Tool              | Description                                                                                                                       | Rate limits      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `get_client_info` | Fetches client profile, list of accounts and jars.                                                                                | 1 request / 60 s |
| `get_statement`   | Retrieves transaction list for a specific account and time range.<br/>Parameters: `account_id`, `from_timestamp`, `to_timestamp`. | 1 request / 60 s |

## API Token

To use this server, you need a personal Monobank API token. You can get one from the official Monobank API documentation: https://api.monobank.ua/index.html

## Environment Variables

| Name                 | Required | Description                       |
| -------------------- | -------- | --------------------------------- |
| `MONOBANK_API_TOKEN` | ✅       | Your personal Monobank API token. Get it from https://api.monobank.ua/index.html |

## License

MIT
