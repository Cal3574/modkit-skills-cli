import ora, { type Ora } from "ora";
import pc from "picocolors";

import type { PromptContext, SkillEntry, Writer } from "./types.js";

interface TtyLike {
  isTTY?: boolean;
}

function hasTty(value: unknown): value is TtyLike {
  return typeof value === "object" && value !== null && "isTTY" in value;
}

export function isInteractiveOutput(stdout: Writer): boolean {
  return hasTty(stdout) && stdout.isTTY === true;
}

export function isInteractiveContext({ stdin, stdout }: PromptContext): boolean {
  return hasTty(stdin) && stdin.isTTY === true && isInteractiveOutput(stdout);
}

export function formatHeading(stdout: Writer, text: string): string {
  return isInteractiveOutput(stdout) ? pc.bold(pc.cyan(text)) : text;
}

export function formatMuted(stdout: Writer, text: string): string {
  return isInteractiveOutput(stdout) ? pc.dim(text) : text;
}

export function formatAccent(stdout: Writer, text: string): string {
  return isInteractiveOutput(stdout) ? pc.bold(text) : text;
}

export function formatInstalledLabel(stdout: Writer): string {
  return isInteractiveOutput(stdout) ? pc.yellow("[installed]") : "[installed]";
}

export function formatSuccess(stdout: Writer, text: string): string {
  return isInteractiveOutput(stdout) ? pc.green(text) : text;
}

export function formatWarning(stdout: Writer, text: string): string {
  return isInteractiveOutput(stdout) ? pc.yellow(text) : text;
}

export function formatFailure(stdout: Writer, text: string): string {
  return isInteractiveOutput(stdout) ? pc.red(text) : text;
}

export function formatSkillChoice(stdout: Writer, skill: SkillEntry, isInstalled: boolean): string {
  const installedLabel = isInstalled ? ` ${formatInstalledLabel(stdout)}` : "";
  return [
    `${formatAccent(stdout, skill.title)}${installedLabel}`,
    formatMuted(stdout, skill.name),
    formatMuted(stdout, skill.description)
  ].join("\n");
}

export function renderBrandHeader(stdout: Writer): void {
  const lines = [
    " __  __           _ _    _ _   ",
    "|  \\/  | ___   __| | | _(_) |_ ",
    "| |\\/| |/ _ \\ / _` | |/ / | __|",
    "| |  | | (_) | (_| |   <| | |_ ",
    "|_|  |_|\\___/ \\__,_|_|\\_\\_|\\__|"
  ];

  if (isInteractiveOutput(stdout)) {
    stdout.write(`${pc.bold(pc.cyan(lines.join("\n")))}\n`);
    stdout.write(`${pc.dim("Install reusable AI skills into your project")}`);
    stdout.write("\n\n");
    return;
  }

  stdout.write(`${lines.join("\n")}\n`);
  stdout.write("Install reusable AI skills into your project\n\n");
}

export function createSpinner(stdout: Writer, text: string): Ora | null {
  if (!isInteractiveOutput(stdout)) {
    return null;
  }

  return ora({
    text,
    isEnabled: true,
    discardStdin: false
  }).start();
}
