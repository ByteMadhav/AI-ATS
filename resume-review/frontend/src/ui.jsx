import React, { useCallback, useRef, useState } from "react";
import {
  Search,
  Bell,
  Settings,
  UploadCloud,
  FileText,
  X,
  Loader2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";

// ---------------------------------------------------------------------
// Dark "ops dashboard" styling, matching the reference layout: pill top
// nav, orange eyebrow labels, stat tiles, and a two-panel dashboard body.
// ---------------------------------------------------------------------

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const extractScore = (text) => {
  if (!text) return null;
  const outOf100 = text.match(/(\d{1,3})\s*(?:\/|out of)\s*100/i);
  if (outOf100) return Math.min(100, parseInt(outOf100[1], 10));
  const scoreWord = text.match(/score[^0-9]{0,10}(\d{1,3})/i);
  if (scoreWord) return Math.min(100, parseInt(scoreWord[1], 10));
  return null;
};

const timeNow = () =>
  new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short" });

function StatTile({ label, value, sub }) {
  return (
    <div className="flex-1 min-w-[150px] bg-[#15130F] border border-white/[0.06] rounded-xl px-5 py-4">
      <p className="text-[10px] tracking-[0.18em] text-[#D97B4F] font-medium mb-2">
        {label}
      </p>
      <p className="text-white text-2xl font-semibold leading-none">{value}</p>
      <p className="text-[#8B8478] text-xs mt-2">{sub}</p>
    </div>
  );
}

function Logomark() {
  return (
    <div className="grid grid-cols-2 gap-[3px] w-5 h-5 shrink-0">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-[#E8834D] rounded-[2px]" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// Minimal markdown renderer for the examiner's notes: the ATS model
// returns headings, bold text, tables and lists as markdown, and we
// render that into styled blocks instead of dumping raw ### / | / **
// syntax on the page.
// ---------------------------------------------------------------------

function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter((p) => p !== "");
  return parts.map((part, idx) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={`${keyPrefix}-${idx}`} className="text-white font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (/^`[^`]+`$/.test(part)) {
      return (
        <code
          key={`${keyPrefix}-${idx}`}
          className="text-[#E8834D] bg-white/[0.06] px-1 py-0.5 rounded text-[12px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={`${keyPrefix}-${idx}`}>{part}</React.Fragment>;
  });
}

function splitTableRow(line) {
  let cells = line.trim().split("|");
  if (cells[0].trim() === "") cells = cells.slice(1);
  if (cells.length && cells[cells.length - 1].trim() === "") cells = cells.slice(0, -1);
  return cells.map((c) => c.trim());
}

function parseMarkdownBlocks(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (line.trim().startsWith("|")) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const header = splitTableRow(tableLines[0]);
      const isSeparator =
        tableLines[1] && /^[\s|:-]+$/.test(tableLines[1]) && tableLines[1].includes("-");
      const bodyLines = tableLines.slice(isSeparator ? 2 : 1);
      const rows = bodyLines.map(splitTableRow);
      blocks.push({ type: "table", header, rows });
      continue;
    }

    if (/^(-{3,}|\*{3,})\s*$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[1].length, text: headingMatch[2] });
      i++;
      continue;
    }

    if (line.trim().startsWith(">")) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", text: quoteLines.join(" ") });
      continue;
    }

    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (
        i < lines.length &&
        (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))
      ) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("|") &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^(-{3,}|\*{3,})\s*$/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith(">") &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", text: paraLines.join(" ") });
  }

  return blocks;
}

const HEADING_STYLES = {
  1: "text-[15px] font-semibold text-white mt-5 mb-2 pb-1 border-b border-white/10",
  2: "text-[15px] font-semibold text-white mt-5 mb-2 pb-1 border-b border-white/10",
  3: "text-[13px] font-semibold text-[#E8834D] uppercase tracking-wide mt-5 mb-2",
  4: "text-xs font-semibold text-[#8B8478] uppercase tracking-wide mt-4 mb-1",
  5: "text-xs font-semibold text-[#8B8478] uppercase tracking-wide mt-4 mb-1",
  6: "text-xs font-semibold text-[#8B8478] uppercase tracking-wide mt-4 mb-1",
};

