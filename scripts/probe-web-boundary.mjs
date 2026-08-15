#!/usr/bin/env node
import { runBoundaryProbe } from './probe-boundary.mjs'

await runBoundaryProbe({
  name: 'web',
  config: 'eslint.config.js',
  // web's boundary coverage rides `lint` → `lint:boundaries` over the whole src tree.
  ordinaryScan: [
    ['lint', 'lint:boundaries'],
    ['lint:boundaries', 'eslint "src/**/*.{ts,tsx}" --max-warnings=0'],
  ],
})
