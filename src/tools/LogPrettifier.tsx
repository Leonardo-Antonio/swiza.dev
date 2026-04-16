import { useState, useCallback, useMemo, useRef } from 'react'
import { format } from 'sql-formatter'

interface Props {
  onCopy: (msg: string) => void
}

const SQL_MARKER_PATTERNS = [
  'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP',
  'FROM', 'WHERE', 'JOIN', 'GROUP', 'ORDER', 'HAVING', 'LIMIT',
  'INTO', 'VALUES', 'TABLE', 'SET', 'LIKE', 'BETWEEN',
].map(m => new RegExp('\\b' + m + '\\b', 'i'))

function isSqlLike(value: string): boolean {
  if (value.length < 20) return false
  let count = 0
  for (const re of SQL_MARKER_PATTERNS) {
    if (re.test(value)) count++
    if (count >= 3) return true
  }
  return false
}

type Dialect = 'sql' | 'mysql' | 'postgresql' | 'mariadb' | 'sqlite' | 'bigquery' | 'transactsql'

const dialects: { id: Dialect; label: string }[] = [
  { id: 'sql', label: 'Standard' },
  { id: 'mysql', label: 'MySQL' },
  { id: 'postgresql', label: 'PostgreSQL' },
  { id: 'mariadb', label: 'MariaDB' },
  { id: 'sqlite', label: 'SQLite' },
  { id: 'bigquery', label: 'BigQuery' },
  { id: 'transactsql', label: 'T-SQL' },
]

const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'ON', 'AS', 'JOIN',
  'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'INSERT', 'INTO', 'VALUES',
  'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'VIEW',
  'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'DISTINCT',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL',
  'TRUE', 'FALSE', 'ASC', 'DESC', 'WITH', 'RECURSIVE', 'IF', 'BEGIN', 'COMMIT',
  'ROLLBACK', 'GRANT', 'REVOKE', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES',
  'CONSTRAINT', 'DEFAULT', 'CHECK', 'UNIQUE', 'CASCADE', 'RESTRICT',
  'RETURNING', 'OVER', 'PARTITION', 'ROWS', 'RANGE', 'UNBOUNDED', 'PRECEDING',
  'FOLLOWING', 'CURRENT', 'ROW', 'FETCH', 'NEXT', 'ONLY', 'FIRST', 'LAST',
  'WINDOW', 'USING', 'NATURAL', 'EXCEPT', 'INTERSECT', 'LATERAL',
  'MATERIALIZED', 'TEMP', 'TEMPORARY', 'REPLACE', 'TRUNCATE', 'EXPLAIN',
  'ANALYZE', 'COPY', 'TO', 'DELIMITER', 'CSV', 'HEADER', 'ILIKE', 'SIMILAR',
  'ANY', 'SOME', 'FOR', 'LOCK', 'SHARE', 'NOWAIT', 'OF', 'FORCE', 'USE',
  'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'FLOAT', 'DOUBLE',
  'DECIMAL', 'NUMERIC', 'VARCHAR', 'CHAR', 'TEXT', 'BOOLEAN', 'BOOL',
  'DATE', 'TIME', 'TIMESTAMP', 'INTERVAL', 'SERIAL', 'BIGSERIAL',
  'JSON', 'JSONB', 'UUID', 'BYTEA', 'BLOB', 'CLOB', 'ENUM', 'ARRAY',
  'ADD', 'COLUMN', 'RENAME', 'TYPE', 'AFTER', 'BEFORE', 'TRIGGER',
  'FUNCTION', 'PROCEDURE', 'RETURNS', 'RETURN', 'DECLARE', 'VARIABLE',
  'WHILE', 'LOOP', 'REPEAT', 'UNTIL', 'DO', 'ELSEIF', 'LEAVE', 'CALL',
])

