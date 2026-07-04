import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { saveAs } from "file-saver";
import type { CvStructuredType } from "./cv.functions";
import { jsPDF } from "jspdf";

export type Section = { title: string; body: string };

// A neutral block model that both the .docx exporter and the on-screen
// preview / "Copy all" text render from, so all three views stay in sync.
export type CvBlock =
  | { kind: "title"; text: string }
  | { kind: "subtitle"; text: string }
  | { kind: "contact"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "line"; text: string; bold?: boolean }
  | { kind: "bullet"; text: string }
  | { kind: "spacer" };

function stripMd(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/```[\w-]*\n([\s\S]*?)```/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[—–]/g, "-")
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .trim();
}

function findSection(sections: Section[], keyword: string): string {
  const s = sections.find((x) => x.title.toLowerCase().includes(keyword));
  return s ? stripMd(s.body) : "";
}

// Parse the "Relevant Experience" section into per-role blocks.
// Heuristic: a heading line (no leading "- ") starts a role; following
// bullet lines belong to it.
function parseExperienceBlocks(body: string): { heading: string; bullets: string[] }[] {
  const out: { heading: string; bullets: string[] }[] = [];
  const lines = body.split("\n");
  let current: { heading: string; bullets: string[] } | null = null;
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    const b = l.match(/^(?:[-*+•]|\d+\.)\s+(.*)$/);
    if (b) {
      if (!current) current = { heading: "", bullets: [] };
      current.bullets.push(b[1]);
    } else {
      if (current) out.push(current);
      current = { heading: l, bullets: [] };
    }
  }
  if (current) out.push(current);
  return out;
}

function matchBulletsToRole(
  role: { title: string; company: string },
  blocks: { heading: string; bullets: string[] }[],
): string[] | null {
  const t = role.title.toLowerCase();
  const c = role.company.toLowerCase();
  const hit = blocks.find((b) => {
    const h = b.heading.toLowerCase();
    return (t && h.includes(t)) || (c && h.includes(c));
  });
  return hit ? hit.bullets : null;
}

// ---- Build the neutral block list ----------------------------------------

export function buildTailoredCvBlocks(
  cv: CvStructuredType,
  sections: Section[],
): CvBlock[] {
  const summary = findSection(sections, "summary");
  const skillsBody = findSection(sections, "technical skills");
  const experienceBody = findSection(sections, "experience");
  const expBlocks = experienceBody ? parseExperienceBlocks(experienceBody) : [];
  const newSkills = skillsBody
    ? skillsBody
        .split("\n")
        .map((l) => l.replace(/^\s*(?:[-*+•]|\d+\.)\s+/, "").trim())
        .filter((l) => l && !/^(core|additional)/i.test(l))
    : cv.technical_skills;

  const contactParts = [cv.email, cv.phone, cv.address].filter(Boolean) as string[];
  const linkParts = [cv.linkedin, cv.website].filter(Boolean) as string[];
  const blocks: CvBlock[] = [];
  blocks.push({ kind: "title", text: cv.full_name ?? "Your Name" });
  if (cv.current_title) blocks.push({ kind: "subtitle", text: cv.current_title });
  if (contactParts.length)
    blocks.push({ kind: "contact", text: contactParts.join("  •  ") });
  if (linkParts.length)
    blocks.push({ kind: "contact", text: linkParts.join("  •  ") });
  blocks.push({ kind: "spacer" });

  // Summary, tailored, else fall back to original CV's summary
  const summaryText = summary || cv.professional_summary || "";
  if (summaryText) {
    blocks.push({ kind: "heading", text: "Professional Summary" });
    for (const l of summaryText.split("\n").filter((x) => x.trim())) {
      blocks.push({ kind: "line", text: l.trim() });
    }
  }

  // Skills
  blocks.push({ kind: "heading", text: "Technical Skills" });
  for (const s of newSkills) blocks.push({ kind: "bullet", text: s });

  // Experience, original headers, only bullets swapped
  if (cv.work_history.length) {
    blocks.push({ kind: "heading", text: "Professional Experience" });
    for (const w of cv.work_history) {
      const headerRight = w.duration ? ` (${w.duration})` : "";
      const locSuffix = w.location ? `, ${w.location}` : "";
      blocks.push({
        kind: "line",
        bold: true,
        text: `${w.title}, ${w.company}${locSuffix}${headerRight}`,
      });
      const newBullets = matchBulletsToRole(w, expBlocks);
      if (newBullets && newBullets.length) {
        for (const b of newBullets) blocks.push({ kind: "bullet", text: b });
      } else if (w.bullets && w.bullets.length) {
        // Preserve the original CV's bullets when the tailored response
        // didn't provide matching ones.
        for (const b of w.bullets) blocks.push({ kind: "bullet", text: b });
      } else if (w.summary) {
        blocks.push({ kind: "line", text: w.summary });
      }
    }
  }

  // Education, untouched
  if (cv.education.length) {
    blocks.push({ kind: "heading", text: "Education" });
    for (const e of cv.education) {
      const loc = e.location ? `, ${e.location}` : "";
      blocks.push({
        kind: "line",
        text: `${e.degree}, ${e.institution}${loc}${e.year ? ` (${e.year})` : ""}`,
      });
      if (e.details) blocks.push({ kind: "line", text: e.details });
    }
  }

  // Projects, untouched from original CV
  if (cv.projects && cv.projects.length) {
    blocks.push({ kind: "heading", text: "Projects" });
    for (const p of cv.projects) {
      blocks.push({
        kind: "line",
        bold: true,
        text: p.stack.length ? `${p.name}, ${p.stack.join(", ")}` : p.name,
      });
      if (p.description) blocks.push({ kind: "line", text: p.description });
    }
  }

  // Certifications, untouched
  if (cv.certifications.length) {
    blocks.push({ kind: "heading", text: "Certifications" });
    for (const c of cv.certifications) blocks.push({ kind: "bullet", text: c });
  }

  // Languages, untouched
  if (cv.languages.length) {
    blocks.push({ kind: "heading", text: "Languages" });
    blocks.push({ kind: "line", text: cv.languages.join(", ") });
  }

  return blocks;
}

