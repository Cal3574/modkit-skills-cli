import { select } from "@inquirer/prompts";

import { createPromptInterface, isPromptCancelError, questionOrCancel } from "./prompt-utils.js";
import { formatHeading, formatMuted, isInteractiveContext } from "./ui.js";
import type { PromptForOverwrite } from "./types.js";

export const promptForOverwrite: PromptForOverwrite = async ({ stdin, stdout, skill, installPath }) => {
  if (isInteractiveContext({ stdin, stdout })) {
    try {
      return await select(
        {
          message: `${formatHeading(stdout, `Skill already installed: ${skill.name}`)}\n${formatMuted(stdout, installPath)}`,
          choices: [
            {
              name: `Overwrite\n${formatMuted(stdout, "Replace the local SKILL.md with the registry version")}`,
              value: "overwrite"
            },
            {
              name: `Skip\n${formatMuted(stdout, "Leave the existing local SKILL.md unchanged")}`,
              value: "skip"
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
    stdout.write("Skill already installed:\n");
    stdout.write(`  ${skill.name}\n`);
    stdout.write(`  ${installPath}\n\n`);

    while (true) {
      const answer = await questionOrCancel(
        rl,
        "Choose [o]verwrite, [s]kip, or press Enter to cancel: "
      );

      if (answer === null) {
        return null;
      }

      const normalized = answer.trim().toLowerCase();

      if (normalized === "o" || normalized === "overwrite") {
        return "overwrite";
      }

      if (normalized === "s" || normalized === "skip") {
        return "skip";
      }

      stdout.write("Choose overwrite, skip, or press Enter to cancel.\n");
    }
  } finally {
    rl.close();
  }
};
