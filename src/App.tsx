import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./App.css";
import { JsonFormatter } from "./tools/JsonFormatter";
import { DiffTool } from "./tools/DiffTool";
import { JsonToClass } from "./tools/JsonToClass";
import { JwtDecoder } from "./tools/JwtDecoder";
import { Base64Tool } from "./tools/Base64Tool";
import { RegexTester } from "./tools/RegexTester";
import { SqlFormatter } from "./tools/SqlFormatter";
import { UuidGenerator } from "./tools/UuidGenerator";
import { LogPrettifier } from "./tools/LogPrettifier";
import { AdUnit } from "./components/AdUnit";

type Tool =
  | "formatter"
  | "diff"
  | "converter"
  | "jwt"
  | "base64"
  | "regex"
  | "sql"
  | "uuid"
  | "logs";

const toolsConfig: {
  id: Tool;
  icon: string;
  key: string;
  slug: string;
}[] = [
  { id: "logs", icon: "☰", key: "1", slug: "log-prettifier" },
  { id: "formatter", icon: "{ }", key: "2", slug: "json-formatter" },
  { id: "converter", icon: "⬡", key: "3", slug: "json-to-class" },
  { id: "sql", icon: "⊞", key: "4", slug: "sql-formatter" },
  { id: "diff", icon: "< >", key: "5", slug: "text-diff" },
  { id: "jwt", icon: "⚿", key: "6", slug: "jwt-decoder" },
  { id: "base64", icon: "⇌", key: "7", slug: "base64-encoder-decoder" },
  { id: "regex", icon: ".*", key: "8", slug: "regex-tester" },
  { id: "uuid", icon: "#", key: "9", slug: "uuid-generator" },
];

const SITE_ORIGIN = "https://www.multidev.tools";

