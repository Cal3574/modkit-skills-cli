import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";

import { runCli } from "../src/cli.js";
import type { SkillEntry, Writer } from "../src/types.js";

interface MockSkill extends SkillEntry {
  content: string;
  fileContents?: Record<string, string>;
}

function createMockFetch(baseUrl: string, skills: MockSkill[]): typeof fetch {
  const responses = new Map<string, string>([
    [`${baseUrl}/skills.json`, JSON.stringify(skills.map(({ content, fileContents, ...skill }) => skill))]
  ]);

  for (const skill of skills) {
    responses.set(`${baseUrl}/${skill.path}`, skill.content);

    const skillDirectory = skill.path.split("/").slice(0, -1).join("/");

    for (const [relativePath, fileContent] of Object.entries(skill.fileContents ?? {})) {
      responses.set(`${baseUrl}/${skillDirectory}/${relativePath}`, fileContent);
    }
  }

  return (async (url: string | URL | Request) => {
    const resolvedUrl = String(url);

    if (!responses.has(resolvedUrl)) {
      return new Response("not found", {
        status: 404
      });
    }

    return new Response(responses.get(resolvedUrl), {
      status: 200
    });
  }) as typeof fetch;
}

function createWriter(chunks: string[]): Writer {
  return {
    write(chunk: string): void {
      chunks.push(String(chunk));
    }
  };
}

async function seedFile(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

test("modkit add installs a registry skill into the selected target", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "modkit-smoke-"));
  const baseUrl = "https://example.com/registry";
  const stdout: string[] = [];
  const stderr: string[] = [];
  const skillContent = "# Example Skill\n\nThis is installed verbatim.\n";
  const exitCode = await runCli({
    argv: ["add", "example-skill"],
    cwd,
    stdin: process.stdin,
    stdout: createWriter(stdout),
    stderr: createWriter(stderr),
    env: {
      MODKIT_REGISTRY_BASE_URL: baseUrl
    },
    promptForTarget: async () => ".opencode",
    fetchImpl: createMockFetch(baseUrl, [
      {
        name: "example-skill",
        title: "Example Skill",
        description: "Tests the direct add flow.",
        path: "skills/example-skill/SKILL.md",
        content: skillContent
      }
    ])
  });

  const writtenPath = path.join(cwd, ".opencode", "skills", "example-skill", "SKILL.md");

  assert.equal(exitCode, 0);
  assert.deepEqual(stderr, []);
  assert.match(stdout.join(""), /Installed example-skill into \.opencode/);
  assert.match(stdout.join(""), /\.opencode\/skills\/example-skill\/SKILL\.md/);
  assert.equal(await readFile(writtenPath, "utf8"), skillContent);
});

test("modkit add installs every file listed in the skill's files array", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "modkit-multifile-"));
  const baseUrl = "https://example.com/registry";
  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitCode = await runCli({
    argv: ["add", "tdd"],
    cwd,
    stdin: process.stdin,
    stdout: createWriter(stdout),
    stderr: createWriter(stderr),
    env: {
      MODKIT_REGISTRY_BASE_URL: baseUrl
    },
    promptForTarget: async () => ".claude",
    fetchImpl: createMockFetch(baseUrl, [
      {
        name: "tdd",
        title: "TDD",
        description: "Test-driven development.",
        path: "skills/tdd/SKILL.md",
        files: ["SKILL.md", "mocking.md", "references/tests.md"],
        content: "# TDD\n",
        fileContents: {
          "mocking.md": "# Mocking\n",
          "references/tests.md": "# Tests\n"
        }
      }
    ])
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(stderr, []);
  assert.match(stdout.join(""), /Installed tdd into \.claude/);
  assert.equal(await readFile(path.join(cwd, ".claude", "skills", "tdd", "SKILL.md"), "utf8"), "# TDD\n");
  assert.equal(await readFile(path.join(cwd, ".claude", "skills", "tdd", "mocking.md"), "utf8"), "# Mocking\n");
  assert.equal(await readFile(path.join(cwd, ".claude", "skills", "tdd", "references", "tests.md"), "utf8"), "# Tests\n");
});

