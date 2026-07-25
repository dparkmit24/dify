import type { BodyPayload } from './types'
import { BodyPayloadValueType } from './types'

export const transformToBodyPayload = (old: string, hasKey: boolean): BodyPayload => {
  if (!hasKey) {
    return [
      {
        type: BodyPayloadValueType.text,
        value: old,
      },
    ]
  }
  const bodyPayload = old.split('\n').map((item) => {
    // Split on the first colon only, keeping any further colons in the value —
    // mirrors the sibling parser in hooks/use-key-value-list.ts so a value like
    // `https://example.com:8080/path` is not truncated to `https`. (#38860)
    const [key, ...rest] = item.split(':')
    const value = rest.join(':')
    return {
      key: key || '',
      type: BodyPayloadValueType.text,
      value: value || '',
    }
  })
  return bodyPayload
}