function getToolFromSlug(pathname: string): Tool {
  const slug = pathname.replace(/^\//, "");
  if (!slug) return toolsConfig[0].id;
  const tool = toolsConfig.find((t) => t.slug === slug);
  return tool?.id ?? toolsConfig[0].id;
}

function updateMeta(
  toolId: string,
  toolSlug: string,
  toolTitle: string,
  toolDescription: string,
  lang: string
) {
  document.title = toolTitle;
  document.documentElement.lang = lang;

  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", toolDescription);

  const isRoot = window.location.pathname === "/" && toolId === toolsConfig[0].id;
  const canonicalUrl = isRoot ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}/${toolSlug}`;

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute("href", canonicalUrl);

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute("content", toolTitle);

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute("content", toolDescription);

  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute("content", canonicalUrl);

  const ogLocale = document.querySelector('meta[property="og:locale"]');
  if (ogLocale) ogLocale.setAttribute("content", lang === "es" ? "es_ES" : "en_US");
}

function App() {
  const { t, i18n } = useTranslation();

  const [activeTool, setActiveTool] = useState<Tool>(() =>
    getToolFromSlug(window.location.pathname),
  );
  const [toast, setToast] = useState<string | null>(null);

  const tools = toolsConfig.map((tool) => ({
    ...tool,
    label: t(`tools.${tool.id}.label`),
    title: t(`tools.${tool.id}.title`),
    description: t(`tools.${tool.id}.description`),
  }));

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const rackRef = useRef<HTMLElement>(null);

  const checkScroll = useCallback(() => {
    if (rackRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = rackRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth + 2) < scrollWidth);
    }
  }, []);

  useEffect(() => {
    checkScroll(); // Verificación inicial al montar
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [checkScroll]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }, []);

  const navigateToTool = useCallback((toolId: Tool) => {
    setActiveTool(toolId);
    const tool = tools.find((t) => t.id === toolId)!;
    window.history.pushState(null, "", `/${tool.slug}`);
  }, []);

  // Sync title, meta, and canonical with active tool — also fixes URL on initial load
  useEffect(() => {
    const tool = tools.find((t) => t.id === activeTool)!;
    updateMeta(tool.id, tool.slug, tool.title, tool.description, i18n.language);

    const isRootAndDefault =
      window.location.pathname === "/" && activeTool === toolsConfig[0].id;
    if (!isRootAndDefault && window.location.pathname !== `/${tool.slug}`) {
      window.history.replaceState(null, "", `/${tool.slug}`);
    }
  }, [activeTool, tools, i18n.language]);

  // Handle browser back / forward
  useEffect(() => {
    const onPopState = () =>
      setActiveTool(getToolFromSlug(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      )
        return;
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      const tool = tools.find((t) => t.key === e.key);
      if (tool) {
        e.preventDefault();
        navigateToTool(tool.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigateToTool]);

  const activeToolData = tools.find((t) => t.id === activeTool)!;

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-icon">
              <p
                style={{ fontSize: "large", cursor: "pointer" }}
                onClick={() => window.history.pushState(null, "", "/")}
              >
                ⚒️
              </p>
            </div>
          </div>

          <div className="tool-rack-container">
            {canScrollLeft && (
              <button
                className="scroll-btn scroll-btn-left"
                onClick={() => rackRef.current?.scrollBy({ left: -200, behavior: "smooth" })}
                aria-label="Scroll left"
              >
                ‹
              </button>
            )}

            <nav className="tool-rack" ref={rackRef} onScroll={checkScroll}>
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  className={`tool-tab${activeTool === tool.id ? " active" : ""}`}
                  onClick={() => navigateToTool(tool.id)}
                >
                  <span className="tab-icon">{tool.icon}</span>
                  {tool.label}
                  <span className="tab-key">{tool.key}</span>
                </button>
              ))}
            </nav>

            {canScrollRight && (
              <button
                className="scroll-btn scroll-btn-right"
                onClick={() => rackRef.current?.scrollBy({ left: 200, behavior: "smooth" })}
                aria-label="Scroll right"
              >
                ›
              </button>
            )}
          </div>

          <button 
            className="btn btn-ghost" 
            onClick={() => {
              const nextLang = i18n.language === "en" ? "es" : "en";
              i18n.changeLanguage(nextLang);
              localStorage.setItem("app_lang", nextLang);
            }} 
            style={{ marginLeft: "10px", minWidth: "40px" }} 
            title="Toggle Language"
          >
            {i18n.language === "en" ? "ES" : "EN"}
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <h1>{t("header.title")}</h1>
          <p>{t("header.description")}</p>
        </div>
      </section>

      <main className="main">
        <div className="tool-description">
          <h2>
            {activeToolData.icon} {activeToolData.label}
          </h2>
          <p>{activeToolData.description}</p>
        </div>

        <div className="tool-panel" key={activeTool}>
          {activeTool === "formatter" && <JsonFormatter onCopy={showToast} />}
          {activeTool === "diff" && <DiffTool onCopy={showToast} />}
          {activeTool === "converter" && <JsonToClass onCopy={showToast} />}
          {activeTool === "jwt" && <JwtDecoder onCopy={showToast} />}
          {activeTool === "base64" && <Base64Tool onCopy={showToast} />}
          {activeTool === "regex" && <RegexTester onCopy={showToast} />}
          {activeTool === "sql" && <SqlFormatter onCopy={showToast} />}
          {activeTool === "uuid" && <UuidGenerator onCopy={showToast} />}
          {activeTool === "logs" && <LogPrettifier onCopy={showToast} />}
        </div>

        <div className="ad-bottom">
          <AdUnit slot="bottomDesktop" format="horizontal" />
        </div>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-about">
            <h3>{t("footer.about_title")}</h3>
            <p>{t("footer.about_text")}</p>
          </div>
          <div className="footer-tools">
            <h3>{t("footer.tools_title")}</h3>
            <ul>
              {tools.map((tool) => (
                <li key={tool.id}>
                  <button onClick={() => navigateToTool(tool.id)}>
                    {tool.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="footer-bottom">
            <p>{t("footer.copyright").replace("{{year}}", new Date().getFullYear().toString())}</p>
          </div>
        </div>
      </footer>

      {toast && <div className="copied-toast">{toast}</div>}
    </div>
  );
}

export default App;