test("modkit add without a slug falls back to a single-select skill picker", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "modkit-add-picker-"));
  const baseUrl = "https://example.com/registry";
  const stdout: string[] = [];
  const stderr: string[] = [];
  const skills: MockSkill[] = [
    {
      name: "grill-me",
      title: "Grill Me",
      description: "Stress-test a plan.",
      path: "skills/grill-me/SKILL.md",
      content: "# Grill Me\n"
    },
    {
      name: "to-prd",
      title: "To PRD",
      description: "Turn context into a PRD.",
      path: "skills/to-prd/SKILL.md",
      content: "# To PRD\n"
    }
  ];
  await seedFile(path.join(cwd, ".opencode", "skills", "to-prd", "SKILL.md"), "# Existing To PRD\n");
  let promptCalls = 0;
  const exitCode = await runCli({
    argv: ["add"],
    cwd,
    stdin: process.stdin,
    stdout: createWriter(stdout),
    stderr: createWriter(stderr),
    env: {
      MODKIT_REGISTRY_BASE_URL: baseUrl
    },
    promptForTarget: async () => ".opencode",
    promptForSkill: async ({ skills: promptSkills, installedSkillNames }) => {
      promptCalls += 1;
      assert.deepEqual(
        promptSkills.map((skill) => ({ name: skill.name, title: skill.title, description: skill.description })),
        skills.map(({ name, title, description }) => ({ name, title, description }))
      );
      assert.deepEqual([...installedSkillNames], ["to-prd"]);
      return promptSkills[1];
    },
    promptForOverwrite: async () => "overwrite",
    fetchImpl: createMockFetch(baseUrl, skills)
  });

  assert.equal(exitCode, 0);
  assert.equal(promptCalls, 1);
  assert.deepEqual(stderr, []);
  assert.match(stdout.join(""), /Overwrote to-prd into \.opencode/);
  assert.equal(
    await readFile(path.join(cwd, ".opencode", "skills", "to-prd", "SKILL.md"), "utf8"),
    "# To PRD\n"
  );
});

test("modkit add with an invalid slug falls back to a single-select skill picker", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "modkit-add-invalid-"));
  const baseUrl = "https://example.com/registry";
  const stdout: string[] = [];
  const stderr: string[] = [];
  const skills: MockSkill[] = [
    {
      name: "grill-me",
      title: "Grill Me",
      description: "Stress-test a plan.",
      path: "skills/grill-me/SKILL.md",
      content: "# Grill Me\n"
    }
  ];
  const exitCode = await runCli({
    argv: ["add", "not-a-real-skill"],
    cwd,
    stdin: process.stdin,
    stdout: createWriter(stdout),
    stderr: createWriter(stderr),
    env: {
      MODKIT_REGISTRY_BASE_URL: baseUrl
    },
    promptForTarget: async () => ".claude",
    promptForSkill: async ({ skills: promptSkills }) => promptSkills[0],
    promptForOverwrite: async () => "overwrite",
    fetchImpl: createMockFetch(baseUrl, skills)
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(stderr, []);
  assert.match(stdout.join(""), /Skill "not-a-real-skill" was not found in the public registry\./);
  assert.match(stdout.join(""), /Installed grill-me into \.claude/);
  assert.equal(
    await readFile(path.join(cwd, ".claude", "skills", "grill-me", "SKILL.md"), "utf8"),
    "# Grill Me\n"
  );
});

test("modkit add prompts before overwriting an existing installed skill", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "modkit-add-skip-"));
  const baseUrl = "https://example.com/registry";
  const stdout: string[] = [];
  const stderr: string[] = [];
  const existingPath = path.join(cwd, ".opencode", "skills", "example-skill", "SKILL.md");
  await seedFile(existingPath, "# Existing Skill\n");
  const exitCode = await runCli({
    argv: ["add", "example-skill"],
    cwd,
    stdin: process.stdin,
    stdout: createWriter(stdout),
    stderr: createWriter(stderr),
    env: {
      MODKIT_REGISTRY_BASE_URL: baseUrl
    },
    promptForTarget: async () => ".opencode",
    promptForOverwrite: async ({ installPath }) => {
      assert.equal(installPath, ".opencode/skills/example-skill/SKILL.md");
      return "skip";
    },
    fetchImpl: createMockFetch(baseUrl, [
      {
        name: "example-skill",
        title: "Example Skill",
        description: "Tests the direct add flow.",
        path: "skills/example-skill/SKILL.md",
        content: "# New Skill\n"
      }
    ])
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(stderr, []);
  assert.match(stdout.join(""), /No changes made\. Skipped example-skill at \.opencode\/skills\/example-skill\/SKILL\.md/);
  assert.equal(await readFile(existingPath, "utf8"), "# Existing Skill\n");
});

test("modkit add returns success with no changes when the target prompt is canceled", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "modkit-add-cancel-target-"));
  const stdout: string[] = [];
  const stderr: string[] = [];
  let fetchCalls = 0;
  const exitCode = await runCli({
    argv: ["add", "example-skill"],
    cwd,
    stdin: process.stdin,
    stdout: createWriter(stdout),
    stderr: createWriter(stderr),
    env: {},
    promptForTarget: async () => null,
    fetchImpl: (async () => {
      fetchCalls += 1;
      return new Response("[]", { status: 200 });
    }) as typeof fetch
  });

  assert.equal(exitCode, 0);
  assert.equal(fetchCalls, 0);
  assert.deepEqual(stderr, []);
  assert.equal(stdout.join(""), "No changes made.\n");
});

