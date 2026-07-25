import type { KeyValue } from './types'
import { uniqueId } from 'es-toolkit/compat'

/**
 * SPIKE: structured `{ key, value, id }[]` model for the HTTP node's params/headers.
 *
 * The persisted model today is a newline-joined, colon-delimited string
 * (`"a:1\nb:2"`). `\n` and `:` are simultaneously structural delimiters and
 * legal payload characters, so the list -> string -> list round trip that runs on
 * every keystroke is lossy for a whole class of inputs. Holding the rows as a
 * list removes the delimiters entirely, so there is nothing left to split on.
 *
 * This module is the migration boundary: it reads the legacy string, produces the
 * structured list, and can write the legacy string back for consumers that have
 * not been migrated yet.
 */

const UNIQUE_ID_PREFIX = 'key-value-'

export type StructuredKeyValue = KeyValue & { id: string }

/**
 * Parse the legacy string into the structured list.
 *
 * Splitting semantics deliberately match the backend's `Executor._init_headers`
 * / `_init_params` (`line.split(":", 1)` + strip), so the structured list carries
 * the same key/value the runtime would have derived from the string. Anything the
 * string model cannot express (see `serializeKeyValueList`) is lost before this
 * function ever runs — that loss belongs to the string, not to the parser.
 */
export const parseKeyValueString = (value: string): StructuredKeyValue[] => {
  if (!value) return []

  return value.split('\n').map((line) => {
    const separatorIndex = line.indexOf(':')
    const [key, rawValue] =
      separatorIndex === -1
        ? [line, '']
        : [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)]

    return {
      id: uniqueId(UNIQUE_ID_PREFIX),
      key: key.trim(),
      value: rawValue.trim(),
    }
  })
}

/**
 * Render the structured list back to the legacy string.
 *
 * Kept so unmigrated consumers (and the current backend, which types
 * `headers`/`params` as `str`) keep working while the migration is in flight.
 * This direction is inherently lossy and that is the point of the spike: a key
 * containing `:`, or a key/value containing `\n`, has no faithful string
 * encoding. Callers that need fidelity must consume the structured list.
 */
export const serializeKeyValueList = (list: KeyValue[], noFilter?: boolean): string => {
  const source = noFilter ? list : list.filter((item) => item.key && item.value)
  return source.map((item) => `${item.key}:${item.value}`).join('\n')
}

/** Attach ids to rows that arrived without one (e.g. from an imported DSL). */
export const normalizeKeyValueList = (list: KeyValue[]): StructuredKeyValue[] =>
  list.map((item) => ({
    ...item,
    id: item.id || uniqueId(UNIQUE_ID_PREFIX),
  }))

/**
 * Migrate-on-load entry point. Accepts either model and always yields the
 * structured one, mirroring how `body.data` already accepts `string | BodyPayload`
 * (see `use-config.ts` and the backend's `HttpRequestNodeBody.check_data`).
 */
export const toStructuredKeyValueList = (
  value: string | KeyValue[] | undefined | null,
): StructuredKeyValue[] => {
  if (!value) return []
  if (Array.isArray(value)) return normalizeKeyValueList(value)
  return parseKeyValueString(value)
}

/**
 * Flatten either model to text for `{{#var#}}` scanning.
 *
 * A stopgap for consumers that scan node data as strings. Correct for variable
 * detection (no key or value may legally contain `{{#...#}}` spanning a
 * delimiter), but a real migration should hand those consumers keys and values
 * as separate strings rather than re-joining them.
 */
export const toScannableText = (value: string | KeyValue[] | undefined | null): string => {
  if (!value) return ''
  if (typeof value === 'string') return value
  return serializeKeyValueList(value, true)
}

/** Structural equality, ignoring ids (which are render keys, not data). */
export const isSameKeyValueList = (a: KeyValue[], b: KeyValue[]): boolean =>
  a.length === b.length &&
  a.every((item, index) => item.key === b[index]!.key && item.value === b[index]!.value)
