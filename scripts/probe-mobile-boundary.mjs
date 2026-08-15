#!/usr/bin/env node
import { runBoundaryProbe } from './probe-boundary.mjs'

await runBoundaryProbe({
  name: 'mobile',
  config: '.eslintrc.js',
  // mobile's boundary coverage rides `lint`'s whole-app `eslint .` pass.
  ordinaryScan: [['lint', 'eslint . --max-warnings=0']],
})
