#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Types
interface Account {
  id: string;
  sendId: string;
  balance: number;
  creditLimit: number;
  type: string;
  currencyCode: number;
  cashbackType: string;
  maskedPan: string[];
  iban: string;
}

interface Jar {
  id: string;
  sendId: string;
  title: string;
  description?: string;
  currencyCode: number;
  balance: number;
  goal?: number;
}

interface ClientInfo {
  clientId: string;
  name: string;
  webHookUrl: string;
  permissions: string;
  accounts: Account[];
  jars?: Jar[];
}

interface StatementItem {
  id: string;
  time: number;
  description: string;
  mcc: number;
  originalMcc: number;
  hold: boolean;
  amount: number;
  operationAmount: number;
  currencyCode: number;
  commissionRate: number;
  cashbackAmount: number;
  balance: number;
  comment?: string;
  receiptId?: string;
  invoiceId?: string;
  counterEdrpou?: string;
  counterIban?: string;
  counterName?: string;
}

interface ProcessedStatementItem {
  time: string;
  description: string;
  mcc: number;
  originalMcc: number;
  hold: boolean;
  amount: number;
  operationAmount: number;
  currencyCode: number;
  commissionRate: number;
  cashbackAmount: number;
  balance: number;
  comment?: string;
  receiptId?: string;
  counterName?: string;
}

// Zod schemas for validation
const GetStatementArgsSchema = z.object({
  account_id: z.string().describe("Account identifier from the list of accounts, or '0' for default"),
  from_timestamp: z.number().describe("Start of the statement period (Unix timestamp)"),
  to_timestamp: z.number().describe("End of the statement period (Unix timestamp)"),
});

async function getClientInfo() {
    /**
   * Get client information from Monobank API.
   * 
   * This tool retrieves information about the client, their accounts, and jars.
   * It requires a Monobank API token with the necessary permissions.
   */
  try {
    const token = process.env.MONOBANK_API_TOKEN;
    
    const response = await fetch(`https://api.monobank.ua/personal/client-info`, {
      headers: {
        "X-Token": token || "X_TOKEN_PLACEHOLDER",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data: ClientInfo = await response.json() as ClientInfo;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to connect to Monobank API: ${error.message}`);
    }
    throw new Error(`Failed to connect to Monobank API: ${String(error)}`);
  }
}

async function getStatement(args: unknown) {
  /**
   * Get account statement for a given period.
   * Rate limit: 1 request per 60 seconds.
   * Max period: 31 days + 1 hour.
   * 
   * Rules:
   * 1. Fetch from default account (account_id = "0") unless another account is specified.
   * 2. Amounts are converted from the smallest currency unit (e.g., kopiyka, cent)
   *    to the main unit and returned as decimals.
   * 3. Transaction timestamps ("time") are converted from Unix timestamps to
   *    ISO 8601 datetime strings (UTC).
   * 4. Fields "id", "invoiceId", "counterEdrpou", and "counterIban" are omitted
   *    from the returned results.
   */
  const parsed = GetStatementArgsSchema.parse(args);
  const { account_id, from_timestamp, to_timestamp } = parsed;

  const finalToTimestamp = to_timestamp || Math.floor(Date.now() / 1000);

  try {
    const response = await fetch(
      `https://api.monobank.ua/personal/statement/${account_id}/${from_timestamp}/${finalToTimestamp}`,
      {
        headers: {
          "X-Token": process.env.MONOBANK_API_TOKEN || "X_TOKEN_PLACEHOLDER",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data: StatementItem[] = await response.json() as StatementItem[];

    const processedItems: ProcessedStatementItem[] = data.map((item) => {
      const time = new Date(item.time * 1000).toISOString();
      
      const processedItem: ProcessedStatementItem = {
        time,
        description: item.description,
        mcc: item.mcc,
        originalMcc: item.originalMcc,
        hold: item.hold,
        amount: item.amount / 100,
        operationAmount: item.operationAmount / 100,
        currencyCode: item.currencyCode,
        commissionRate: item.commissionRate / 100,
        cashbackAmount: item.cashbackAmount / 100,
        balance: item.balance / 100,
        comment: item.comment,
        receiptId: item.receiptId,
        counterName: item.counterName,
      };

      return processedItem;
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(processedItems, null, 2),
        },
      ],
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to connect to Monobank API: ${error.message}`);
    }
    throw new Error(`Failed to connect to Monobank API: ${String(error)}`);
  }
}

function setupServer() {
  const server = new Server(
    {
      name: "monobank",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "get_client_info",
        description: "Get client information from Monobank API. This tool retrieves information about the client, their accounts, and jars. It requires a Monobank API token with the necessary permissions.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "get_statement",
        description: "Get account statement for a given period. Rate limit: 1 request per 60 seconds. Max period: 31 days + 1 hour. Rules: 1. Fetch from default account (account_id = '0') unless another account is specified. 2. Amounts are converted from the smallest currency unit (e.g., kopiyka, cent) to the main unit and returned as decimals. 3. Transaction timestamps ('time') are converted from Unix timestamps to ISO 8601 datetime strings (UTC). 4. Fields 'id', 'invoiceId', 'counterEdrpou', and 'counterIban' are omitted from the returned results.",
        inputSchema: {
          type: "object",
          properties: {
            account_id: {
              type: "string",
              description: "Account identifier from the list of accounts, or '0' for default",
            },
            from_timestamp: {
              type: "number",
              description: "Start of the statement period (Unix timestamp)",
            },
            to_timestamp: {
              type: "number",
              description: "End of the statement period (Unix timestamp)",
            },
          },
          required: ["account_id", "from_timestamp", "to_timestamp"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    switch (request.params.name) {
      case "get_client_info":
        return await getClientInfo();
      case "get_statement":
        return await getStatement(request.params.arguments);
      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  });

  return server;
}

async function main() {
  try {
    const server = setupServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Monobank MCP server running on stdio");
  } catch (error) {
    console.error(`Error starting server: ${error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`Unhandled error: ${error}`);
  process.exit(1);
});
