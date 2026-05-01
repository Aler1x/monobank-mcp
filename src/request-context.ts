import { AsyncLocalStorage } from "node:async_hooks";

type MonobankRequestStore = {
  monobankToken?: string;
};

const monobankAls = new AsyncLocalStorage<MonobankRequestStore>();

export function runWithMonobankToken<T>(token: string | undefined, fn: () => T): T {
  return monobankAls.run({ monobankToken: token }, fn);
}

export async function runWithMonobankTokenAsync<T>(
  token: string | undefined,
  fn: () => Promise<T>
): Promise<T> {
  return monobankAls.run({ monobankToken: token }, fn);
}

export function getMonobankTokenFromRequestContext(): string | undefined {
  return monobankAls.getStore()?.monobankToken;
}
