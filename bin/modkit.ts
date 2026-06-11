#!/usr/bin/env node

import { runCli } from "../src/cli.js";

const exitCode = await runCli({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
  env: process.env,
  fetchImpl: fetch
});

process.exitCode = exitCode;
