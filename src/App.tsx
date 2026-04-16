import { useState, useEffect, useCallback } from 'react'
import './App.css'
import { JsonFormatter } from './tools/JsonFormatter'
import { DiffTool } from './tools/DiffTool'
import { JsonToClass } from './tools/JsonToClass'
import { JwtDecoder } from './tools/JwtDecoder'
import { Base64Tool } from './tools/Base64Tool'
import { RegexTester } from './tools/RegexTester'
import { SqlFormatter } from './tools/SqlFormatter'
import { UuidGenerator } from './tools/UuidGenerator'
import { LogPrettifier } from './tools/LogPrettifier'
import { AdUnit } from './components/AdUnit'

type Tool = 'formatter' | 'diff' | 'converter' | 'jwt' | 'base64' | 'regex' | 'sql' | 'uuid' | 'logs'

const tools: { id: Tool; label: string; icon: string; key: string; slug: string; title: string; description: string }[] = [
  { id: 'formatter', label: 'JSON Format', icon: '{ }', key: '1', slug: 'json-formatter', title: 'Online JSON Formatter & Validator | DevForge', description: 'Parse, pretty-print with 2 or 4 space indentation, and minify JSON. Includes syntax highlighting for keys, strings, numbers, and booleans.' },
  { id: 'diff', label: 'Diff', icon: '< >', key: '2', slug: 'text-diff', title: 'Online Text Diff Checker | DevForge', description: 'Compare two texts side by side. See additions, deletions, and unchanged lines with a clear color-coded diff output.' },
  { id: 'converter', label: 'JSON → Class', icon: '⬡', key: '3', slug: 'json-to-class', title: 'JSON to TypeScript & Python Class Converter | DevForge', description: 'Convert JSON objects into TypeScript interfaces or Python dataclasses. Automatically infers types including nested objects and arrays.' },
  { id: 'jwt', label: 'JWT Decode', icon: '⚿', key: '4', slug: 'jwt-decoder', title: 'Online JWT Token Decoder | DevForge', description: 'Decode JSON Web Tokens to inspect the header, payload, and signature. Check expiration status at a glance.' },
  { id: 'base64', label: 'Base64', icon: '⇌', key: '5', slug: 'base64-encoder-decoder', title: 'Online Base64 Encoder & Decoder | DevForge', description: 'Encode text to Base64 or decode Base64 strings back to plain text. Supports automatic image preview for Base64-encoded images.' },
  { id: 'regex', label: 'Regex', icon: '.*', key: '6', slug: 'regex-tester', title: 'Online Regex Tester & Debugger | DevForge', description: 'Write and test regular expressions with real-time highlighting of matches. View capture groups and toggle flags like global, case-insensitive, and multiline.' },
  { id: 'sql', label: 'SQL Format', icon: '⊞', key: '7', slug: 'sql-formatter', title: 'Online SQL Formatter & Beautifier | DevForge', description: 'Format and beautify raw SQL queries. Adds proper indentation and keyword highlighting for better readability.' },
  { id: 'uuid', label: 'UUID', icon: '#', key: '8', slug: 'uuid-generator', title: 'Online UUID v4 Generator | DevForge', description: 'Generate random v4 UUIDs in bulk. Click any UUID to copy it to your clipboard instantly.' },
  { id: 'logs', label: 'Log Pretty', icon: '☰', key: '9', slug: 'log-prettifier', title: 'Online JSON Log Prettifier | DevForge', description: 'Format and prettify production JSON logs. Automatically detects and extracts SQL queries embedded in log values, formatting them for easy reading and execution.' },
]

const SITE_ORIGIN = 'https://multidev.tools'

