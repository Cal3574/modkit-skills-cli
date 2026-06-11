# PRD: ModKit Skill Installer CLI

## Problem Statement

Developers want a simple way to browse and install reusable AI prompt skills into a local project without manually copying Markdown files out of a GitHub repository. Today, the workflow is manual, error-prone, and inconsistent across projects. Developers must discover available skills on their own, create the expected local folder structure by hand, and copy files into the correct target directory. This creates friction for first-time setup, makes repeated installs awkward, and leads to inconsistent project conventions around skill installation.

## Solution

Build `modkit`, a small npm CLI that installs reusable skills from a central GitHub registry into a project's `.opencode` or `.claude` directory. The CLI provides two primary flows:

- `modkit init` for first-time setup with an interactive multi-select skill picker
- `modkit add <skill-name>` for directly installing a known skill, with an interactive fallback if no valid skill name is provided

The CLI fetches a public registry manifest from GitHub, prompts the developer to choose a target directory, creates the expected local `skills` directory structure when needed, downloads the selected `SKILL.md` files, and writes them locally as editable project files.

## User Stories

1. As a developer starting a new project, I want to run a single CLI command to browse available skills, so that I can set up local skills without manual file copying.
2. As a developer using OpenCode conventions, I want to install skills into `.opencode`, so that my project follows the expected OpenCode directory structure.
3. As a developer using Claude conventions, I want to install skills into `.claude`, so that my project follows the expected Claude directory structure.
4. As a developer, I want `modkit init` to show me all available skills in a multi-select picker, so that I can install several skills during initial setup.
5. As a developer who already knows the skill I want, I want to run `modkit add <skill-name>`, so that I can install a single skill quickly without going through the full setup flow.
6. As a developer who forgets the exact skill slug, I want `modkit add` to fall back to an interactive picker, so that I can still complete the install without leaving the terminal.
7. As a developer, I want the skill picker to show a human-friendly title and description, so that I can understand what each skill is for before selecting it.
8. As a developer, I want installed skills to be visibly marked in the picker, so that I can see what is already present in the target directory.
9. As a developer, I want installed skills to remain selectable, so that I can intentionally refresh a local skill from the registry when needed.
10. As a developer, I want the CLI to prompt me to choose between `.opencode` and `.claude` every time, so that the target remains explicit and predictable.
11. As a developer, I want the CLI to create the target directory if it does not exist, so that I do not need to prepare the folder structure by hand.
12. As a developer, I want the CLI to create the nested `skills/<skill-name>/SKILL.md` layout for me, so that installed skills match the expected local convention exactly.
13. As a developer, I want downloaded skills to be copied verbatim from the registry, so that I receive the exact authored prompt content.
14. As a developer, I want installed skills to remain ordinary local Markdown files, so that I can edit them to suit my project after installation.
15. As a developer, I want the CLI to warn me before overwriting an existing local skill, so that local edits are not replaced silently.
16. As a developer, I want to be able to skip overwriting an existing skill, so that I can preserve a customized local version.
17. As a developer, I want to be able to overwrite an existing skill on purpose, so that I can refresh a stale or broken local copy.
18. As a developer running `modkit init`, I want cancellation or empty selection to leave my project untouched, so that exploratory use does not create unwanted folders.
19. As a developer, I want a concise success summary after installation, so that I can confirm which skills were installed and where they were written.
20. As a developer, I want error messages to name the failing registry resource or skill, so that I can troubleshoot a failed install quickly.
21. As a developer, I want the registry to be fetched from a central public GitHub repository, so that teams can publish reusable skills from one authoritative source.
22. As a registry maintainer, I want the skill list to come from a single manifest file, so that registry ordering and display metadata are controlled intentionally.
23. As a registry maintainer, I want each skill to have a stable kebab-case name slug, so that skill installation paths and command arguments remain predictable.
24. As a registry maintainer, I want each skill entry to include a title and description, so that the interactive picker can communicate user-facing context clearly.
25. As a registry maintainer, I want the manifest to live at a simple well-known location, so that the CLI has one obvious entrypoint for discovery.
26. As a registry maintainer, I want the CLI to read from the default branch of the public registry, so that newly published skills become available immediately.
27. As a developer, I want the CLI to fetch fresh manifest and skill data every run, so that I always see the latest registry state.
28. As a developer using shell scripts, I want `modkit` to support flags alongside prompts, so that I can automate common install flows when needed.
29. As a developer, I want cancellation to exit successfully rather than as an error, so that aborted interactive sessions do not break shell workflows unnecessarily.
30. As a developer installing multiple skills, I want successful installs to remain in place even if one skill fails, so that partial progress is preserved.
31. As a developer, I want the CLI to exit non-zero on real failures, so that scripts and CI can detect incomplete installs.
32. As a maintainer of the CLI, I want the command layer to stay thin, so that most logic can live in stable modules that are easier to test and evolve.
33. As a maintainer of the CLI, I want registry access, install planning, and filesystem writes to be clearly separated, so that the behavior remains understandable as the tool grows.
34. As a maintainer of the CLI, I want the implementation to target Node 20+ and pure ESM, so that the runtime can rely on modern platform APIs without compatibility shims.
35. As a maintainer of the CLI, I want the package to avoid writing files during npm install, so that all side effects remain explicit user-triggered CLI actions.

