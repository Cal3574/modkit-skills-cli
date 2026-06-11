import { DEFAULT_REGISTRY_BASE_URL } from "./constants.js";
import type { SkillEntry, SkillFile } from "./types.js";

const skillNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isSafeRelativeFilePath(filePath: string): boolean {
  if (filePath.length === 0 || filePath.startsWith("/") || filePath.includes("\\")) {
    return false;
  }

  return filePath.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function buildRegistryUrl(baseUrl: string, relativePath: string): string {
  return new URL(relativePath, `${baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`}`).toString();
}

async function fetchText(url: string, fetchImpl: typeof fetch, resourceName: string): Promise<string> {
  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${resourceName}: GET ${url} returned ${response.status}`);
  }

  return response.text();
}

export function getRegistryBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.MODKIT_REGISTRY_BASE_URL || DEFAULT_REGISTRY_BASE_URL;
}

export function validateSkillEntry(skill: unknown, index: number): SkillEntry {
  if (!skill || typeof skill !== "object") {
    throw new Error(`Invalid registry manifest entry at index ${index}: expected an object`);
  }

  const { name, title, description, path, files } = skill as Record<string, unknown>;

  if (typeof name !== "string" || !skillNamePattern.test(name)) {
    throw new Error(`Invalid registry skill name at index ${index}: ${JSON.stringify(name)}`);
  }

  if (typeof title !== "string" || title.length === 0) {
    throw new Error(`Invalid registry title for skill ${name}`);
  }

  if (typeof description !== "string" || description.length === 0) {
    throw new Error(`Invalid registry description for skill ${name}`);
  }

  if (typeof path !== "string" || path.length === 0) {
    throw new Error(`Invalid registry path for skill ${name}`);
  }

  if (files !== undefined) {
    if (!Array.isArray(files) || files.length === 0 || !files.every((file) => typeof file === "string" && isSafeRelativeFilePath(file))) {
      throw new Error(`Invalid registry files for skill ${name}: expected a non-empty array of relative file paths`);
    }

    return { name, title, description, path, files: files as string[] };
  }

  return { name, title, description, path };
}

export function getSkillFilePaths(skill: SkillEntry): string[] {
  if (skill.files && skill.files.length > 0) {
    return skill.files;
  }

  const fallback = skill.path.split("/").pop();
  return [fallback && fallback.length > 0 ? fallback : "SKILL.md"];
}

export async function fetchRegistry(fetchImpl: typeof fetch, env: NodeJS.ProcessEnv = process.env): Promise<SkillEntry[]> {
  const baseUrl = getRegistryBaseUrl(env);
  const manifestUrl = buildRegistryUrl(baseUrl, "skills.json");
  const manifestText = await fetchText(manifestUrl, fetchImpl, "registry manifest");

  let manifest: unknown;

  try {
    manifest = JSON.parse(manifestText) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse registry manifest ${manifestUrl}: ${message}`);
  }

  if (!Array.isArray(manifest)) {
    throw new Error(`Invalid registry manifest ${manifestUrl}: expected a JSON array`);
  }

  return manifest.map((skill, index) => validateSkillEntry(skill, index));
}

export async function fetchSkillFiles(skill: SkillEntry, fetchImpl: typeof fetch, env: NodeJS.ProcessEnv = process.env): Promise<SkillFile[]> {
  const baseUrl = getRegistryBaseUrl(env);
  const skillDirectory = skill.path.split("/").slice(0, -1).join("/");

  return Promise.all(
    getSkillFilePaths(skill).map(async (relativePath) => {
      const fileUrl = buildRegistryUrl(baseUrl, skillDirectory ? `${skillDirectory}/${relativePath}` : relativePath);
      const content = await fetchText(fileUrl, fetchImpl, `skill ${skill.name}`);
      return { relativePath, content };
    })
  );
}
