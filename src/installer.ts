import path from "node:path";
import { access, mkdir, writeFile } from "node:fs/promises";

import type { SkillEntry, SkillFile, TargetDirectory } from "./types.js";

export function getSkillInstallDir(projectRoot: string, target: TargetDirectory, skillName: string): string {
  return path.join(projectRoot, target, "skills", skillName);
}

export function getSkillInstallPath(projectRoot: string, target: TargetDirectory, skillName: string): string {
  return path.join(getSkillInstallDir(projectRoot, target, skillName), "SKILL.md");
}

export async function isSkillInstalled(projectRoot: string, target: TargetDirectory, skillName: string): Promise<boolean> {
  try {
    await access(getSkillInstallPath(projectRoot, target, skillName));
    return true;
  } catch {
    return false;
  }
}

export async function getInstalledSkillNames(
  projectRoot: string,
  target: TargetDirectory,
  skills: SkillEntry[]
): Promise<Set<string>> {
  const installedSkillNames = new Set<string>();

  for (const skill of skills) {
    if (await isSkillInstalled(projectRoot, target, skill.name)) {
      installedSkillNames.add(skill.name);
    }
  }

  return installedSkillNames;
}

export async function installSkill({
  projectRoot,
  target,
  skill,
  files
}: {
  projectRoot: string;
  target: TargetDirectory;
  skill: SkillEntry;
  files: SkillFile[];
}): Promise<string> {
  const installDir = getSkillInstallDir(projectRoot, target, skill.name);

  for (const file of files) {
    const installPath = path.join(installDir, file.relativePath);

    if (path.relative(installDir, installPath).startsWith("..")) {
      throw new Error(`Refusing to write skill file outside the skill directory: ${file.relativePath}`);
    }

    await mkdir(path.dirname(installPath), { recursive: true });
    await writeFile(installPath, file.content, "utf8");
  }

  return installDir;
}