function MarkdownReport({ text }) {
  const blocks = parseMarkdownBlocks(text || "");

  return (
    <div>
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return (
            <p key={i} className={HEADING_STYLES[block.level] || HEADING_STYLES[3]}>
              {renderInline(block.text, `h${i}`)}
            </p>
          );
        }
        if (block.type === "hr") {
          return <div key={i} className="my-4 border-t border-white/10" />;
        }
        if (block.type === "quote") {
          return (
            <blockquote
              key={i}
              className="border-l-2 border-[#E8834D] pl-3 py-1 my-3 text-sm text-[#D8D2C4] italic bg-white/[0.02] rounded-r"
            >
              {renderInline(block.text, `q${i}`)}
            </blockquote>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className="space-y-1.5 my-2">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2 text-sm text-[#D8D2C4] leading-relaxed">
                  <span className="text-[#E8834D] shrink-0">•</span>
                  <span>{renderInline(item, `li${i}-${j}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "table") {
          return (
            <div key={i} className="my-3 overflow-x-auto rounded-lg border border-white/[0.08]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.04] border-b border-white/[0.08]">
                    {block.header.map((cell, ci) => (
                      <th
                        key={ci}
                        className="text-[10px] tracking-wide text-[#D97B4F] uppercase font-semibold py-2 px-3 whitespace-nowrap"
                      >
                        {renderInline(cell, `th${i}-${ci}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-white/[0.05] last:border-b-0">
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className={`py-2 px-3 text-[13px] align-top ${
                            ci === 0 ? "text-white font-medium" : "text-[#D8D2C4]"
                          }`}
                        >
                          {renderInline(cell, `td${i}-${ri}-${ci}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <p key={i} className="text-sm text-[#D8D2C4] leading-relaxed my-2">
            {renderInline(block.text, `p${i}`)}
          </p>
        );
      })}
    </div>
  );
}

export default function ResumeDashboard() {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | analyzing | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]); // {name, score, time}
  const [showEndpoint, setShowEndpoint] = useState(false);
  const [endpoint, setEndpoint] = useState(
    "http://localhost:8000/api/analyze"
  );
  const inputRef = useRef(null);

  const acceptFile = useCallback((candidate) => {
    if (!candidate) return;
    if (candidate.type !== "application/pdf") {
      setStatus("error");
      setErrorMsg("Only PDF files are accepted for review.");
      return;
    }
    setStatus("idle");
    setErrorMsg("");
    setResult(null);
    setFile(candidate);
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      acceptFile(e.dataTransfer.files?.[0]);
    },
    [acceptFile]
  );

  const submit = async () => {
    if (!file) return;
    setStatus("analyzing");
    setErrorMsg("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || `Review endpoint returned ${res.status}`);
      }
      const score = extractScore(data.result);
      setResult(data.result);
      setStatus("done");
      setHistory((h) => [
        { name: file.name, score, time: timeNow() },
        ...h,
      ].slice(0, 8));
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err.message === "Failed to fetch"
          ? "Could not reach the review endpoint. Is server.py running (uvicorn server:app --port 8000)?"
          : err.message
      );
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setStatus("idle");
    setErrorMsg("");
  };

  const score = extractScore(result);
  const avgScore = history.length
    ? Math.round(
        history.filter((h) => h.score != null).reduce((a, b) => a + b.score, 0) /
          (history.filter((h) => h.score != null).length || 1)
      )
    : "—";

  return (
    <div
      className="min-h-screen w-full py-8 px-5 flex flex-col items-center"
      style={{
        background:
          "radial-gradient(circle at 20% 0%, #FF8B28 0%, #C2610F 28%, #2A1305 62%, #0D0704 100%)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>

      <div className="w-full max-w-5xl">
        {/* Top nav */}
        <div className="flex items-center gap-4 bg-[#121009]/90 border border-white/[0.06] rounded-2xl px-4 py-2.5 mb-6">
          <div className="flex items-center gap-2 pr-4 mr-2 border-r border-white/[0.08]">
            <Logomark />
            <span className="text-white text-sm font-semibold">Resume Grid</span>
          </div>
          <nav className="hidden sm:flex items-center gap-5 text-[13px] text-[#8B8478] mr-auto">
            <span className="text-white relative pb-3 -mb-3">
              Review
              <span className="absolute left-0 right-0 -bottom-[1px] h-[2px] bg-[#E8834D] rounded-full" />
            </span>
            <span className="hover:text-white cursor-default">History</span>
            <span className="hover:text-white cursor-default">Insights</span>
          </nav>
          <div className="flex-1 max-w-xs hidden md:flex items-center gap-2 bg-[#1A1712] border border-white/[0.06] rounded-lg px-3 py-1.5">
            <Search size={13} className="text-[#6E6659]" />
            <span className="text-[#6E6659] text-xs">Search reviews, files…</span>
          </div>
          <div className="flex items-center gap-3 pl-2">
            <Bell size={15} className="text-[#8B8478]" />
            <Settings size={15} className="text-[#8B8478]" />
            <div className="w-6 h-6 rounded-full bg-[#E8834D] text-[10px] flex items-center justify-center text-[#1A1712] font-semibold">
              R
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="bg-[#121009]/70 border border-white/[0.06] rounded-2xl px-6 py-5 mb-4">
          <p className="text-[10px] tracking-[0.18em] text-[#D97B4F] font-medium mb-2">
            REVIEW DESK
          </p>
          <h1 className="text-white text-2xl font-semibold">
            Resume compliance review.
          </h1>
          <p className="text-[#8B8478] text-sm mt-1">
            Upload a PDF resume and score it against applicant-tracking
            criteria.
          </p>
        </div>

        {/* Stat tiles */}
        <div className="flex flex-wrap gap-4 mb-4">
          <StatTile
            label="REVIEWS THIS SESSION"
            value={history.length}
            sub="Resumes scored so far"
          />
          <StatTile
            label="AVERAGE SCORE"
            value={avgScore}
            sub="Across this session"
          />
          <StatTile
            label="QUEUED"
            value={file ? 1 : 0}
            sub={file ? file.name : "No file waiting"}
          />
          <StatTile
            label="ENDPOINT"
            value={status === "error" ? "OFFLINE" : "READY"}
            sub={endpoint.replace(/^https?:\/\//, "")}
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
          {/* Left: review desk */}
          <div
            className={`bg-[#121009]/70 border border-[#D97B4F]/25 rounded-2xl p-6 ${
              status === "done" ? "lg:col-span-2" : ""
            }`}
          >
            <p className="text-[10px] tracking-[0.18em] text-[#D97B4F] font-medium mb-4">
              REVIEW DESK
            </p>

            {status !== "done" && (
              <>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`cursor-pointer rounded-xl border-2 border-dashed transition-colors px-6 py-10 text-center ${
                    isDragging
                      ? "border-[#E8834D] bg-[#E8834D]/[0.06]"
                      : "border-white/[0.12] hover:border-[#E8834D]/60"
                  }`}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => acceptFile(e.target.files?.[0])}
                  />
                  <UploadCloud
                    className="mx-auto mb-3 text-[#E8834D]"
                    size={26}
                    strokeWidth={1.5}
                  />
                  <p className="text-white text-sm font-medium">
                    Drop resume here, or click to browse
                  </p>
                  <p className="text-[#6E6659] text-xs mt-1">
                    PDF only · Max 10MB
                  </p>
                </div>

                {file && (
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#1A1712] px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText size={16} className="text-[#E8834D] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{file.name}</p>
                        <p className="text-[11px] text-[#6E6659]">
                          {formatBytes(file.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        reset();
                      }}
                      className="text-[#6E6659] hover:text-white shrink-0"
                      aria-label="Remove file"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}

                <div className="mt-4">
                  <button
                    onClick={() => setShowEndpoint((s) => !s)}
                    className="flex items-center gap-1 text-[11px] text-[#6E6659] hover:text-white"
                  >
                    <ChevronDown
                      size={11}
                      className={`transition-transform ${showEndpoint ? "rotate-180" : ""}`}
                    />
                    Review endpoint
                  </button>
                  {showEndpoint && (
                    <input
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      className="mt-2 w-full text-xs border border-white/[0.08] rounded-lg px-3 py-2 bg-[#1A1712] text-white focus:outline-none focus:border-[#E8834D]"
                    />
                  )}
                </div>

                {status === "error" && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#C9573F]/40 bg-[#C9573F]/10 px-4 py-3">
                    <AlertCircle size={15} className="text-[#E8834D] mt-0.5 shrink-0" />
                    <p className="text-xs text-[#F0B49B]">{errorMsg}</p>
                  </div>
                )}

                <button
                  onClick={submit}
                  disabled={!file || status === "analyzing"}
                  className="mt-5 w-full py-3 rounded-xl bg-[#E8834D] text-[#1A1712] text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#F0954E] transition-colors"
                >
                  {status === "analyzing" ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Under review…
                    </>
                  ) : (
                    "Submit for review"
                  )}
                </button>
              </>
            )}

            {status === "done" && (
              <div>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-16 h-16 rounded-full border-4 border-[#E8834D] flex items-center justify-center shrink-0">
                    <span className="text-white text-xl font-semibold">
                      {score != null ? score : "—"}
                    </span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium truncate max-w-[280px]">
                      {file?.name}
                    </p>
                    <p className="text-[#8B8478] text-xs mt-0.5">
                      Score out of 100
                    </p>
                  </div>
                </div>
                <div className="border-t border-white/[0.08] pt-4">
                  <p className="text-[10px] tracking-[0.18em] text-[#D97B4F] font-medium mb-2">
                    EXAMINER'S NOTES
                  </p>
                  <MarkdownReport text={result} />
                </div>
                <button
                  onClick={reset}
                  className="mt-5 w-full py-3 rounded-xl border border-white/[0.12] text-white text-sm font-medium hover:bg-white/[0.05] transition-colors"
                >
                  Submit another resume
                </button>
              </div>
            )}
          </div>

          {/* Right: latest signals */}
          <div
            className={`bg-[#121009]/70 border border-white/[0.06] rounded-2xl p-6 ${
              status === "done" ? "lg:col-span-2" : ""
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] tracking-[0.18em] text-[#D97B4F] font-medium">
                LATEST SIGNALS
              </p>
              <span className="text-[11px] text-[#6E6659]">
                {history.length} total
              </span>
            </div>

            {history.length === 0 ? (
              <p className="text-[#6E6659] text-sm py-8 text-center">
                Reviewed resumes will show up here.
              </p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <span className="text-[11px] text-[#6E6659] w-10 shrink-0">
                      {h.time}
                    </span>
                    <span className="text-[10px] font-semibold text-[#E8834D] bg-[#E8834D]/10 rounded px-1.5 py-0.5 shrink-0">
                      PDF
                    </span>
                    <span className="text-sm text-[#D8D2C4] truncate flex-1">
                      {h.name}
                    </span>
                    <span className="text-sm text-white font-medium shrink-0">
                      {h.score != null ? `${h.score}/100` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}