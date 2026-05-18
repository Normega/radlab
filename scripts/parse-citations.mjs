#!/usr/bin/env node
// scripts/parse-citations.js
// Usage:
//   node scripts/parse-citations.js                  (interactive prompt)
//   node scripts/parse-citations.js --file refs.txt  (read citations from a file)
//   cat refs.txt | node scripts/parse-citations.js   (pipe citations in)
//
// Requires ANTHROPIC_API_KEY in .env or environment.
// Reads and writes src/data/publications.json.

import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.join(ROOT, "src", "data", "publications.json");

// Load .env manually (no dotenv dependency needed)
const envPath = path.join(ROOT, ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  });
}

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY not found in .env or environment.");
  process.exit(1);
}

const SYSTEM = `You are a bibliographic metadata extractor. Parse academic citations into structured JSON.
Given one or more citations in any format, return a JSON array where each element has:
- title: full paper title (string)
- authors: array of {family: string, given: string}
- year: publication year (integer)
- journal: journal or book title (string, empty string if unknown)
- doi: DOI string WITHOUT https://doi.org/ prefix (empty string if not present)
Rules:
- "Farb NAS" becomes {family:"Farb", given:"N. A. S."}
- "Wu LC" becomes {family:"Wu", given:"L. C."}
- Extract DOI from URLs like https://doi.org/10.xxxx/yyyy as "10.xxxx/yyyy"
- Return ONLY the JSON array. No markdown, no backticks, no explanation.`;

function normDOI(d) {
  return (d || "").toLowerCase().replace(/^https?:\/\/doi\.org\//i, "").trim();
}

function toInitials(given) {
  if (!given) return "";
  return given.replace(/\./g, "").trim().split(/[\s-]+/).filter(Boolean)
    .map(p => p[0].toUpperCase() + ".").join(" ");
}

function buildEntry(p) {
  const doi = normDOI(p.doi || "");
  const authorList = (p.authors || []).map(a => {
    const giv = a.given ? toInitials(a.given) : "";
    return giv ? `${a.family}, ${giv}` : (a.family || "");
  }).filter(Boolean);

  let auth = "Unknown";
  if (authorList.length === 1) auth = authorList[0];
  else if (authorList.length === 2) auth = `${authorList[0]}, & ${authorList[1]}`;
  else if (authorList.length > 2) auth = authorList.slice(0, -1).join(", ") + ", & " + authorList[authorList.length - 1];

  const doiUrl = doi ? `https://doi.org/${doi}` : "";
  const parts = [`${auth} (${p.year || "n.d."}).`, `${p.title || "Untitled"}.`];
  if (p.journal) parts.push(`${p.journal}.`);
  if (doiUrl) parts.push(doiUrl);
  const apa = parts.join(" ");

  const id = doi
    ? "pub_" + doi.replace(/[^a-z0-9]/g, "_")
    : "pub_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);

  return { id, year: p.year || null, authorList, title: p.title || "Untitled", journal: p.journal || "", doi, apa, annotation: "" };
}

function loadLibrary() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch (e) { console.error("Could not parse existing publications.json:", e.message); return []; }
}

function saveLibrary(lib) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(lib, null, 2) + "\n", "utf8");
}

async function parseCitations(text) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: "user", content: text }]
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  const textBlock = data.content?.find(b => b.type === "text");
  if (!textBlock) throw new Error("No text in API response");
  const cleaned = textBlock.text.replace(/```(?:json)?|```/g, "").trim();
  return JSON.parse(cleaned);
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

async function getCitationText() {
  // --file flag
  const fileIdx = process.argv.indexOf("--file");
  if (fileIdx !== -1 && process.argv[fileIdx + 1]) {
    const filePath = path.resolve(process.argv[fileIdx + 1]);
    if (!fs.existsSync(filePath)) { console.error("File not found:", filePath); process.exit(1); }
    return fs.readFileSync(filePath, "utf8");
  }
  // piped stdin
  if (!process.stdin.isTTY) {
    return new Promise(resolve => {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", chunk => { data += chunk; });
      process.stdin.on("end", () => resolve(data));
    });
  }
  // interactive
  console.log("Paste citations (any format). Enter a blank line followed by END to finish:\n");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    const lines = [];
    rl.on("line", line => {
      if (line.trim() === "END") { rl.close(); resolve(lines.join("\n")); }
      else lines.push(line);
    });
  });
}

async function main() {
  const library = loadLibrary();
  console.log(`Loaded ${library.length} existing publication${library.length !== 1 ? "s" : ""} from ${DATA_FILE}\n`);

  const citationText = await getCitationText();
  if (!citationText.trim()) { console.log("No input provided. Exiting."); process.exit(0); }

  console.log("Parsing citations...");
  let parsed;
  try { parsed = await parseCitations(citationText); }
  catch (e) { console.error("Parse error:", e.message); process.exit(1); }

  if (!Array.isArray(parsed) || !parsed.length) { console.log("No citations parsed."); process.exit(0); }

  const existingDOIs = new Set(library.map(e => normDOI(e.doi)));
  const newEntries = [];
  const dupes = [];

  parsed.forEach(p => {
    const entry = buildEntry(p);
    if (entry.doi && existingDOIs.has(normDOI(entry.doi))) dupes.push(entry);
    else newEntries.push(entry);
  });

  console.log(`\nParsed ${parsed.length} citation${parsed.length !== 1 ? "s" : ""}:`);
  console.log(`  ${newEntries.length} new`);
  if (dupes.length) console.log(`  ${dupes.length} already in library (skipped)`);

  if (!newEntries.length) { console.log("\nNothing new to add."); process.exit(0); }

  console.log("\nNew entries to add:");
  newEntries.forEach((e, i) => {
    console.log(`\n  [${i + 1}] ${e.title}`);
    console.log(`      ${e.apa}`);
  });

  const answer = await ask("\nAdd all to publications.json? [y/n] ");
  if (answer.trim().toLowerCase() !== "y") { console.log("Aborted."); process.exit(0); }

  const updated = [...newEntries, ...library].sort((a, b) => (b.year || 0) - (a.year || 0));
  saveLibrary(updated);
  console.log(`\nSaved. Library now has ${updated.length} publication${updated.length !== 1 ? "s" : ""}.`);
}

main().catch(e => { console.error(e); process.exit(1); });