## Implementation Decisions

- `modkit` will be a greenfield npm CLI. The current workspace does not contain an existing ModKit implementation or adjacent ADRs that constrain the design.
- The CLI will ship two commands with distinct user intent: `init` for first-time interactive setup and `add` for targeted installation of a known skill.
- The package will target Node 20+ and use pure ESM so it can rely on built-in `fetch` and modern Node CLI behavior.
- The registry will be a single built-in public GitHub repository. Registry source selection and private registry authentication are out of scope for v1.
- Registry discovery will use raw GitHub content URLs rather than the GitHub REST API.
- The registry contract will be a root-level JSON manifest named `skills.json`.
- Each manifest entry will contain `name`, `title`, `description`, and `path`.
- Manifest order will define picker order so the registry can curate how skills appear.
- Skill names will be restricted to lowercase kebab-case slugs because the slug becomes both a command argument and a local directory name.
- `init` will always prompt for the target directory first. Installed-state indicators and conflict behavior depend on the chosen target.
- Target directory selection will always be explicit between `.opencode` and `.claude`, even if one already exists.
- `init` will present an interactive multi-select picker that shows title and description for each skill.
- Already-installed skills will remain visible and selectable in the picker, but they will be marked as installed.
- `add` will accept a canonical skill slug as a positional argument. If the argument is missing or invalid, the command will fall back to an interactive single-select picker.
- Direct command arguments will match only the manifest `name` slug. Display titles will be used for interactive browsing and suggestions, not as command input contracts.
- The CLI will create the selected target directory and its nested `skills` directory only when the user confirms an install by selecting at least one skill.
- Installed skills will always be written using the local shape `skills/<skill-name>/SKILL.md` under the selected target directory.
- Downloaded `SKILL.md` content will be copied verbatim and remain editable after installation.
- The CLI will not create any local metadata file for installed skills, registry references, versions, or timestamps. The local directory tree is the source of truth.
- Conflict handling will be prompt-driven by default. Existing local `SKILL.md` files will trigger overwrite-or-skip decisions instead of silent replacement.
- Non-interactive flags will be supported for scripting, but the default experience will remain prompt-driven.
- Empty selection and explicit cancellation will be treated as no-op outcomes and should not create directories or files.
- Multi-skill installs will be best-effort. Successful installs will remain on disk even if a later skill fails.
- The CLI will exit with `0` on success and cancellation, and non-zero on actual failures including partial install failures.
- Success output will be concise and should report the target directory, installed skill names, and the local paths written.
- Error output will be actionable and should identify the failing registry request, manifest problem, or skill download whenever possible.
- Recommended deep modules for implementation are:
- A registry client module with a stable interface for listing available skills and fetching the raw Markdown for a selected skill.
- An install planner or installer module that encapsulates directory creation, installed-skill detection, conflict handling hooks, and write execution behind one small interface.
- A target workspace resolver module that normalizes project root, validates target selection, and computes the final install destinations consistently.
- A thin command orchestration layer for `init` and `add` that maps CLI input and prompts onto the deeper registry and installer modules.

## Testing Decisions

- Good tests should validate externally observable behavior rather than implementation details. For this CLI, that means testing command outcomes, written files, exit semantics, and user-visible summaries instead of internal helper structure.
- v1 will keep automated coverage intentionally small and pair it with manual verification.
- The minimum automated coverage will be one smoke test that exercises the core install flow against a mocked registry response and a temporary project directory.
- The most valuable automated smoke path is a successful install that proves the CLI can fetch the manifest, select a target, create the local directory structure, and write `SKILL.md` to the expected location.
- Manual verification should cover the interactive multi-select flow, the direct `add <skill-name>` flow, conflict prompts, cancellation/no-op behavior, and partial failure reporting.
- If automated coverage expands later, the highest-value modules to isolate are the registry client, target workspace resolver, and installer module because they can be exercised without coupling tightly to prompt rendering.
- No meaningful prior art for ModKit-specific tests exists in the current workspace because the CLI does not exist yet.

## Out of Scope

- A dedicated `update` command
- A dedicated `remove` command
- Automatic update or synchronization of previously installed skills
- Private GitHub registry support or GitHub authentication flows
- Multiple registry sources, custom registries, or runtime registry overrides
- Registry caching or offline installs
- Local install metadata files or version tracking
- File transformation, templating, or content normalization during install
- Previewing full `SKILL.md` content inside the picker
- File creation during npm install
- Support for non-Markdown skill assets or runtime execution semantics inside skills
- Advanced search, tagging, or categorization beyond the manifest fields already defined for v1

## Further Notes

- The core product value is a clean install experience for reusable skills, not a large package-management surface area. The v1 scope should stay small and explicit.
- The chosen design intentionally treats skills as copied local project files rather than managed packages. That keeps authorship transparent and aligns with the requirement that installed skills remain editable.
- The manifest-driven registry gives the CLI enough structure for a high-quality picker without introducing version negotiation, schema complexity, or a heavier registry backend.
- The deepest implementation value lies in keeping the command layer thin and concentrating behavior in a few stable modules that can later support broader automation or richer testing.
