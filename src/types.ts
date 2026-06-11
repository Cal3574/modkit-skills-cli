export type TargetDirectory = ".opencode" | ".claude";

export interface SkillEntry {
  name: string;
  title: string;
  description: string;
  path: string;
  files?: string[];
}

export interface SkillFile {
  relativePath: string;
  content: string;
}

export interface Writer {
  write(chunk: string): void;
}

export interface PromptContext {
  stdin: NodeJS.ReadableStream;
  stdout: Writer;
}

export type PromptForTarget = (context: PromptContext) => Promise<TargetDirectory | null>;

export interface SkillsPromptContext extends PromptContext {
  skills: SkillEntry[];
  installedSkillNames: ReadonlySet<string>;
}

export type PromptForSkills = (context: SkillsPromptContext) => Promise<SkillEntry[] | null>;

export type PromptForSkill = (context: SkillsPromptContext) => Promise<SkillEntry | null>;

export interface OverwritePromptContext extends PromptContext {
  skill: SkillEntry;
  installPath: string;
}

export type PromptForOverwrite = (context: OverwritePromptContext) => Promise<"overwrite" | "skip" | null>;

export interface CliOptions {
  argv: string[];
  cwd: string;
  stdin: NodeJS.ReadableStream;
  stdout: Writer;
  stderr: Writer;
  env: NodeJS.ProcessEnv;
  fetchImpl: typeof fetch;
  promptForTarget?: PromptForTarget;
  promptForSkills?: PromptForSkills;
  promptForSkill?: PromptForSkill;
  promptForOverwrite?: PromptForOverwrite;
}
