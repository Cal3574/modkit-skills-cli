import { select } from "@inquirer/prompts";

import { TARGET_OPTIONS } from "./constants.js";
import { createPromptInterface, isPromptCancelError, questionOrCancel } from "./prompt-utils.js";
import { formatHeading, formatMuted, isInteractiveContext, renderBrandHeader } from "./ui.js";
import type { PromptContext, TargetDirectory } from "./types.js";

const optionMap = new Map<string, TargetDirectory>([
  ["1", TARGET_OPTIONS[0]],
  ["2", TARGET_OPTIONS[1]],
  [TARGET_OPTIONS[0], TARGET_OPTIONS[0]],
  [TARGET_OPTIONS[1], TARGET_OPTIONS[1]]
]);

function renderTargetOptions(stdout: PromptContext["stdout"]): void {
  stdout.write("Select an install target:\n");
  stdout.write("  [1] .opencode\n");
  stdout.write("  [2] .claude\n\n");
}

export async function promptForTarget({ stdin, stdout }: PromptContext): Promise<TargetDirectory | null> {
  renderBrandHeader(stdout);

  if (isInteractiveContext({ stdin, stdout })) {
    try {
      return await select(
        {
          message: formatHeading(stdout, "Select an install target"),
          choices: [
            {
              name: `.opencode\n${formatMuted(stdout, "Install skills for an OpenCode project")}`,
              value: TARGET_OPTIONS[0]
            },
            {
              name: `.claude\n${formatMuted(stdout, "Install skills for a Claude project")}`,
              value: TARGET_OPTIONS[1]
            }
          ],
          pageSize: 6
        },
        {
          input: stdin as NodeJS.ReadableStream,
          output: stdout as NodeJS.WritableStream,
          clearPromptOnDone: false
        }
      );
    } catch (error) {
      if (!isPromptCancelError(error)) {
        throw error;
      }

      return null;
    }
  }

  const rl = createPromptInterface({ stdin, stdout });

  try {
    renderTargetOptions(stdout);

    while (true) {
      const answer = await questionOrCancel(rl, "Choose a target or press Enter to cancel: ");

      if (answer === null) {
        return null;
      }

      if (answer.trim().length === 0) {
        return null;
      }

      const normalized = answer.trim();
      const target = optionMap.get(normalized);

      if (target) {
        return target;
      }

      stdout.write("Choose 1 for .opencode or 2 for .claude, or press Enter to cancel.\n");
    }
  } finally {
    rl.close();
  }
}
