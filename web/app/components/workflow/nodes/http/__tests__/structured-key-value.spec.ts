import type { KeyValue } from '../types'
import { describe, expect, it } from 'vitest'
import {
  parseKeyValueString,
  serializeKeyValueList,
  toStructuredKeyValueList,
} from '../structured-key-value'

/**
 * Verbatim copy of the pre-spike `use-key-value-list.ts` round trip (HEAD
 * 58f83fa7e7). Reproduced here rather than imported so the test measures the
 * old* behaviour even though the hook has been migrated — every "legacy" string
 * below is produced by this code, not hand-written, so the fixtures are provably
 * the shape the shipping editor emits.
 */
const legacyStrToKeyValueList = (value: string): KeyValue[] =>
  value.split('\n').map((item) => {
    const [key, ...others] = item.split(':')
    return { key: key!.trim(), value: others.join(':').trim() }
  })

const legacyStringifyList = (items: KeyValue[]): string =>
  items
    .filter((item) => item.key && item.value)
    .map((item) => `${item.key}:${item.value}`)
    .join('\n')

const legacyRoundTrip = (rows: KeyValue[]): KeyValue[] =>
  legacyStrToKeyValueList(legacyStringifyList(rows))

const stripIds = (list: KeyValue[]) => list.map(({ key, value }) => ({ key, value }))

describe('structured key/value model', () => {
  describe('migrating real string-format data', () => {
    // The exact string the shipping editor persists for a realistic HTTP node:
    // a bearer token, a colon-bearing value (#38860), and an empty row.
    const savedRows: KeyValue[] = [
      { key: 'Authorization', value: 'Bearer abc123' },
      { key: 'X-Trace', value: 'svc:api:v2' },
      { key: '', value: '' },
    ]
    const savedString = legacyStringifyList(savedRows)

    it('is the exact persisted format', () => {
      expect(savedString).toBe('Authorization:Bearer abc123\nX-Trace:svc:api:v2')
    })

    it('converts the persisted string to the structured list without data loss', () => {
      expect(stripIds(parseKeyValueString(savedString))).toEqual([
        { key: 'Authorization', value: 'Bearer abc123' },
        { key: 'X-Trace', value: 'svc:api:v2' },
      ])
    })

    it('converts the structured list back to the identical string', () => {
      expect(serializeKeyValueList(parseKeyValueString(savedString))).toBe(savedString)
    })

    it('assigns a stable id to every migrated row', () => {
      const list = toStructuredKeyValueList(savedString)
      expect(list.every((item) => !!item.id)).toBe(true)
      expect(new Set(list.map((item) => item.id)).size).toBe(list.length)
    })
  })

  describe('round trips the string model loses', () => {
    it('preserves an empty row that the string model silently drops', () => {
      const rows: KeyValue[] = [
        { key: 'a', value: '1' },
        { key: 'draft-key', value: '' },
        { key: 'b', value: '2' },
      ]

      // Legacy: the half-typed row is filtered out and never comes back.
      expect(stripIds(legacyRoundTrip(rows))).toEqual([
        { key: 'a', value: '1' },
        { key: 'b', value: '2' },
      ])

      // Structured: nothing is serialized, so nothing is dropped.
      expect(stripIds(toStructuredKeyValueList(rows))).toEqual(rows)
    })

    it('preserves a key containing a colon, which the string model corrupts', () => {
      const rows: KeyValue[] = [{ key: 'weird:key', value: 'v' }]

      // Legacy: `weird:key:v` re-parses as key `weird`, value `key:v`.
      expect(stripIds(legacyRoundTrip(rows))).toEqual([{ key: 'weird', value: 'key:v' }])

      expect(stripIds(toStructuredKeyValueList(rows))).toEqual(rows)
    })

    it('preserves a value containing a newline, which the string model splits into two rows', () => {
      const rows: KeyValue[] = [{ key: 'note', value: 'line1\nline2' }]

      // Legacy: the embedded newline becomes a row separator.
      expect(legacyRoundTrip(rows)).toHaveLength(2)

      expect(stripIds(toStructuredKeyValueList(rows))).toEqual(rows)
    })

    it('preserves surrounding whitespace in a value, which the string model trims away', () => {
      const rows: KeyValue[] = [{ key: 'pad', value: '  spaced  ' }]

      expect(stripIds(legacyRoundTrip(rows))).toEqual([{ key: 'pad', value: 'spaced' }])

      expect(stripIds(toStructuredKeyValueList(rows))).toEqual(rows)
    })
  })

  describe('parse semantics match the backend executor', () => {
    // graphon 0.6.0 Executor._init_headers: `line.split(":", 1)` + strip.
    it.each([
      [
        'aa:bb\ncc:dd',
        [
          { key: 'aa', value: 'bb' },
          { key: 'cc', value: 'dd' },
        ],
      ],
      [
        'aa:\ncc:dd',
        [
          { key: 'aa', value: '' },
          { key: 'cc', value: 'dd' },
        ],
      ],
      [
        'aa\ncc : dd',
        [
          { key: 'aa', value: '' },
          { key: 'cc', value: 'dd' },
        ],
      ],
      ['k:http://x.test:8080/p', [{ key: 'k', value: 'http://x.test:8080/p' }]],
    ])('parses %j the way the runtime does', (input, expected) => {
      expect(stripIds(parseKeyValueString(input as string))).toEqual(expected)
    })
  })

  describe('toStructuredKeyValueList accepts either model', () => {
    it('passes an already-structured list through, filling in missing ids', () => {
      const list = toStructuredKeyValueList([{ key: 'a', value: '1' }])
      expect(stripIds(list)).toEqual([{ key: 'a', value: '1' }])
      expect(list[0]!.id).toBeTruthy()
    })

    it('treats empty/absent values as an empty list', () => {
      expect(toStructuredKeyValueList('')).toEqual([])
      expect(toStructuredKeyValueList(undefined)).toEqual([])
      expect(toStructuredKeyValueList(null)).toEqual([])
    })
  })
})
