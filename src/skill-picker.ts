import { checkbox, select } from "@inquirer/prompts";
import type { PromptForSkill, PromptForSkills, SkillEntry } from "./types.js";

import { createPromptInterface, isPromptCancelError, questionOrCancel } from "./prompt-utils.js";
import { formatHeading, formatMuted, formatSkillChoice, isInteractiveContext } from "./ui.js";

function renderSkills(stdout: { write(chunk: string): void }, skills: SkillEntry[], installedSkillNames: ReadonlySet<string>): void {
  stdout.write("Available skills:\n\n");

  for (const [index, skill] of skills.entries()) {
    const installedLabel = installedSkillNames.has(skill.name) ? " [installed]" : "";
    stdout.write(`[${index + 1}] ${skill.title}${installedLabel}\n`);
    stdout.write(`    ${skill.name}\n`);
    stdout.write(`    ${skill.description}\n\n`);
  }
}

function parseSelection(answer: string, skills: SkillEntry[]): SkillEntry[] | null {
  const rawSelections = answer
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (rawSelections.length === 0) {
    return [];
  }

  const indexes = rawSelections.map((value) => Number.parseInt(value, 10));

  if (indexes.some((value) => Number.isNaN(value))) {
    return null;
  }

  const selectedSkills: SkillEntry[] = [];
  const seenIndexes = new Set<number>();

  for (const index of indexes) {
    const skill = skills[index - 1];

    if (!skill) {
      return null;
    }

    if (seenIndexes.has(index)) {
      continue;
    }

    seenIndexes.add(index);
    selectedSkills.push(skill);
  }

  return selectedSkills;
}

function parseSingleSelection(answer: string, skills: SkillEntry[]): SkillEntry | null {
  const index = Number.parseInt(answer.trim(), 10);

  if (Number.isNaN(index)) {
    return null;
  }

  return skills[index - 1] ?? null;
}

export const promptForSkill: PromptForSkill = async ({ stdin, stdout, skills, installedSkillNames }) => {
  if (isInteractiveContext({ stdin, stdout })) {
    try {
      const selectedName = await select(
        {
          message: formatHeading(stdout, "Choose a skill to install"),
          choices: skills.map((skill) => ({
            name: formatSkillChoice(stdout, skill, installedSkillNames.has(skill.name)),
            value: skill.name
          })),
          pageSize: 10
        },
        {
          input: stdin as NodeJS.ReadableStream,
          output: stdout as NodeJS.WritableStream,
          clearPromptOnDone: false
        }
      );

      return skills.find((skill) => skill.name === selectedName) ?? null;
    } catch (error) {
      if (!isPromptCancelError(error)) {
        throw error;
      }

      return null;
    }
  }

  const rl = createPromptInterface({ stdin, stdout });

  try {
    renderSkills(stdout, skills, installedSkillNames);
    stdout.write("Pick one skill to install. Press Enter to cancel.\n\n");

    while (true) {
      const answer = await questionOrCancel(rl, "Select a skill by number: ");

      if (answer === null || answer.trim().length === 0) {
        return null;
      }

      const selectedSkill = parseSingleSelection(answer, skills);

      if (selectedSkill) {
        return selectedSkill;
      }

      stdout.write("Choose one valid skill number, or press Enter to cancel.\n");
    }
  } finally {
    rl.close();
  }
};

export const promptForSkills: PromptForSkills = async ({ stdin, stdout, skills, installedSkillNames }) => {
  if (isInteractiveContext({ stdin, stdout })) {
    try {
      const selectedNames = await checkbox(
        {
          message: `${formatHeading(stdout, "Select skills to install")}\n${formatMuted(stdout, "Use arrows to move, space to select, enter to confirm")}`,
          choices: skills.map((skill) => ({
            name: formatSkillChoice(stdout, skill, installedSkillNames.has(skill.name)),
            value: skill.name
          })),
          pageSize: 12,
          required: false
        },
        {
          input: stdin as NodeJS.ReadableStream,
          output: stdout as NodeJS.WritableStream,
          clearPromptOnDone: false
        }
      );

      return selectedNames.map((name) => skills.find((skill) => skill.name === name)).filter((skill): skill is SkillEntry => Boolean(skill));
    } catch (error) {
      if (!isPromptCancelError(error)) {
        throw error;
      }

      return null;
    }
  }

  const rl = createPromptInterface({ stdin, stdout });

  try {
    renderSkills(stdout, skills, installedSkillNames);
    stdout.write("Select one or more skills. Press Enter with no selection to make no changes.\n\n");

    while (true) {
      const answer = await questionOrCancel(rl, "Select skills by number, comma-separated: ");

      if (answer === null) {
        return null;
      }

      const selectedSkills = parseSelection(answer, skills);

      if (selectedSkills) {
        return selectedSkills;
      }

      stdout.write("Choose valid skill numbers separated by commas, or press Enter to make no changes.\n");
    }
  } finally {
    rl.close();
  }
};
