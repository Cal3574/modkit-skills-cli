# ModKit Issue Drafts

Label for each issue: `needs-triage`

## 1. Direct skill install happy path

## What to build

Implement the first end-to-end ModKit install flow: a developer can run `modkit add <skill-name>`, choose `.opencode` or `.claude`, fetch the public skill registry and the requested skill from GitHub, create the expected local directory structure, and install the selected `SKILL.md` into the project.

## Acceptance criteria

- Running `modkit add <skill-name>` prompts for the target directory and installs the named skill from the built-in public registry.
- The CLI creates the target directory and nested `skills/<skill-name>/SKILL.md` structure when needed.
- The installed skill is copied verbatim from the registry and remains editable as a normal local Markdown file.
- The command prints a concise success summary including the target and written path.

## Blocked by

None - can start immediately.

## 2. Interactive project initialization

## What to build

Implement `modkit init` as a first-time setup flow that prompts for `.opencode` or `.claude`, displays the registry as an interactive multi-select list using skill title and description, and installs the selected skills into the chosen project target.

## Acceptance criteria

- Running `modkit init` asks for the target directory before showing available skills.
- The interactive picker supports selecting multiple registry skills and shows each skill's title and description.
- Selected skills are installed end-to-end into the chosen target using the expected `skills/<skill-name>/SKILL.md` structure.
- Successful completion prints a concise summary of the installed skills and their written locations.

## Blocked by

Direct skill install happy path.

## 3. Interactive add fallback

## What to build

Extend `modkit add` so that when no valid skill slug is provided, the command falls back to an interactive single-select registry picker and still completes a full end-to-end install into the chosen target directory.

## Acceptance criteria

- Running `modkit add` without a skill slug opens an interactive single-select picker.
- Running `modkit add <invalid-skill>` does not fail immediately and instead lets the user select a valid skill interactively.
- The fallback picker uses registry display metadata so the user can identify the correct skill.
- Completing the fallback flow installs the chosen skill exactly as the direct add flow does.

## Blocked by

Direct skill install happy path.

## 4. Smoke-tested core install path

## What to build

Add one automated smoke path for the core ModKit install experience so the project has a minimal regression check proving that the CLI can fetch registry data and write a skill into a project correctly.

## Acceptance criteria

- A single automated smoke test covers the core install path against mocked registry responses.
- The smoke path verifies the observable outcome: registry fetch, target resolution, directory creation, and written `SKILL.md` content.
- The test avoids coupling to internal implementation details and can run without a live GitHub dependency.

## Blocked by

Direct skill install happy path.

## 5. Conflict-aware reinstall flow

## What to build

Add installed-state awareness and safe reinstall behavior across interactive ModKit flows so developers can see which skills already exist locally, intentionally refresh them, and avoid silent replacement of local edits.

## Acceptance criteria

- Interactive skill lists mark skills that are already installed in the chosen target directory.
- Installed skills remain selectable so users can intentionally reinstall them.
- When a selected skill already exists locally, the CLI prompts the user to overwrite or skip instead of replacing it silently.
- The final outcome clearly reports which selected skills were overwritten and which were skipped.

## Blocked by

Interactive project initialization.
Interactive add fallback.

## 6. Safe cancellation and no-op behavior

## What to build

Make the interactive ModKit flows safe to abandon by ensuring cancellation and empty selections leave the project untouched and return a successful exit status instead of behaving like failures.

## Acceptance criteria

- Canceling `modkit init` or `modkit add` during interactive prompts does not create directories or files.
- Confirming no skill selection in an interactive flow behaves as a no-op.
- Cancellation and no-op flows exit with status `0`.
- The CLI output makes it clear that no changes were made.

## Blocked by

Interactive project initialization.
Interactive add fallback.

## 7. Partial failure and actionable error reporting

## What to build

Improve the multi-skill install experience so ModKit preserves successful installs when later work fails, reports exactly which registry request or skill caused the failure, and returns a non-zero exit status for real errors.

## Acceptance criteria

- In a multi-skill install, successful skills remain installed even if another skill download or read fails.
- Failure output identifies the manifest, registry request, or skill that failed in actionable terms.
- Real failures return a non-zero exit status.
- Success, skip, and failure outcomes are summarized clearly when a run completes with mixed results.

## Blocked by

Interactive project initialization.
Conflict-aware reinstall flow.