test("modkit init installs multiple registry skills into the selected target", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "modkit-init-"));
  const baseUrl = "https://example.com/registry";
  const stdout: string[] = [];
  const stderr: string[] = [];
  const grillMeContent = "# Grill Me\n\nAsk hard questions.\n";
  const toPrdContent = "# To PRD\n\nWrite a PRD.\n";
  const skills: MockSkill[] = [
    {
      name: "grill-me",
      title: "Grill Me",
      description: "Stress-test a plan.",
      path: "skills/grill-me/SKILL.md",
      content: grillMeContent
    },
    {
      name: "to-prd",
      title: "To PRD",
      description: "Turn context into a PRD.",
      path: "skills/to-prd/SKILL.md",
      content: toPrdContent
    }
  ];
  await seedFile(path.join(cwd, ".claude", "skills", "to-prd", "SKILL.md"), "# Existing To PRD\n");
  const exitCode = await runCli({
    argv: ["init"],
    cwd,
    stdin: process.stdin,
    stdout: createWriter(stdout),
    stderr: createWriter(stderr),
    env: {
      MODKIT_REGISTRY_BASE_URL: baseUrl
    },
    promptForTarget: async () => ".claude",
    promptForSkills: async ({ installedSkillNames }) => {
      assert.deepEqual([...installedSkillNames], ["to-prd"]);
      return skills;
    },
    promptForOverwrite: async ({ skill }) => skill.name === "to-prd" ? "overwrite" : "overwrite",
    fetchImpl: createMockFetch(baseUrl, skills)
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(stderr, []);
  assert.match(stdout.join(""), /Completed skill install into \.claude/);
  assert.match(stdout.join(""), /Installed:/);
  assert.match(stdout.join(""), /grill-me -> \.claude\/skills\/grill-me\/SKILL\.md/);
  assert.match(stdout.join(""), /Overwritten:/);
  assert.match(stdout.join(""), /to-prd -> \.claude\/skills\/to-prd\/SKILL\.md/);
  assert.equal(
    await readFile(path.join(cwd, ".claude", "skills", "grill-me", "SKILL.md"), "utf8"),
    grillMeContent
  );
  assert.equal(
    await readFile(path.join(cwd, ".claude", "skills", "to-prd", "SKILL.md"), "utf8"),
    toPrdContent
  );
});

test("modkit init reports skipped and overwritten outcomes for installed skills", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "modkit-init-conflicts-"));
  const baseUrl = "https://example.com/registry";
  const stdout: string[] = [];
  const stderr: string[] = [];
  const skills: MockSkill[] = [
    {
      name: "grill-me",
      title: "Grill Me",
      description: "Stress-test a plan.",
      path: "skills/grill-me/SKILL.md",
      content: "# New Grill Me\n"
    },
    {
      name: "to-prd",
      title: "To PRD",
      description: "Turn context into a PRD.",
      path: "skills/to-prd/SKILL.md",
      content: "# New To PRD\n"
    }
  ];
  const grillMePath = path.join(cwd, ".claude", "skills", "grill-me", "SKILL.md");
  const toPrdPath = path.join(cwd, ".claude", "skills", "to-prd", "SKILL.md");
  await seedFile(grillMePath, "# Existing Grill Me\n");
  await seedFile(toPrdPath, "# Existing To PRD\n");
  const exitCode = await runCli({
    argv: ["init"],
    cwd,
    stdin: process.stdin,
    stdout: createWriter(stdout),
    stderr: createWriter(stderr),
    env: {
      MODKIT_REGISTRY_BASE_URL: baseUrl
    },
    promptForTarget: async () => ".claude",
    promptForSkills: async ({ skills: promptSkills, installedSkillNames }) => {
      assert.deepEqual(new Set(installedSkillNames), new Set(["grill-me", "to-prd"]));
      return promptSkills;
    },
    promptForOverwrite: async ({ skill }) => skill.name === "grill-me" ? "overwrite" : "skip",
    fetchImpl: createMockFetch(baseUrl, skills)
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(stderr, []);
  assert.match(stdout.join(""), /Overwritten:/);
  assert.match(stdout.join(""), /grill-me -> \.claude\/skills\/grill-me\/SKILL\.md/);
  assert.match(stdout.join(""), /Skipped:/);
  assert.match(stdout.join(""), /to-prd -> \.claude\/skills\/to-prd\/SKILL\.md/);
  assert.equal(await readFile(grillMePath, "utf8"), "# New Grill Me\n");
  assert.equal(await readFile(toPrdPath, "utf8"), "# Existing To PRD\n");
});