const SQL_FUNCTIONS = new Set([
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF', 'CAST',
  'CONVERT', 'CONCAT', 'SUBSTRING', 'TRIM', 'UPPER', 'LOWER', 'NOW',
  'LENGTH', 'REPLACE', 'ROUND', 'FLOOR', 'CEIL', 'ABS', 'MOD',
  'EXTRACT', 'POSITION', 'OVERLAY', 'GREATEST', 'LEAST', 'ARRAY_AGG',
  'STRING_AGG', 'JSON_AGG', 'JSONB_AGG', 'ROW_NUMBER', 'RANK',
  'DENSE_RANK', 'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE', 'NTH_VALUE',
  'NTILE', 'CUME_DIST', 'PERCENT_RANK', 'GENERATE_SERIES',
  'ARRAY_LENGTH', 'UNNEST', 'RANDOM', 'SETSEED',
  'TO_CHAR', 'TO_DATE', 'TO_TIMESTAMP', 'TO_NUMBER', 'DATE_TRUNC',
  'AGE', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP',
  'LOCALTIME', 'LOCALTIMESTAMP', 'YEAR', 'MONTH', 'DAY', 'HOUR',
  'MINUTE', 'SECOND', 'LEFT', 'RIGHT', 'LPAD', 'RPAD', 'REVERSE',
  'SPLIT_PART', 'REGEXP_REPLACE', 'REGEXP_MATCHES', 'FORMAT',
  'POWER', 'SQRT', 'LOG', 'LN', 'EXP', 'SIGN', 'TRUNC',
  'DATE_PART', 'DATE_ADD', 'DATE_SUB', 'DATEDIFF', 'TIMEDIFF',
  'IF', 'IIF', 'IFNULL', 'NVL', 'NVL2', 'DECODE',
  'GROUP_CONCAT', 'LISTAGG', 'PERCENTILE_CONT', 'PERCENTILE_DISC',
  'JSON_OBJECTAGG', 'JSON_OBJECT', 'JSON_ARRAY',
])

interface RawSqlQuery {
  path: string
  raw: string
}

function extractSqlValues(obj: unknown, path: string = ''): RawSqlQuery[] {
  const results: RawSqlQuery[] = []
  if (typeof obj === 'string' && isSqlLike(obj)) {
    results.push({ path, raw: obj })
  } else if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      results.push(...extractSqlValues(item, `${path}[${i}]`))
    })
  } else if (obj !== null && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      results.push(...extractSqlValues(value, path ? `${path}.${key}` : key))
    }
  }
  return results
}

function formatSqlQuery(
  raw: string,
  dialect: Dialect,
  tabWidth: number,
  keywordCase: 'upper' | 'lower' | 'capitalize',
): string {
  try {
    let result = format(raw, {
      language: dialect,
      tabWidth,
      keywordCase: keywordCase === 'capitalize' ? 'upper' : keywordCase,
    })
    if (keywordCase === 'capitalize') {
      result = result.replace(/\b[A-Z][A-Z_]{1,}\b/g, word =>
        SQL_KEYWORDS.has(word) || SQL_FUNCTIONS.has(word)
          ? word.charAt(0) + word.slice(1).toLowerCase()
          : word
      )
    }
    return result
  } catch {
    return raw.replace(/\s+/g, ' ').trim()
  }
}

function cleanObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    if (isSqlLike(obj)) {
      return obj.replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
    }
    return obj
  }
  if (Array.isArray(obj)) return obj.map(cleanObject)
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[k] = cleanObject(v)
    }
    return result
  }
  return obj
}

