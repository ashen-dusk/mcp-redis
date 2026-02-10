/**
 * @file MCP Docs App - Documentation search and feedback UI for mcp-ts library.
 */
import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import styles from "./mcp-app.module.css";

// Search result type
interface DocResult {
  title: string;
  description: string;
  link: string;
}

interface SearchResults {
  query: string;
  results: DocResult[];
  count: number;
}

interface ToolInput {
  arguments?: {
    query?: string;
    feedback?: string;
    category?: string;
  };
  toolName?: string;
}

function DocsApp() {
  const [activeTab, setActiveTab] = useState<"search" | "feedback">("search");
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const [initialInput, setInitialInput] = useState<ToolInput | null>(null);
  const isInitializedRef = useRef(false);

  const { app, error } = useApp({
    appInfo: { name: "mcp-ts Docs App", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.onteardown = async () => {
        console.info("App is being torn down");
        return {};
      };
      
      app.ontoolinput = async (input: ToolInput & { toolName?: string }) => {
        console.info("Received tool call input:", input);
        // Store initial input for auto-search when tool is called with arguments
        if (input?.arguments?.query || input?.arguments?.feedback) {
          setInitialInput(input);
        }
      };
      
      app.ontoolresult = async (result) => {
        console.info("Received tool call result:", result);
        setToolResult(result);
      };
      
      app.ontoolcancelled = (params) => {
        console.info("Tool call cancelled:", params.reason);
      };
      
      app.onerror = console.error;
      
      app.onhostcontextchanged = (params) => {
        setHostContext((prev) => {
          // Only update if actually changed to prevent infinite loops
          const newContext = { ...prev, ...params };
          if (JSON.stringify(prev) !== JSON.stringify(newContext)) {
            return newContext;
          }
          return prev;
        });
      };
    },
  });

  useEffect(() => {
    if (app && !isInitializedRef.current) {
      isInitializedRef.current = true;
      const context = app.getHostContext();
      setHostContext(context);
      console.info("App initialized with context:", context);
    }
  }, [app]);

  if (error) return <div><strong>ERROR:</strong> {error.message}</div>;
  if (!app) return <div>Connecting to mcp-ts Docs...</div>;

  return (
    <DocsAppInner 
      app={app} 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      toolResult={toolResult}
      initialInput={initialInput}
      hostContext={hostContext}
    />
  );
}

interface DocsAppInnerProps {
  app: App;
  activeTab: "search" | "feedback";
  setActiveTab: (tab: "search" | "feedback") => void;
  toolResult: CallToolResult | null;
  initialInput: ToolInput | null;
  hostContext?: McpUiHostContext;
}

