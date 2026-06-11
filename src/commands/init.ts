import path from "node:path";

import { getInstalledSkillNames, getSkillInstallPath, installSkill, isSkillInstalled } from "../installer.js";
import { fetchRegistry, fetchSkillFiles } from "../registry.js";
import type { PromptForOverwrite, PromptForSkills, PromptForTarget, Writer } from "../types.js";
import { createSpinner, formatFailure, formatHeading, formatSuccess, formatWarning } from "../ui.js";

function reportNoChanges(stdout: Writer): number {
  stdout.write(`${formatWarning(stdout, "No changes made.")}\n`);
  return 0;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runInitCommand({
  cwd,
  env,
  fetchImpl,
  stdin,
  stdout,
  promptForTarget,
  promptForSkills,
  promptForOverwrite
}: {
  cwd: string;
  env: NodeJS.ProcessEnv;
  fetchImpl: typeof fetch;
  stdin: NodeJS.ReadableStream;
  stdout: Writer;
  promptForTarget: PromptForTarget;
  promptForSkills: PromptForSkills;
  promptForOverwrite: PromptForOverwrite;
}): Promise<number> {
  const target = await promptForTarget({ stdin, stdout });

  if (!target) {
    return reportNoChanges(stdout);
  }

  const registrySpinner = createSpinner(stdout, "Fetching skill registry");
  let skills;

  try {
    skills = await fetchRegistry(fetchImpl, env);
    registrySpinner?.succeed("Fetched skill registry");
  } catch (error) {
    registrySpinner?.fail("Failed to fetch skill registry");
    throw error;
  }

  const installedSkillNames = await getInstalledSkillNames(cwd, target, skills);
  const selectedSkills = await promptForSkills({ stdin, stdout, skills, installedSkillNames });

  if (selectedSkills === null || selectedSkills.length === 0) {
    return reportNoChanges(stdout);
  }

  const overwriteResolutions = new Map<string, "overwrite" | "skip">();

  for (const skill of selectedSkills) {
    if (!installedSkillNames.has(skill.name)) {
      continue;
    }

    const installPath = getSkillInstallPath(cwd, target, skill.name);
    const relativePath = path.relative(cwd, installPath) || installPath;
    const resolution = await promptForOverwrite({ stdin, stdout, skill, installPath: relativePath });

    if (!resolution) {
      return reportNoChanges(stdout);
    }

    overwriteResolutions.set(skill.name, resolution);
  }

  const installed: Array<{ name: string; relativePath: string }> = [];
  const overwritten: Array<{ name: string; relativePath: string }> = [];
  const skipped: Array<{ name: string; relativePath: string }> = [];
  const failed: Array<{ name: string; relativePath: string; message: string }> = [];

  for (const skill of selectedSkills) {
    const installPath = getSkillInstallPath(cwd, target, skill.name);
    const relativePath = path.relative(cwd, installPath) || installPath;

    if (installedSkillNames.has(skill.name)) {
      const resolution = overwriteResolutions.get(skill.name);

      if (resolution === "skip") {
        skipped.push({
          name: skill.name,
          relativePath
        });
        continue;
      }
    }

    const installSpinner = createSpinner(stdout, `${installedSkillNames.has(skill.name) ? "Refreshing" : "Installing"} ${skill.name}`);

    try {
      const files = await fetchSkillFiles(skill, fetchImpl, env);
      await installSkill({
        projectRoot: cwd,
        target,
        skill,
        files
      });
      installSpinner?.succeed(`${installedSkillNames.has(skill.name) ? "Refreshed" : "Installed"} ${skill.name}`);

      const bucket = installedSkillNames.has(skill.name) ? overwritten : installed;
      bucket.push({ name: skill.name, relativePath });
    } catch (error) {
      installSpinner?.fail(`Failed to install ${skill.name}`);
      failed.push({
        name: skill.name,
        relativePath,
        message: getErrorMessage(error)
      });
    }
  }

  stdout.write(`${formatHeading(stdout, `Completed skill install into ${target}`)}\n`);

  if (installed.length > 0) {
    stdout.write(`\n${formatSuccess(stdout, "Installed:")}\n`);
    for (const item of installed) {
      stdout.write(`- ${item.name} -> ${item.relativePath}\n`);
    }
  }

  if (overwritten.length > 0) {
    stdout.write(`\n${formatSuccess(stdout, "Overwritten:")}\n`);
    for (const item of overwritten) {
      stdout.write(`- ${item.name} -> ${item.relativePath}\n`);
    }
  }

  if (skipped.length > 0) {
    stdout.write(`\n${formatWarning(stdout, "Skipped:")}\n`);
    for (const item of skipped) {
      stdout.write(`- ${item.name} -> ${item.relativePath}\n`);
    }
  }

  if (failed.length > 0) {
    stdout.write(`\n${formatFailure(stdout, "Failed:")}\n`);
    for (const item of failed) {
      stdout.write(`- ${item.name} -> ${item.relativePath}\n`);
      stdout.write(`  ${item.message}\n`);
    }
  }

  return failed.length > 0 ? 1 : 0;
}