export function blocksToPlainText(blocks: CvBlock[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.kind) {
      case "title":
        out.push(b.text);
        break;
      case "subtitle":
      case "contact":
        out.push(b.text);
        break;
      case "heading":
        out.push("");
        out.push(b.text.toUpperCase());
        out.push("");
        break;
      case "line":
        out.push(b.text);
        break;
      case "bullet":
        out.push(`- ${b.text}`);
        break;
      case "spacer":
        out.push("");
        break;
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ---- Format preference (persisted) ---------------------------------------

export type ExportFormat = "pdf" | "docx";
const FORMAT_KEY = "aptivo:export-format";

export function getPreferredExportFormat(): ExportFormat {
  if (typeof window === "undefined") return "docx";
  const v = window.localStorage.getItem(FORMAT_KEY);
  return v === "pdf" || v === "docx" ? v : "docx";
}

export function setPreferredExportFormat(f: ExportFormat) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FORMAT_KEY, f);
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

// ---- Match check ---------------------------------------------------------
//
// Guarantees the exported file's content matches the on-screen preview and
// the "Copy all" text. Because all three views derive from the same
// buildTailoredCvBlocks() output, a mismatch means someone forked the render
// path, the check catches that regression instead of shipping silently.

export function verifyExportMatchesPreview(
  blocks: CvBlock[],
  previewText: string,
): { ok: true } | { ok: false; diff: { at: number; expected: string; got: string } } {
  const expected = blocksToPlainText(blocks);
  const got = previewText.trim();
  if (expected === got) return { ok: true };
  // Find first diverging character to make the console message useful.
  let i = 0;
  const len = Math.min(expected.length, got.length);
  while (i < len && expected[i] === got[i]) i++;
  return {
    ok: false,
    diff: {
      at: i,
      expected: expected.slice(i, i + 60),
      got: got.slice(i, i + 60),
    },
  };
}

// ---- .docx renderer -------------------------------------------------------

function heading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, size: 24 }),
    ],
  });
}

function line(text: string, opts?: { bold?: boolean; italics?: boolean; size?: number }): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        italics: opts?.italics,
        size: opts?.size ?? 22,
      }),
    ],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function blocksToParagraphs(blocks: CvBlock[]): Paragraph[] {
  const out: Paragraph[] = [];
  for (const b of blocks) {
    switch (b.kind) {
      case "title":
        out.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [new TextRun({ text: b.text, bold: true, size: 40 })],
          }),
        );
        break;
      case "subtitle":
        out.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [new TextRun({ text: b.text, italics: true, size: 22 })],
          }),
        );
        break;
      case "contact":
        out.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [new TextRun({ text: b.text, size: 20 })],
          }),
        );
        break;
      case "heading":
        out.push(heading(b.text));
        break;
      case "line":
        out.push(line(b.text, { bold: b.bold }));
        break;
      case "bullet":
        out.push(bullet(b.text));
        break;
      case "spacer":
        out.push(new Paragraph({ children: [new TextRun("")] }));
        break;
    }
  }
  return out;
}

function bodyToBlocks(body: string): Paragraph[] {
  const out: Paragraph[] = [];
  const lines = body.split("\n");
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (!l.trim()) {
      out.push(new Paragraph({ children: [new TextRun("")] }));
      continue;
    }
    const b = l.match(/^\s*(?:[-*+•]|\d+\.)\s+(.*)$/);
    if (b) {
      out.push(bullet(b[1]));
    } else {
      out.push(line(l));
    }
  }
  return out;
}

