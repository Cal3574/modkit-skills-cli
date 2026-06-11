# ModKit

`modkit` installs reusable AI skills from a GitHub-backed registry into a local project.

Current install targets:
- `.opencode`
- `.claude`

Installed skills are written as normal local Markdown files:

```text
<target>/skills/<skill-name>/SKILL.md
```

## Requirements

- Node.js `20+`

## Commands

### `modkit init`

Interactive project setup.

What it does:
- prompts for `.opencode` or `.claude`
- fetches the registry manifest
- shows an interactive multi-select list with skill title, slug, and description
- marks already-installed skills as `[installed]`
- installs all selected skills
- prompts before overwriting existing local skills
- prints a summary of installed, overwritten, skipped, and failed skills

### `modkit add <skill-name>`

Direct single-skill install.

What it does:
- prompts for `.opencode` or `.claude`
- installs the named skill if the slug exists in the registry
- if the slug is missing or invalid, falls back to an interactive single-select picker
- prompts before overwriting an existing local skill
- prints the written path

## Current Behavior

### Conflict handling

If a local `SKILL.md` already exists:
- interactive pickers still allow selecting that skill
- the CLI prompts to `overwrite` or `skip`
- `init` summarizes overwritten and skipped skills separately

### Cancellation and no-op behavior

- canceling an interactive prompt exits successfully
- empty selection in `init` is treated as a no-op
- cancellation and no-op flows print `No changes made.`
- `init` collects overwrite decisions before writing files, so canceling during overwrite prompts does not leave partial local changes

### Partial failure behavior

`modkit init` is best-effort for multi-skill installs:
- successful installs remain on disk if a later skill fails
- failures are summarized per skill
- real failures return exit code `1`

## Registry

Default registry base URL:

```text
https://raw.githubusercontent.com/Cal3574/modkit-skills/main
```

Override it with:

```text
MODKIT_REGISTRY_BASE_URL
```

Expected manifest location:

```text
<registry-base>/skills.json
```

Expected manifest shape:

```json
[
  {
    "name": "grill-me",
    "title": "Grill Me",
    "description": "Stress-test a plan or design through direct questioning.",
    "path": "skills/grill-me/SKILL.md",
    "files": ["SKILL.md", "reference.md"]
  }
]
```

Rules:
- `name` must be lowercase kebab-case
- `title` must be a human-readable label
- `description` should briefly explain the skill
- `path` is the registry-relative path to the raw `SKILL.md`
- `files` (optional) lists every file in the skill directory to install, relative to the directory containing `path`; when omitted, only `SKILL.md` is installed

## Install

After publishing, you can use ModKit without cloning this repo.

Run directly with `npx`:

```sh
npx @cal3574/modkit init
npx @cal3574/modkit add grill-me
```

Install globally:

```sh
npm install -g @cal3574/modkit
modkit init
modkit add grill-me
```

## Development

Install dependencies:

```sh
npm install
```

Build the CLI:

```sh
npm run build
```

Run tests:

```sh
npm test
```

Run the built CLI locally:

```sh
node ./dist/bin/modkit.js --help
node ./dist/bin/modkit.js init
node ./dist/bin/modkit.js add grill-me
```

## Status

Implemented so far:
- direct `add` flow
- `init` multi-select flow
- `add` fallback picker
- conflict-aware overwrite or skip flow
- cancellation and no-op handling
- partial failure reporting for multi-skill installs

Still not implemented:
- richer non-interactive flags
- advanced registry configuration beyond `MODKIT_REGISTRY_BASE_URL`

## Publish

Build and verify the package:

```sh
npm install
npm test
npm pack
```

Publish it publicly to npm:

```sh
npm publish --access public
```
