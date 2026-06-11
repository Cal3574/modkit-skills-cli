import { runAddCommand } from "./commands/add.js";
import { runInitCommand } from "./commands/init.js";
import { promptForOverwrite } from "./overwrite-prompt.js";
import { promptForSkill, promptForSkills } from "./skill-picker.js";
import { promptForTarget } from "./targets.js";
import type { CliOptions, Writer } from "./types.js";

function printUsage(stdout: Writer): void {
  stdout.write("Usage:\n");
  stdout.write("  modkit init\n");
  stdout.write("  modkit add <skill-name>\n");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runCli({
  argv,
  cwd,
  stdin,
  stdout,
  stderr,
  env,
  fetchImpl,
  promptForTarget: promptForTargetImpl = promptForTarget,
  promptForSkills: promptForSkillsImpl = promptForSkills,
  promptForSkill: promptForSkillImpl = promptForSkill,
  promptForOverwrite: promptForOverwriteImpl = promptForOverwrite
}: CliOptions): Promise<number> {
  const [command, ...rest] = argv;

  try {
    if (!command || command === "--help" || command === "-h") {
      printUsage(stdout);
      return 0;
    }

    if (command === "add") {
      return runAddCommand({
        skillName: rest[0],
        cwd,
        env,
        fetchImpl,
        stdin,
        stdout,
        promptForTarget: promptForTargetImpl,
        promptForSkill: promptForSkillImpl,
        promptForOverwrite: promptForOverwriteImpl
      });
    }

    if (command === "init") {
      return runInitCommand({
        cwd,
        env,
        fetchImpl,
        stdin,
        stdout,
        promptForTarget: promptForTargetImpl,
        promptForSkills: promptForSkillsImpl,
        promptForOverwrite: promptForOverwriteImpl
      });
    }

    throw new Error(`Unknown command ${JSON.stringify(command)}`);
  } catch (error) {
    stderr.write(`modkit: ${getErrorMessage(error)}\n`);
    return 1;
  }
}
