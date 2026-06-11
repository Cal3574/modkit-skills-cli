import path from "node:path";

import { getInstalledSkillNames, getSkillInstallPath, installSkill, isSkillInstalled } from "../installer.js";
import { fetchRegistry, fetchSkillFiles } from "../registry.js";
import type { PromptForOverwrite, PromptForSkill, PromptForTarget, SkillEntry, Writer } from "../types.js";
import { createSpinner, formatHeading, formatSuccess, formatWarning } from "../ui.js";

function reportNoChanges(stdout: Writer): number {
  stdout.write(`${formatWarning(stdout, "No changes made.")}\n`);
  return 0;
}

export async function runAddCommand({
  skillName,
  cwd,
  env,
  fetchImpl,
  stdin,
  stdout,
  promptForTarget,
  promptForSkill,
  promptForOverwrite
}: {
  skillName: string | undefined;
  cwd: string;
  env: NodeJS.ProcessEnv;
  fetchImpl: typeof fetch;
  stdin: NodeJS.ReadableStream;
  stdout: Writer;
  promptForTarget: PromptForTarget;
  promptForSkill: PromptForSkill;
  promptForOverwrite: PromptForOverwrite;
}): Promise<number> {
  const target = await promptForTarget({ stdin, stdout });

  if (!target) {
    return reportNoChanges(stdout);
  }

  const registrySpinner = createSpinner(stdout, "Fetching skill registry");
  let registry: SkillEntry[];

  try {
    registry = await fetchRegistry(fetchImpl, env);
    registrySpinner?.succeed("Fetched skill registry");
  } catch (error) {
    registrySpinner?.fail("Failed to fetch skill registry");
    throw error;
  }

  let skill: SkillEntry | null | undefined = skillName ? registry.find((entry) => entry.name === skillName) : undefined;

  if (!skill) {
    const installedSkillNames = await getInstalledSkillNames(cwd, target, registry);

    if (skillName) {
      stdout.write(`${formatWarning(stdout, `Skill ${JSON.stringify(skillName)} was not found in the public registry.`)}\n`);
      stdout.write(`${formatHeading(stdout, "Choose a skill from the registry instead.")}\n\n`);
    }

    skill = await promptForSkill({ stdin, stdout, skills: registry, installedSkillNames });

    if (!skill) {
      return reportNoChanges(stdout);
    }
  }

  if (!skill) {
    return reportNoChanges(stdout);
  }

  const installPath = getSkillInstallPath(cwd, target, skill.name);
  const relativePath = path.relative(cwd, installPath) || installPath;
  const wasInstalled = await isSkillInstalled(cwd, target, skill.name);

  if (wasInstalled) {
    const resolution = await promptForOverwrite({ stdin, stdout, skill, installPath: relativePath });

    if (!resolution) {
      return reportNoChanges(stdout);
    }

    if (resolution === "skip") {
      stdout.write(`${formatWarning(stdout, "No changes made.")} Skipped ${skill.name} at ${relativePath}\n`);
      return 0;
    }
  }

  const installSpinner = createSpinner(stdout, `${wasInstalled ? "Refreshing" : "Installing"} ${skill.name}`);

  try {
    const files = await fetchSkillFiles(skill, fetchImpl, env);
    await installSkill({
      projectRoot: cwd,
      target,
      skill,
      files
    });
    installSpinner?.succeed(`${wasInstalled ? "Refreshed" : "Installed"} ${skill.name}`);
  } catch (error) {
    installSpinner?.fail(`Failed to install ${skill.name}`);
    throw error;
  }

  stdout.write(`${formatSuccess(stdout, `${wasInstalled ? "Overwrote" : "Installed"} ${skill.name} into ${target}`)}\n`);
  stdout.write(`  ${relativePath}\n`);

  return 0;
}