function tryParseLog(raw: string): unknown {
  const trimmed = raw.trim()

  try {
    return JSON.parse(trimmed)
  } catch (directError) {
    const braceIdx = trimmed.indexOf('{')
    const bracketIdx = trimmed.indexOf('[')
    if (braceIdx !== -1 || bracketIdx !== -1) {
      const start = braceIdx === -1 ? bracketIdx : bracketIdx === -1 ? braceIdx : Math.min(braceIdx, bracketIdx)
      try {
        return JSON.parse(trimmed.slice(start))
      } catch { /* continue */ }
    }

    const lines = trimmed.split('\n').filter(l => l.trim())
    if (lines.length > 1) {
      const objects: unknown[] = []
      for (const line of lines) {
        const lt = line.trim()
        const bi = lt.indexOf('{')
        const str = bi !== -1 ? lt.slice(bi) : lt
        try {
          objects.push(JSON.parse(str))
        } catch { /* skip */ }
      }
      if (objects.length > 0) return objects.length === 1 ? objects[0] : objects
    }

    throw directError
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function findStringEnd(s: string, start: number): number {
  let i = start + 1
  while (i < s.length) {
    if (s[i] === '\\') { i += 2; continue }
    if (s[i] === '"') return i + 1
    i++
  }
  return s.length
}

function highlightJson(raw: string): string {
  const out: string[] = []
  let i = 0
  while (i < raw.length) {
    const ch = raw[i]
    if (ch === '"') {
      const end = findStringEnd(raw, i)
      const str = escapeHtml(raw.slice(i, end))
      let j = end
      while (j < raw.length && raw[j] === ' ') j++
      if (raw[j] === ':') {
        out.push(`<span class="token-key">${str}</span>`)
      } else {
        out.push(`<span class="token-string">${str}</span>`)
      }
      i = end
    } else if (ch === '-' || (ch >= '0' && ch <= '9')) {
      let j = i
      if (raw[j] === '-') j++
      while (j < raw.length && ((raw[j] >= '0' && raw[j] <= '9') || raw[j] === '.' || raw[j] === 'e' || raw[j] === 'E' || raw[j] === '+' || raw[j] === '-') && !(raw[j] === '-' && j > i + 1 && raw[j-1] !== 'e' && raw[j-1] !== 'E')) j++
      out.push(`<span class="token-number">${raw.slice(i, j)}</span>`)
      i = j
    } else if (raw.startsWith('true', i)) {
      out.push(`<span class="token-bool">true</span>`)
      i += 4
    } else if (raw.startsWith('false', i)) {
      out.push(`<span class="token-bool">false</span>`)
      i += 5
    } else if (raw.startsWith('null', i)) {
      out.push(`<span class="token-null">null</span>`)
      i += 4
    } else if (ch === '{' || ch === '}' || ch === '[' || ch === ']') {
      out.push(`<span class="token-bracket">${ch}</span>`)
      i++
    } else if (ch === ',') {
      out.push(`<span class="token-comma">,</span>`)
      i++
    } else {
      out.push(ch)
      i++
    }
  }
  return out.join('')
}

function highlightSql(sql: string): string {
  const tokens: string[] = []
  let i = 0
  while (i < sql.length) {
    if (sql[i] === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i)
      const slice = end === -1 ? sql.slice(i) : sql.slice(i, end)
      tokens.push(`<span class="sql-comment">${escapeHtml(slice)}</span>`)
      i += slice.length
      continue
    }
    if (sql[i] === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2)
      const slice = end === -1 ? sql.slice(i) : sql.slice(i, end + 2)
      tokens.push(`<span class="sql-comment">${escapeHtml(slice)}</span>`)
      i += slice.length
      continue
    }
    if (sql[i] === "'") {
      let j = i + 1
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue }
        if (sql[j] === "'") { j++; break }
        j++
      }
      tokens.push(`<span class="sql-string">${escapeHtml(sql.slice(i, j))}</span>`)
      i = j
      continue
    }
    if (/\d/.test(sql[i]) && (i === 0 || /[\s,()=<>+\-*/\n]/.test(sql[i - 1]))) {
      let j = i
      while (j < sql.length && /[\d.]/.test(sql[j])) j++
      tokens.push(`<span class="sql-number">${sql.slice(i, j)}</span>`)
      i = j
      continue
    }
    if (/[a-zA-Z_]/.test(sql[i])) {
      let j = i
      while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) j++
      const word = sql.slice(i, j)
      const upper = word.toUpperCase()
      if (SQL_KEYWORDS.has(upper)) {
        tokens.push(`<span class="sql-keyword">${escapeHtml(word)}</span>`)
      } else if (SQL_FUNCTIONS.has(upper)) {
        tokens.push(`<span class="sql-function">${escapeHtml(word)}</span>`)
      } else {
        tokens.push(escapeHtml(word))
      }
      i = j
      continue
    }
    tokens.push(escapeHtml(sql[i]))
    i++
  }
  return tokens.join('')
}