function getToolFromSlug(pathname: string): Tool {
  const slug = pathname.replace(/^\//, '')
  if (!slug) return 'formatter'
  const tool = tools.find(t => t.slug === slug)
  return tool?.id ?? 'formatter'
}

function updateMeta(tool: typeof tools[number]) {
  document.title = tool.title

  const meta = document.querySelector('meta[name="description"]')
  if (meta) meta.setAttribute('content', tool.description)

  const canonical = document.querySelector('link[rel="canonical"]')
  if (canonical) canonical.setAttribute('href', `${SITE_ORIGIN}/${tool.slug}`)

  const ogTitle = document.querySelector('meta[property="og:title"]')
  if (ogTitle) ogTitle.setAttribute('content', tool.title)

  const ogDesc = document.querySelector('meta[property="og:description"]')
  if (ogDesc) ogDesc.setAttribute('content', tool.description)

  const ogUrl = document.querySelector('meta[property="og:url"]')
  if (ogUrl) ogUrl.setAttribute('content', `${SITE_ORIGIN}/${tool.slug}`)
}

function App() {
  const [activeTool, setActiveTool] = useState<Tool>(() => getToolFromSlug(window.location.pathname))
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1500)
  }, [])

  const navigateToTool = useCallback((toolId: Tool) => {
    setActiveTool(toolId)
    const tool = tools.find(t => t.id === toolId)!
    window.history.pushState(null, '', `/${tool.slug}`)
  }, [])

  // Sync title, meta, and canonical with active tool — also fixes URL on initial load
  useEffect(() => {
    const tool = tools.find(t => t.id === activeTool)!
    updateMeta(tool)
    if (window.location.pathname !== `/${tool.slug}`) {
      window.history.replaceState(null, '', `/${tool.slug}`)
    }
  }, [activeTool])

  // Handle browser back / forward
  useEffect(() => {
    const onPopState = () => setActiveTool(getToolFromSlug(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
      if (e.altKey || e.metaKey || e.ctrlKey) return
      const tool = tools.find(t => t.key === e.key)
      if (tool) {
        e.preventDefault()
        navigateToTool(tool.id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigateToTool])

  const activeToolData = tools.find(t => t.id === activeTool)!

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-icon">⚒</div>
            <div className="logo-text">
              Dev<span>Forge</span>
            </div>
          </div>

          <nav className="tool-rack">
            {tools.map(tool => (
              <button
                key={tool.id}
                className={`tool-tab${activeTool === tool.id ? ' active' : ''}`}
                onClick={() => navigateToTool(tool.id)}
              >
                <span className="tab-icon">{tool.icon}</span>
                {tool.label}
                <span className="tab-key">{tool.key}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <h1>Free Online Developer Tools</h1>
          <p>
            DevForge is a free, open collection of browser-based tools for developers.
            Format JSON, compare text diffs, decode JWTs, encode Base64, test regex patterns,
            format SQL queries, generate UUIDs, and prettify production logs — all without sending data to any server.
            Your data stays in your browser, always.
          </p>
        </div>
      </section>

      <main className="main">
        <div className="tool-description">
          <h2>{activeToolData.icon} {activeToolData.label}</h2>
          <p>{activeToolData.description}</p>
        </div>

        <div className="tool-panel" key={activeTool}>
          {activeTool === 'formatter' && <JsonFormatter onCopy={showToast} />}
          {activeTool === 'diff' && <DiffTool onCopy={showToast} />}
          {activeTool === 'converter' && <JsonToClass onCopy={showToast} />}
          {activeTool === 'jwt' && <JwtDecoder onCopy={showToast} />}
          {activeTool === 'base64' && <Base64Tool onCopy={showToast} />}
          {activeTool === 'regex' && <RegexTester onCopy={showToast} />}
          {activeTool === 'sql' && <SqlFormatter onCopy={showToast} />}
          {activeTool === 'uuid' && <UuidGenerator onCopy={showToast} />}
          {activeTool === 'logs' && <LogPrettifier onCopy={showToast} />}
        </div>

        <div className="ad-bottom">
          <AdUnit slot="bottomDesktop" format="horizontal" />
        </div>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-about">
            <h3>About DevForge</h3>
            <p>
              DevForge provides essential developer utilities that run entirely in your browser.
              No sign-up required, no data collection, no server-side processing. Built for developers
              who value speed, privacy, and simplicity in their daily workflow.
            </p>
          </div>
          <div className="footer-tools">
            <h3>Tools</h3>
            <ul>
              {tools.map(tool => (
                <li key={tool.id}>
                  <button onClick={() => navigateToTool(tool.id)}>
                    {tool.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} DevForge. All tools run client-side — your data never leaves your browser.</p>
          </div>
        </div>
      </footer>

      {toast && <div className="copied-toast">{toast}</div>}
    </div>
  )
}

export default App
