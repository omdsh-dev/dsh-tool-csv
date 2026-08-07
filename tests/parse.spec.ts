import { describe, expect, it } from 'vitest'
import { parseCsv, normalizeDelimiter, MAX_INPUT_BYTES } from '../src/parse.ts'

const base = { header: true } as const

describe('parseCsv: RFC 4180 边界', () => {
  it('parses a basic two-row grid', () => {
    expect(parseCsv('a,b\n1,2', { ...base, delimiter: ',' })).toEqual({
      rows: [['a', 'b'], ['1', '2']],
      skippedBlank: 0,
    })
  })

  it('keeps commas inside quoted fields', () => {
    const r = parseCsv('"x,y",z', { ...base, delimiter: ',' })
    expect(r.rows).toEqual([['x,y', 'z']])
  })

  it('decodes escaped quotes ("")', () => {
    const r = parseCsv('"a""b"', { ...base, delimiter: ',' })
    expect(r.rows).toEqual([['a"b']])
  })

  it('keeps newlines inside quoted fields (multi-line field)', () => {
    const r = parseCsv('"a\nb",c', { ...base, delimiter: ',' })
    expect(r.rows).toEqual([['a\nb', 'c']])
  })

  it('normalizes CRLF to single rows with no trailing empty row', () => {
    const r = parseCsv('a\r\nb\r\n', { ...base, delimiter: ',' })
    expect(r.rows).toEqual([['a'], ['b']])
    expect(r.skippedBlank).toBe(0)
  })

  it('treats a lone CR as a row terminator too', () => {
    const r = parseCsv('a\rb', { ...base, delimiter: ',' })
    expect(r.rows).toEqual([['a'], ['b']])
  })

  it('strips a leading UTF-8 BOM', () => {
    const r = parseCsv('\uFEFFa,b', { ...base, delimiter: ',' })
    expect(r.rows[0]).toEqual(['a', 'b'])
  })

  it('skips blank lines and reports the count', () => {
    const r = parseCsv('a\n\n\nb', { ...base, delimiter: ',' })
    expect(r.rows).toEqual([['a'], ['b']])
    expect(r.skippedBlank).toBe(2)
  })

  it('treats quotes mid-field as literals', () => {
    const r = parseCsv('a "b",c', { ...base, delimiter: ',' })
    expect(r.rows).toEqual([['a "b"', 'c']])
  })

  it('handles input without a trailing newline', () => {
    const r = parseCsv('a,b', { ...base, delimiter: ',' })
    expect(r.rows).toEqual([['a', 'b']])
  })

  it('supports tab as a delimiter', () => {
    const r = parseCsv('a\tb\n1\t2', { ...base, delimiter: '\t' })
    expect(r.rows).toEqual([['a', 'b'], ['1', '2']])
  })

  it('keeps empty fields inside a row (only fully-blank rows are skipped)', () => {
    const r = parseCsv('a,,c\n,,', { ...base, delimiter: ',' })
    expect(r.rows).toEqual([['a', '', 'c']])
    expect(r.skippedBlank).toBe(1)
  })

  it('rejects non-string input', () => {
    expect(() => parseCsv(42 as unknown as string, { ...base, delimiter: ',' })).toThrow('csv: csv must be a string')
  })

  it(`rejects input over ${MAX_INPUT_BYTES} bytes`, () => {
    const big = 'x'.repeat(MAX_INPUT_BYTES + 1)
    expect(() => parseCsv(big, { ...base, delimiter: ',' })).toThrow(`csv: input exceeds ${MAX_INPUT_BYTES} bytes`)
  })
})

describe('normalizeDelimiter', () => {
  it('defaults to comma', () => {
    expect(normalizeDelimiter(undefined)).toBe(',')
  })

  it('maps "tab" to \\t', () => {
    expect(normalizeDelimiter('tab')).toBe('\t')
  })

  it('accepts a single character', () => {
    expect(normalizeDelimiter(';')).toBe(';')
  })

  it('rejects multi-character delimiters', () => {
    expect(() => normalizeDelimiter('||')).toThrow('csv: delimiter must be a single character or "tab"')
    expect(() => normalizeDelimiter(5)).toThrow('csv: delimiter must be a single character or "tab"')
  })
})
