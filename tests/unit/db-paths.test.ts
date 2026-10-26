import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveProjectRoot } from '../../server/utils/db'

describe('resolveProjectRoot', () => {
  it('uses the working directory when running from the project root', () => {
    const root = resolve('/repo')
    expect(resolveProjectRoot(root)).toBe(root)
  })

  it('moves up from .output so preview shares the project database', () => {
    const root = resolve('/repo')
    expect(resolveProjectRoot(resolve(root, '.output'))).toBe(root)
  })
})