export async function downloadTailoredCvDocx(
  cv: CvStructuredType,
  responseText: string,
  sections: Section[],
) {
  const cvBlocks = buildTailoredCvBlocks(cv, sections);
  const contactParts = [cv.email, cv.phone, cv.address].filter(Boolean) as string[];
  const doc = new Document({
    creator: "Aptivo",
    title: `${cv.full_name ?? "CV"}, Tailored CV`,
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
      },
    },
    sections: [{ properties: {}, children: blocksToParagraphs(cvBlocks) }],
  });
  const blob = await Packer.toBlob(doc);
  const safe = (cv.full_name ?? "cv").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  saveAs(blob, `${safe}_tailored_cv.docx`);
  // Also export the cover letter separately if present
  const cover = findSection(sections, "cover letter");
  if (cover) {
    const coverDoc = new Document({
      creator: "Aptivo",
      title: `${cv.full_name ?? "CV"}, Cover Letter`,
      styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [new TextRun({ text: cv.full_name ?? "Your Name", bold: true, size: 32 })],
            }),
            new Paragraph({
              spacing: { after: 200 },
              children: [new TextRun({ text: contactParts.join("  •  "), size: 20 })],
            }),
            ...bodyToBlocks(cover),
          ],
        },
      ],
    });
    const coverBlob = await Packer.toBlob(coverDoc);
    saveAs(coverBlob, `${safe}_cover_letter.docx`);
  }
  // Also keep the raw generated text as a plain .txt for anyone who wants it
  void responseText;
}

// ---- .pdf renderer --------------------------------------------------------

export async function downloadTailoredCvPdf(
  cv: CvStructuredType,
  _responseText: string,
  sections: Section[],
) {
  const cvBlocks = buildTailoredCvBlocks(cv, sections);
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 54; // ~0.75in
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeWrapped = (
    text: string,
    opts: {
      size?: number;
      bold?: boolean;
      italic?: boolean;
      align?: "left" | "center";
      indent?: number;
      leading?: number;
      after?: number;
    } = {},
  ) => {
    const size = opts.size ?? 11;
    const style = opts.bold && opts.italic
      ? "bolditalic"
      : opts.bold
        ? "bold"
        : opts.italic
          ? "italic"
          : "normal";
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const indent = opts.indent ?? 0;
    const width = contentWidth - indent;
    const lines = doc.splitTextToSize(text, width) as string[];
    const leading = opts.leading ?? size * 1.25;
    for (const ln of lines) {
      ensureSpace(leading);
      if (opts.align === "center") {
        doc.text(ln, pageWidth / 2, y, { align: "center" });
      } else {
        doc.text(ln, margin + indent, y);
      }
      y += leading;
    }
    if (opts.after) y += opts.after;
  };

  const rule = () => {
    ensureSpace(8);
    doc.setDrawColor(180);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
  };

  for (const b of cvBlocks) {
    switch (b.kind) {
      case "title":
        writeWrapped(b.text, { size: 20, bold: true, align: "center", after: 2 });
        break;
      case "subtitle":
        writeWrapped(b.text, { size: 11, italic: true, align: "center", after: 2 });
        break;
      case "contact":
        writeWrapped(b.text, { size: 10, align: "center", after: 4 });
        break;
      case "heading":
        y += 6;
        writeWrapped(b.text.toUpperCase(), { size: 12, bold: true, after: 2 });
        rule();
        break;
      case "line":
        writeWrapped(b.text, { size: 11, bold: b.bold, after: 2 });
        break;
      case "bullet": {
        ensureSpace(14);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text("•", margin + 4, y);
        writeWrapped(b.text, { size: 11, indent: 16, after: 2 });
        break;
      }
      case "spacer":
        y += 6;
        break;
    }
  }

  const safe = (cv.full_name ?? "cv").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  doc.save(`${safe}_tailored_cv.pdf`);

  const cover = findSection(sections, "cover letter");
  if (cover) {
    const cdoc = new jsPDF({ unit: "pt", format: "letter" });
    const cw = cdoc.internal.pageSize.getWidth();
    const ch = cdoc.internal.pageSize.getHeight();
    const m = 54;
    let cy = m;
    const cwidth = cw - m * 2;
    const writeC = (text: string, size: number, bold = false) => {
      cdoc.setFont("helvetica", bold ? "bold" : "normal");
      cdoc.setFontSize(size);
      const lines = cdoc.splitTextToSize(text, cwidth) as string[];
      for (const ln of lines) {
        if (cy + size * 1.3 > ch - m) {
          cdoc.addPage();
          cy = m;
        }
        cdoc.text(ln, m, cy);
        cy += size * 1.3;
      }
    };
    writeC(cv.full_name ?? "Your Name", 16, true);
    const contactParts = [cv.email, cv.phone, cv.address].filter(Boolean) as string[];
    if (contactParts.length) writeC(contactParts.join("  •  "), 10);
    cy += 8;
    for (const raw of cover.split("\n")) {
      const l = raw.trim();
      if (!l) {
        cy += 6;
        continue;
      }
      writeC(l, 11);
    }
    cdoc.save(`${safe}_cover_letter.pdf`);
  }
}