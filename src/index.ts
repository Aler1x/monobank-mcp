#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { monobankPersonalJson, monobankPublicJson } from "./monobank-http.js";
import type {
  ClientInfo,
  CurrencyRate,
  ProcessedStatementItem,
  StatementItem,
} from "./types.js";

/** Monobank `/personal/statement/...`: max interval is 31 days + 1 hour (API error otherwise). */
const MONO_STATEMENT_MAX_SPAN_SECONDS = 31 * 24 * 60 * 60 + 60 * 60;

const PersonalTokenArgsSchema = z.object({
  api_token: z
    .string()
    .optional()
    .describe(
      "Monobank personal API token for this request (see Monobank app → settings). If omitted, MONOBANK_API_TOKEN from the server environment is used when set."
    ),
});

const GetClientInfoArgsSchema = PersonalTokenArgsSchema;

const GetStatementArgsSchema = PersonalTokenArgsSchema.merge(
  z.object({
    account_id: z
      .string()
      .describe("Account identifier from the list of accounts, or '0' for default"),
    from_timestamp: z
      .number()
      .describe("Start of the statement period (Unix timestamp in seconds)"),
    to_timestamp: z
      .number()
      .optional()
      .describe(
        "End of the statement period (Unix timestamp in seconds). Omit to use the current time."
      ),
  })
)
  .superRefine((data, ctx) => {
    const endSec = data.to_timestamp ?? Math.floor(Date.now() / 1000);
    const spanSec = endSec - data.from_timestamp;

    if (spanSec < 0) {
      ctx.addIssue({
        code: "custom",
        message:
          "from_timestamp must be before the period end (to_timestamp when provided, otherwise now)",
        path: ["from_timestamp"],
      });
      return;
    }

    if (spanSec > MONO_STATEMENT_MAX_SPAN_SECONDS) {
      ctx.addIssue({
        code: "custom",
        message: `Period from from_timestamp to the end (${data.to_timestamp != null ? "to_timestamp" : "now"}) must be at most ${MONO_STATEMENT_MAX_SPAN_SECONDS}s (31 days + 1 hour). Current span: ${spanSec}s`,
        path: ["from_timestamp"],
      });
    }
  });

function formatValidationError(toolName: string, error: z.ZodError): string {
  const details = error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
  return `[validation] Invalid arguments for ${toolName}: ${details}`;
}

async function getClientInfo(args: unknown) {
  const parsed = GetClientInfoArgsSchema.safeParse(args ?? {});
  if (!parsed.success) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: formatValidationError("get_client_info", parsed.error),
        },
      ],
    };
  }

  const data = await monobankPersonalJson<ClientInfo>(
    "/personal/client-info",
    parsed.data.api_token
  );
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

async function getStatement(args: unknown) {
  const parsed = GetStatementArgsSchema.safeParse(args);
  if (!parsed.success) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: formatValidationError("get_statement", parsed.error),
        },
      ],
    };
  }

  const { account_id, from_timestamp, to_timestamp, api_token } = parsed.data;
  const finalToTimestamp = to_timestamp ?? Math.floor(Date.now() / 1000);

  const data = await monobankPersonalJson<StatementItem[]>(
    `/personal/statement/${account_id}/${from_timestamp}/${finalToTimestamp}`,
    api_token
  );

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
}

async function getCurrencyRates() {
  const data = await monobankPublicJson<CurrencyRate[]>("/bank/currency");
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function setupServer() {
  const server = new Server(
    {
      name: "monobank",
      version: "1.3.0",
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
        description:
          "Get client information from Monobank API — client identity, accounts, and jars. Pass api_token for the caller's Monobank personal token, or rely on MONOBANK_API_TOKEN on the server if configured.",
        inputSchema: {
          type: "object",
          properties: {
            api_token: {
              type: "string",
              description:
                "Monobank personal API token for this request. Omit only if the MCP server sets MONOBANK_API_TOKEN as a default.",
            },
          },
          required: [],
        },
      },
      {
        name: "get_statement",
        description:
          "Get account statement for a period. Pass api_token for the caller's Monobank token (or use server MONOBANK_API_TOKEN). Important: Monobank allows at most 31 days + 1 hour between from_timestamp and the period end (to_timestamp if set, otherwise now)—pick a shorter window before calling or the API returns HTTP 400. Rate limit: 1 request per 60 seconds. Amounts are converted from minor units (e.g. kopiykas) to main units; transaction times are ISO 8601 UTC. Omits id, invoiceId, counterEdrpou, counterIban.",
        inputSchema: {
          type: "object",
          properties: {
            api_token: {
              type: "string",
              description:
                "Monobank personal API token for this request. Omit only if the MCP server sets MONOBANK_API_TOKEN as a default.",
            },
            account_id: {
              type: "string",
              description:
                "Account identifier from get_client_info accounts[].id, or '0' for the default account",
            },
            from_timestamp: {
              type: "number",
              description:
                "Start of the period (Unix seconds). Must be strictly before to_timestamp (or before now if to_timestamp omitted). Together with the end instant, span must not exceed 31 days + 1 hour.",
            },
            to_timestamp: {
              type: "number",
              description:
                "End of the period (Unix seconds). Optional; omit to use current time. The span between from_timestamp and this end must be ≤ 31 days + 1 hour.",
            },
          },
          required: ["account_id", "from_timestamp"],
        },
      },
      {
        name: "get_currency_rates",
        description:
          "Get Monobank’s public currency exchange rates (ISO 4217 numeric currency codes). No API token required. Data from GET /bank/currency.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    try {
      switch (request.params.name) {
        case "get_client_info":
          return await getClientInfo(request.params.arguments);
        case "get_statement":
          return await getStatement(request.params.arguments);
        case "get_currency_rates":
          return await getCurrencyRates();
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        content: [{ type: "text", text: message }],
      };
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
