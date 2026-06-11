import readline from "node:readline/promises";

import type { PromptContext } from "./types.js";

export function createPromptInterface({ stdin, stdout }: PromptContext): readline.Interface {
  const rl = readline.createInterface({ input: stdin, output: stdout as NodeJS.WritableStream });
  rl.on("SIGINT", () => {
    rl.close();
  });
  return rl;
}

export async function questionOrCancel(rl: readline.Interface, prompt: string): Promise<string | null> {
  try {
    return await rl.question(prompt);
  } catch {
    return null;
  }
}

export function isPromptCancelError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === "ExitPromptError" || error.name === "AbortPromptError";
}