test("modkit init returns success with no changes when no skills are selected", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "modkit-init-empty-"));
  const baseUrl = "https://example.com/registry";
  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitCode = await runCli({
    argv: ["init"],
    cwd,
    stdin: process.stdin,
    stdout: createWriter(stdout),
    stderr: createWriter(stderr),
    env: {
      MODKIT_REGISTRY_BASE_URL: baseUrl
    },
    promptForTarget: async () => ".opencode",
    promptForSkills: async () => [],
    fetchImpl: createMockFetch(baseUrl, [
      {
        name: "grill-me",
        title: "Grill Me",
        description: "Stress-test a plan.",
        path: "skills/grill-me/SKILL.md",
        content: "# Grill Me\n"
      }
    ])
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(stderr, []);
  assert.equal(stdout.join(""), "No changes made.\n");
});

test("modkit init returns success with no changes when overwrite prompting is canceled before any writes", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "modkit-init-cancel-overwrite-"));
  const baseUrl = "https://example.com/registry";
  const stdout: string[] = [];
  const stderr: string[] = [];
  const skills: MockSkill[] = [
    {
      name: "grill-me",
      title: "Grill Me",
      description: "Stress-test a plan.",
      path: "skills/grill-me/SKILL.md",
      content: "# New Grill Me\n"
    },
    {
      name: "to-prd",
      title: "To PRD",
      description: "Turn context into a PRD.",
      path: "skills/to-prd/SKILL.md",
      content: "# New To PRD\n"
    }
  ];
  const existingPath = path.join(cwd, ".claude", "skills", "to-prd", "SKILL.md");
  const newPath = path.join(cwd, ".claude", "skills", "grill-me", "SKILL.md");
  await seedFile(existingPath, "# Existing To PRD\n");
  const exitCode = await runCli({
    argv: ["init"],
    cwd,
    stdin: process.stdin,
    stdout: createWriter(stdout),
    stderr: createWriter(stderr),
    env: {
      MODKIT_REGISTRY_BASE_URL: baseUrl
    },
    promptForTarget: async () => ".claude",
    promptForSkills: async ({ skills: promptSkills }) => promptSkills,
    promptForOverwrite: async () => null,
    fetchImpl: createMockFetch(baseUrl, skills)
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(stderr, []);
  assert.equal(stdout.join(""), "No changes made.\n");
  assert.equal(await readFile(existingPath, "utf8"), "# Existing To PRD\n");
  await assert.rejects(() => readFile(newPath, "utf8"));
});

test("modkit init preserves successful installs and returns non-zero when a later skill fetch fails", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "modkit-init-partial-failure-"));
  const baseUrl = "https://example.com/registry";
  const stdout: string[] = [];
  const stderr: string[] = [];
  const skills: MockSkill[] = [
    {
      name: "grill-me",
      title: "Grill Me",
      description: "Stress-test a plan.",
      path: "skills/grill-me/SKILL.md",
      content: "# Grill Me\n"
    },
    {
      name: "to-prd",
      title: "To PRD",
      description: "Turn context into a PRD.",
      path: "skills/to-prd/SKILL.md",
      content: "# To PRD\n"
    }
  ];
  const fetchImpl = createMockFetch(baseUrl, skills);
  const exitCode = await runCli({
    argv: ["init"],
    cwd,
    stdin: process.stdin,
    stdout: createWriter(stdout),
    stderr: createWriter(stderr),
    env: {
      MODKIT_REGISTRY_BASE_URL: baseUrl
    },
    promptForTarget: async () => ".opencode",
    promptForSkills: async ({ skills: promptSkills }) => promptSkills,
    fetchImpl: (async (url: string | URL | Request) => {
      const resolvedUrl = String(url);

      if (resolvedUrl.endsWith("skills/to-prd/SKILL.md")) {
        return new Response("not found", { status: 404 });
      }

      return fetchImpl(url);
    }) as typeof fetch
  });

  assert.equal(exitCode, 1);
  assert.deepEqual(stderr, []);
  assert.match(stdout.join(""), /Completed skill install into \.opencode/);
  assert.match(stdout.join(""), /Installed:/);
  assert.match(stdout.join(""), /grill-me -> \.opencode\/skills\/grill-me\/SKILL\.md/);
  assert.match(stdout.join(""), /Failed:/);
  assert.match(stdout.join(""), /to-prd -> \.opencode\/skills\/to-prd\/SKILL\.md/);
  assert.match(stdout.join(""), /Failed to fetch skill to-prd: GET https:\/\/example\.com\/registry\/skills\/to-prd\/SKILL\.md returned 404/);
  assert.equal(
    await readFile(path.join(cwd, ".opencode", "skills", "grill-me", "SKILL.md"), "utf8"),
    "# Grill Me\n"
  );
  await assert.rejects(() => readFile(path.join(cwd, ".opencode", "skills", "to-prd", "SKILL.md"), "utf8"));
});
