import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MessageChannel } from 'node:worker_threads'

import { describe, expect, it } from 'vitest'

import { createEmptyForceSimBuffer, createForceSimulation, type ForceSimGraph } from './index.ts'

const sourceRoot = dirname(fileURLToPath(import.meta.url))
const packageRoot = dirname(sourceRoot)

describe('force-sim purity and worker contract', () => {
  it('keeps package dependencies platform-pure', () => {
    const packageJson = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
    }

    expect(Object.keys(packageJson.dependencies ?? {})).toEqual(['@cosimosi/config'])
  })

  it('does not import platform or rendering modules', () => {
    const forbiddenImports = ['thr' + 'ee', 'rea' + 'ct', 'rea' + 'ct-native']
    const forbiddenGlobals = ['docu' + 'ment', 'win' + 'dow']
    const randomCall = 'Math.' + 'random'
    const importPattern = /(?:from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\))/g
    const globalPattern = new RegExp(`\\b(?:${forbiddenGlobals.join('|')})\\b`)

    for (const file of sourceFiles(sourceRoot)) {
      const text = readFileSync(file, 'utf8')
      for (const match of text.matchAll(importPattern)) {
        const specifier = match[1] ?? match[2] ?? ''
        expect(
          forbiddenImports.some((forbidden) => specifier === forbidden || specifier.startsWith(`${forbidden}/`)),
        ).toBe(false)
      }
      expect(globalPattern.test(text)).toBe(false)
      expect(text.includes(randomCall)).toBe(false)
    }
  })

  it('accepts structured-cloneable graphs and returns a transferable coordinate buffer', async () => {
    const graph: ForceSimGraph = {
      neurons: [{ id: 'n1', connectivity: 1, seedHint: { x: 0, y: 0, z: 5 } }],
      synapses: [],
      episodicMemories: [{ id: 'm1' }],
      activations: [{ episodicMemoryId: 'm1', neuronId: 'n1', weight: 1 }],
    }
    const clonedGraph = structuredClone(graph)
    expect(clonedGraph).toEqual(graph)

    const simulation = createForceSimulation(clonedGraph)
    const output = simulation.tick(1 / 60, createEmptyForceSimBuffer(simulation.nodeIndex.entries.length))
    const expectedLength = output.length
    const transferable = output.buffer
    expect(transferable).toBeInstanceOf(ArrayBuffer)
    const { port1, port2 } = new MessageChannel()
    const received = new Promise<Float32Array>((resolve) => {
      port2.once('message', (message) => resolve(message as Float32Array))
    })

    port1.postMessage(output, [transferable as ArrayBuffer])
    const transferred = await received
    port1.close()
    port2.close()

    expect(transferred).toBeInstanceOf(Float32Array)
    expect(transferred.length).toBe(expectedLength)
    expect(output.byteLength).toBe(0)
    expect(simulation.coordinates.byteLength).toBe(expectedLength * Float32Array.BYTES_PER_ELEMENT)

    const nextOutput = simulation.tick(1 / 60, createEmptyForceSimBuffer(simulation.nodeIndex.entries.length))
    expect(nextOutput.length).toBe(expectedLength)
  })
})

function sourceFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root)) {
    const path = join(root, entry)
    const stats = statSync(path)
    if (stats.isDirectory()) {
      files.push(...sourceFiles(path))
    } else if (stats.isFile() && ['.ts', '.tsx'].includes(extname(path))) {
      files.push(path)
    }
  }
  return files
}
