import { BodyPayloadValueType } from '../types'
import { transformToBodyPayload } from '../utils'

// Regression coverage for #38860: form-data / x-www-form-urlencoded body values
// that contain a colon (e.g. a URL) were truncated at the first colon because
// `item.split(':')` was destructured to `[key, value]`, discarding everything
// after the first colon. The value must survive the transform intact.
describe('transformToBodyPayload', () => {
  it('keeps a value that contains a single colon (URL with port)', () => {
    const result = transformToBodyPayload('callback:https://example.com:8080/path', true)
    expect(result).toEqual([
      {
        key: 'callback',
        type: BodyPayloadValueType.text,
        value: 'https://example.com:8080/path',
      },
    ])
  })

  it('keeps a value that contains multiple colons', () => {
    const result = transformToBodyPayload('ts:2026-07-24T12:34:56Z', true)
    expect(result[0]!.key).toBe('ts')
    expect(result[0]!.value).toBe('2026-07-24T12:34:56Z')
  })

  it('round-trips a colon-containing value without loss', () => {
    const key = 'redirect'
    const value = 'https://example.com:8080/a:b:c'
    const [row] = transformToBodyPayload(`${key}:${value}`, true)
    expect(row!.key).toBe(key)
    expect(row!.value).toBe(value)
  })

  it('parses multiple rows, preserving colons in each value', () => {
    const result = transformToBodyPayload('a:http://x:1\nb:plain', true)
    expect(result).toEqual([
      { key: 'a', type: BodyPayloadValueType.text, value: 'http://x:1' },
      { key: 'b', type: BodyPayloadValueType.text, value: 'plain' },
    ])
  })

  it('handles a row with no colon (key only, empty value)', () => {
    const result = transformToBodyPayload('loneKey', true)
    expect(result).toEqual([{ key: 'loneKey', type: BodyPayloadValueType.text, value: '' }])
  })

  it('handles a leading colon (empty key) and a trailing colon (empty value)', () => {
    expect(transformToBodyPayload(':onlyValue', true)[0]).toEqual({
      key: '',
      type: BodyPayloadValueType.text,
      value: 'onlyValue',
    })
    expect(transformToBodyPayload('onlyKey:', true)[0]).toEqual({
      key: 'onlyKey',
      type: BodyPayloadValueType.text,
      value: '',
    })
  })

  it('returns a single text payload when hasKey is false (raw body untouched)', () => {
    const raw = 'https://example.com:8080/path'
    expect(transformToBodyPayload(raw, false)).toEqual([
      { type: BodyPayloadValueType.text, value: raw },
    ])
  })
})