function DocsAppInner({ app, activeTab, setActiveTab, toolResult, initialInput, hostContext }: DocsAppInnerProps) {
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const hasProcessedInputRef = useRef(false);

  // Feedback state
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState("general");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  // Handle initial tool input (when LLM or UI tool is called with arguments)
  useEffect(() => {
    if (initialInput && !hasProcessedInputRef.current) {
      hasProcessedInputRef.current = true;
      
      if (initialInput.arguments?.query) {
        // Auto-populate and search when tool provides a query
        setSearchQuery(initialInput.arguments.query);
        setActiveTab("search");
        // Trigger search automatically - use search-docs-ui for UI context
        setIsSearching(true);
        const toolName = initialInput.toolName?.includes("ui") ? "search-docs-ui" : "search-docs";
        app.callServerTool({ 
          name: toolName, 
          arguments: { query: initialInput.arguments.query } 
        }).catch((e: Error) => {
          console.error("Auto-search error:", e);
          setIsSearching(false);
        });
      } else if (initialInput.arguments?.feedback) {
        // Auto-populate feedback when LLM provides feedback
        setFeedbackText(initialInput.arguments.feedback);
        if (initialInput.arguments.category) {
          setFeedbackCategory(initialInput.arguments.category);
        }
        setActiveTab("feedback");
      }
    }
  }, [initialInput, app, setActiveTab]);

  // Parse tool results
  useEffect(() => {
    console.log("Tool result changed:", toolResult);
    if (toolResult) {
      const text = toolResult.content?.find((c) => c.type === "text")?.text;
      console.log("Tool result text:", text);
      if (text) {
        try {
          const data = JSON.parse(text);
          console.log("Parsed tool data:", data);
          if (data.results !== undefined) {
            setSearchResults(data);
            setIsSearching(false);
          } else if (data.success !== undefined) {
            setSubmitMessage(data.message);
            setIsSubmitting(false);
            if (data.success) {
              setFeedbackText("");
              setFeedbackCategory("general");
            }
          }
        } catch (e) {
          console.error("Failed to parse tool result:", e);
        }
      }
    }
  }, [toolResult]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || isSearching) return;
    
    setIsSearching(true);
    setSearchResults(null);
    
    try {
      console.info("Searching docs for:", searchQuery);
      // Use search-docs-ui when user searches via UI
      const result = await app.callServerTool({ 
        name: "search-docs-ui", 
        arguments: { query: searchQuery } 
      });
      console.log("Search result:", result);
      // Also manually process the result since ontoolresult might not fire for UI-initiated calls
      if (result && result.content) {
        const textContent = result.content.find((c) => c.type === "text");
        if (textContent && "text" in textContent) {
          try {
            const data = JSON.parse(textContent.text);
            if (data.results !== undefined) {
              setSearchResults(data);
              setIsSearching(false);
            }
          } catch (e) {
            console.error("Failed to parse search result:", e);
          }
        }
      }
    } catch (e) {
      console.error("Search error:", e);
      setIsSearching(false);
    }
  }, [app, searchQuery, isSearching]);

  const handleSubmitFeedback = useCallback(async () => {
    if (!feedbackText.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    setSubmitMessage(null);
    
    try {
      console.info("Submitting feedback...");
      const result = await app.callServerTool({ 
        name: "submit-feedback", 
        arguments: { 
          feedback: feedbackText,
          category: feedbackCategory
        } 
      });
      console.log("Feedback result:", result);
      // Also manually process the result
      if (result && result.content) {
        const textContent = result.content.find((c) => c.type === "text");
        if (textContent && "text" in textContent) {
          try {
            const data = JSON.parse(textContent.text);
            if (data.success !== undefined) {
              setSubmitMessage(data.message);
              setIsSubmitting(false);
              if (data.success) {
                setFeedbackText("");
                setFeedbackCategory("general");
              }
            }
          } catch (e) {
            console.error("Failed to parse feedback result:", e);
          }
        }
      }
    } catch (e) {
      console.error("Feedback submission error:", e);
      setIsSubmitting(false);
    }
  }, [app, feedbackText, feedbackCategory, isSubmitting]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <main
      className={styles.main}
      style={{
        paddingTop: hostContext?.safeAreaInsets?.top,
        paddingRight: hostContext?.safeAreaInsets?.right,
        paddingBottom: hostContext?.safeAreaInsets?.bottom,
        paddingLeft: hostContext?.safeAreaInsets?.left,
      }}
    >
      <header className={styles.header}>
        <img 
          src="https://raw.githubusercontent.com/zonlabs/mcp-ts/main/docs/static/img/mcp-ts-banner.svg" 
          alt="mcp-ts" 
          className={styles.banner}
          style={{ width: '100%', maxWidth: '600px', marginBottom: '1rem' }}
        />
        <h1 className={styles.title}>mcp-ts Documentation</h1>
        <p className={styles.subtitle}>Search guides, API docs, and examples</p>
        <div className={styles.badgeContainer}>
          <a href="https://www.npmjs.com/package/@mcp-ts/sdk" target="_blank" rel="noopener noreferrer">
            <img src="https://img.shields.io/npm/v/@mcp-ts/sdk.svg?style=flat&color=3178c6" alt="npm version" />
          </a>
          <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer">
            <img src="https://img.shields.io/badge/License-MIT-green.svg?style=flat" alt="MIT License" />
          </a>
          <a href="https://zonlabs.github.io/mcp-ts/" target="_blank" rel="noopener noreferrer">
            <img src="https://img.shields.io/badge/docs-website-brightgreen.svg?style=flat&color=ffc107" alt="Documentation" />
          </a>
        </div>
      </header>

      <nav className={styles.tabNav}>
        <button
          className={`${styles.tabButton} ${activeTab === "search" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("search")}
        >
          <svg className={styles.tabIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          Search Docs
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === "feedback" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("feedback")}
        >
          <svg className={styles.tabIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Submit Feedback
        </button>
      </nav>

      {activeTab === "search" && (
        <section className={styles.section}>
          <div className={styles.searchBox}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search for topics like 'React hooks', 'storage', 'OAuth'..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyPress}
            />
            <button 
              className={styles.searchButton}
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
            >
              {isSearching ? "Searching..." : "Search"}
            </button>
          </div>

          {searchResults && (
            <div className={styles.resultsContainer}>
              <p className={styles.resultsInfo}>
                Found {searchResults.count} result{searchResults.count !== 1 ? "s" : ""} for &quot;{searchResults.query}&quot;
              </p>
              
              {searchResults.results.length > 0 ? (
                <ul className={styles.resultsList}>
                  {searchResults.results.map((result, index) => (
                    <li key={index} className={styles.resultItem}>
                      <h3 className={styles.resultTitle}>{result.title}</h3>
                      <p className={styles.resultDescription}>{result.description}</p>
                      <a 
                        href={result.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={styles.resultLink}
                      >
                        View Documentation →
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={styles.noResults}>
                  <p>No results found. Try searching for:</p>
                  <ul className={styles.suggestions}>
                    <li>&quot;installation&quot; - Setup instructions</li>
                    <li>&quot;react&quot; - React integration</li>
                    <li>&quot;storage&quot; - Storage backends</li>
                    <li>&quot;adapters&quot; - Framework adapters</li>
                    <li>&quot;api&quot; - API reference</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {activeTab === "feedback" && (
        <section className={styles.section}>
          <div className={styles.feedbackIntro}>
            <p>Help us improve mcp-ts! Your feedback is valuable for making the library better.</p>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="category">Category (optional)</label>
            <select
              id="category"
              className={styles.select}
              value={feedbackCategory}
              onChange={(e) => setFeedbackCategory(e.target.value)}
            >
              <option value="general">General Feedback</option>
              <option value="bug">Bug Report</option>
              <option value="feature-request">Feature Request</option>
              <option value="documentation">Documentation Issue</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="feedback">Your Feedback</label>
            <textarea
              id="feedback"
              className={styles.textarea}
              placeholder="Describe your experience, issues, or suggestions..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={5}
            />
          </div>

          <button
            className={styles.submitButton}
            onClick={handleSubmitFeedback}
            disabled={isSubmitting || !feedbackText.trim()}
          >
            {isSubmitting ? "Submitting..." : "Submit Feedback"}
          </button>

          {submitMessage && (
            <div className={styles.successMessage}>
              {submitMessage}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DocsApp />
  </StrictMode>,
);