export function LogPrettifier({ onCopy }: Props) {
  const [input, setInput] = useState('')
  const [dialect, setDialect] = useState<Dialect>('sql')
  const [indentSize, setIndentSize] = useState(2)
  const [keywordCase, setKeywordCase] = useState<'upper' | 'lower' | 'capitalize'>('upper')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { formatted, rawQueries, error } = useMemo(() => {
    if (!input.trim()) return { formatted: '', rawQueries: [] as RawSqlQuery[], error: null }
    try {
      const parsed = tryParseLog(input)
      const cleaned = cleanObject(parsed)
      const pretty = JSON.stringify(cleaned, null, 2)
      const queries = extractSqlValues(parsed)
      return { formatted: pretty, rawQueries: queries, error: null }
    } catch (e) {
      return { formatted: '', rawQueries: [] as RawSqlQuery[], error: (e as Error).message }
    }
  }, [input])

  const formattedQueries = useMemo(() =>
    rawQueries.map(q => ({
      path: q.path,
      formatted: formatSqlQuery(q.raw, dialect, indentSize, keywordCase),
    })),
    [rawQueries, dialect, indentSize, keywordCase]
  )

  const handleCopy = useCallback(() => {
    if (formatted) {
      navigator.clipboard.writeText(formatted)
      onCopy('Copied JSON to clipboard')
    }
  }, [formatted, onCopy])

  const handleCopySql = useCallback((sql: string) => {
    navigator.clipboard.writeText(sql)
    onCopy('Copied SQL to clipboard')
  }, [onCopy])

  const handlePaste = useCallback(() => {
    navigator.clipboard.readText().then(text => setInput(text))
  }, [])

  const handleClear = useCallback(() => {
    setInput('')
    textareaRef.current?.focus()
  }, [])

  return (
    <>
      {error && <div className="error-banner">{error}</div>}
      <div className={`log-grid${formattedQueries.length > 0 ? ' log-grid--with-sql' : ''}`}>
        <div className="editor-area">
          <div className="editor-header">
            <div className="editor-title">
              <span className={`title-dot${input ? (error ? ' error' : ' active') : ''}`} />
              Log Input
            </div>
            <div className="editor-actions">
              <button className="btn btn-ghost" onClick={handlePaste}>Paste</button>
              <button className="btn btn-ghost" onClick={handleClear}>Clear</button>
            </div>
          </div>
          <div className="editor-body">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder='Paste your production log here...  {"level":"info","message":"..."}'
              spellCheck={false}
              autoFocus
            />
          </div>
        </div>

        <div className="editor-area">
          <div className="editor-header">
            <div className="editor-title">
              <span className={`title-dot${formatted ? ' active' : ''}`} />
              Formatted
              {formattedQueries.length > 0 && (
                <span className="log-sql-badge">{formattedQueries.length} SQL</span>
              )}
            </div>
            <div className="editor-actions">
              <button
                className={`btn ${formatted ? 'btn-primary' : 'btn-ghost'}`}
                onClick={handleCopy}
                disabled={!formatted}
              >
                Copy
              </button>
            </div>
          </div>
          <div className="editor-body">
            {formatted ? (
              <pre dangerouslySetInnerHTML={{ __html: highlightJson(formatted) }} />
            ) : (
              <div className="empty-state">
                <div className="empty-icon">&#x2261;</div>
                <p>Formatted log will appear here</p>
                <p>Paste a JSON log on the left</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {formattedQueries.length > 0 && (
        <div className="log-sql-section">
          <div className="log-sql-section-header">
            <div className="log-sql-section-title">
              Extracted SQL Queries
            </div>
            <div className="editor-actions">
              <select
                className="lang-select"
                value={dialect}
                onChange={e => setDialect(e.target.value as Dialect)}
                aria-label="SQL dialect"
              >
                {dialects.map(d => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
              <div className="lang-toggle">
                {[2, 4].map(n => (
                  <button
                    key={n}
                    className={indentSize === n ? 'active' : ''}
                    onClick={() => setIndentSize(n)}
                  >
                    {n}sp
                  </button>
                ))}
              </div>
              <div className="lang-toggle">
                <button className={keywordCase === 'upper' ? 'active' : ''} onClick={() => setKeywordCase('upper')}>ABC</button>
                <button className={keywordCase === 'capitalize' ? 'active' : ''} onClick={() => setKeywordCase('capitalize')}>Abc</button>
                <button className={keywordCase === 'lower' ? 'active' : ''} onClick={() => setKeywordCase('lower')}>abc</button>
              </div>
            </div>
          </div>
          {formattedQueries.map((q, i) => (
            <div key={i} className="log-sql-card">
              <div className="log-sql-card-header">
                <span className="log-sql-path">{q.path}</span>
                <button className="btn btn-ghost" onClick={() => handleCopySql(q.formatted)}>
                  Copy
                </button>
              </div>
              <pre
                className="log-sql-code"
                dangerouslySetInnerHTML={{ __html: highlightSql(q.formatted) }}
              />
            </div>
          ))}
        </div>
      )}
    </>
  )
}
