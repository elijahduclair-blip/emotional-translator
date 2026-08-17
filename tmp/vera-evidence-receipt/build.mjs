import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "C:\\Users\\eli\\Documents\\New project\\outputs\\019fb724-fe9d-7f80-90f8-7a4f6ba6d817";
const previewDir = path.join(outputDir, "vera-evidence-receipt-previews");
const outputPath = path.join(outputDir, "vera-evidence-receipt.xlsx");

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const wb = Workbook.create();
const receipts = wb.worksheets.add("Evidence Receipts");
const sources = wb.worksheets.add("Source Register");
const rules = wb.worksheets.add("Receipt Rules");

const colors = {
  ink: "#202124",
  muted: "#5F6368",
  line: "#DADCE0",
  header: "#F1F3F4",
  sage: "#DDEFE5",
  sageText: "#185C37",
  verified: "#E6F4EA",
  contradicted: "#FCE8E6",
  unresolved: "#FEF7E0",
  white: "#FFFFFF",
};

function titleBlock(sheet, title, subtitle, endColumn) {
  sheet.getRange(`A1:${endColumn}1`).merge();
  sheet.getRange("A1").values = [[title]];
  sheet.getRange(`A2:${endColumn}2`).merge();
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange(`A1:${endColumn}1`).format = {
    fill: colors.sage,
    font: { bold: true, color: colors.sageText, size: 16 },
    verticalAlignment: "center",
  };
  sheet.getRange(`A2:${endColumn}2`).format = {
    fill: colors.white,
    font: { color: colors.muted, italic: true, size: 10 },
    wrapText: true,
    verticalAlignment: "center",
  };
  sheet.getRange(`A1:${endColumn}2`).format.borders = {
    bottom: { style: "thin", color: colors.line },
  };
}

function headerStyle(range) {
  range.format = {
    fill: colors.header,
    font: { bold: true, color: colors.ink },
    wrapText: true,
    verticalAlignment: "center",
    borders: {
      bottom: { style: "medium", color: colors.line },
    },
  };
}

function bodyStyle(range) {
  range.format = {
    font: { color: colors.ink, size: 10 },
    wrapText: true,
    verticalAlignment: "top",
    borders: {
      insideHorizontal: { style: "thin", color: colors.line },
    },
  };
}

// Evidence Receipts
titleBlock(
  receipts,
  "VERA Evidence Receipts",
  "Verification and Relational Authority · source-backed findings with an explicit no-mutation boundary",
  "L",
);

receipts.getRange("A4:H4").values = [[
  "Receipts",
  null,
  "Verified",
  null,
  "Needs external source",
  null,
  "Graph mutation",
  "proposal_only",
]];
receipts.getRange("B4").formulas = [["=COUNTA(A8:A200)"]];
receipts.getRange("D4").formulas = [["=COUNTIF(D8:D200,\"verified\")"]];
receipts.getRange("F4").formulas = [["=COUNTIF(D8:D200,\"insufficient_evidence\")"]];
receipts.getRange("A4:H4").format = {
  fill: "#FAFAFA",
  font: { color: colors.ink },
  borders: { preset: "outside", style: "thin", color: colors.line },
  verticalAlignment: "center",
};
receipts.getRange("A4:A4").format.font = { bold: true };
receipts.getRange("C4:C4").format.font = { bold: true };
receipts.getRange("E4:E4").format.font = { bold: true };
receipts.getRange("G4:G4").format.font = { bold: true };
receipts.getRange("B4:F4").format.horizontalAlignment = "center";

receipts.getRange("A5:L5").merge();
receipts.getRange("A5").values = [[
  "Boundary: a VERA receipt records evidence. It does not change the approved semantic graph; any graph change requires a separate governed proposal and approval.",
]];
receipts.getRange("A5:L5").format = {
  fill: colors.unresolved,
  font: { bold: true, color: "#7A4D00" },
  wrapText: true,
  verticalAlignment: "center",
  borders: { preset: "outside", style: "thin", color: "#E6C65C" },
};

const receiptHeaders = [[
  "Receipt ID",
  "Claim",
  "Claim Type",
  "Verdict",
  "Confidence",
  "Evidence Summary",
  "Source IDs",
  "Method",
  "Conflicts / Limits",
  "Checked At",
  "Graph Mutation",
  "Receipt Status",
]];
receipts.getRange("A7:L7").values = receiptHeaders;
headerStyle(receipts.getRange("A7:L7"));

const checkedAt = new Date("2026-08-16T00:00:00-04:00");
const receiptRows = [
  [
    "VERA-20260816-001",
    "The 17:57 ChromaBridge snapshot contains 2,519 records, and every full 17:57 record is preserved in the 20:13 snapshot.",
    "internal_dataset",
    "verified",
    1,
    "17:57 has 2,519 rows. Multiset comparison found zero missing prior records in 20:13, which has 5,011 rows.",
    "SRC-001, SRC-002",
    "Exact multiset inclusion using tier, normalized name, XYZ, hex, and semantic code.",
    "Relationship-text columns were excluded because PDF text extraction overlaps visually in those fields.",
    checkedAt,
    "none",
    "complete",
  ],
  [
    "VERA-20260816-002",
    "The 20:13 and 20:25 snapshots contain the same tier-plus-normalized-name occurrence multiset, with 5,011 records in each.",
    "internal_dataset",
    "verified",
    1,
    "Both snapshots contain 5,011 records. Comparison found zero tier/name occurrence-count mismatches.",
    "SRC-002, SRC-003",
    "Group each snapshot by tier and NFC/lowercase name, then compare every occurrence count.",
    "This establishes identity-count continuity, not that every coordinate or visual field is unchanged.",
    checkedAt,
    "none",
    "complete",
  ],
  [
    "VERA-20260816-003",
    "Every record in the 20:25 snapshot has a unique full XYZ coordinate.",
    "internal_dataset",
    "verified",
    1,
    "The snapshot has 5,011 rows and 5,011 unique X|Y|Z tuples; zero duplicate coordinate groups were found.",
    "SRC-003",
    "Group all rows by the exact X, Y, and Z tuple and count duplicate groups.",
    "Coordinate uniqueness does not by itself establish semantic correctness.",
    checkedAt,
    "none",
    "complete",
  ],
  [
    "VERA-20260816-004",
    "The 20:25 semantic code is not a unique record identifier.",
    "internal_dataset",
    "verified",
    1,
    "5,011 rows produce 4,391 unique codes. There are 366 collision codes covering 986 rows; the largest collision group contains 6 rows.",
    "SRC-003",
    "Group all rows by semanticCode and measure groups with more than one row.",
    "Use a stable occurrence ID plus full XYZ for identity; retain semanticCode as a compact display or lookup value.",
    checkedAt,
    "none",
    "complete",
  ],
  [
    "VERA-20260816-005",
    "Repeated normalized names in the 20:25 snapshot can safely be deduplicated into one graph occurrence.",
    "internal_dataset",
    "contradicted",
    0.99,
    "The snapshot has 3,291 unique normalized names. 1,083 name keys repeat, covering 2,803 rows, while all full XYZ coordinates remain unique.",
    "SRC-003",
    "Compare normalized-name multiplicity with exact XYZ uniqueness.",
    "A repeated name may represent multiple contextual placements; inspect relationships before consolidation.",
    checkedAt,
    "none",
    "complete",
  ],
  [
    "VERA-20260816-006",
    "The ChromaBridge Y axis can be defined as dark versus light.",
    "interpretive_association",
    "insufficient_evidence",
    0.2,
    "The available source header labels Y as “Abstract–Diff”; the reviewed snapshots do not supply an authoritative dark/light definition.",
    "SRC-001, SRC-002, SRC-003",
    "Inspect the source header and compare it with the proposed ContextCell axis language.",
    "Requires an explicit governed axis definition or authoritative source before VERA can treat dark/light as established.",
    checkedAt,
    "none",
    "needs_source",
  ],
];

receipts.getRange("A8:L13").values = receiptRows;
bodyStyle(receipts.getRange("A8:L13"));
receipts.getRange("E8:E13").format.numberFormat = "0%";
receipts.getRange("J8:J13").format.numberFormat = "yyyy-mm-dd";
receipts.getRange("D8:D11").format.fill = colors.verified;
receipts.getRange("D12").format.fill = colors.contradicted;
receipts.getRange("D13").format.fill = colors.unresolved;
receipts.getRange("K8:L13").format.horizontalAlignment = "center";
receipts.freezePanes.freezeRows(7);
receipts.showGridLines = false;

const receiptWidths = {
  A: 21,
  B: 48,
  C: 22,
  D: 23,
  E: 18,
  F: 48,
  G: 20,
  H: 42,
  I: 44,
  J: 15,
  K: 18,
  L: 18,
};
for (const [column, width] of Object.entries(receiptWidths)) {
  receipts.getRange(`${column}:${column}`).format.columnWidth = width;
}
receipts.getRange("1:1").format.rowHeight = 28;
receipts.getRange("2:2").format.rowHeight = 34;
receipts.getRange("5:5").format.rowHeight = 38;
receipts.getRange("7:7").format.rowHeight = 34;
receipts.getRange("8:13").format.rowHeight = 88;

// Source Register
titleBlock(
  sources,
  "VERA Source Register",
  "Exact source identities for the evidence receipts. Hashes let VERA detect a replaced or altered snapshot.",
  "J",
);
sources.getRange("A4:J4").values = [[
  "Source ID",
  "File Name",
  "Source Class",
  "Local Location",
  "Captured",
  "Pages",
  "Records",
  "Bytes",
  "SHA-256",
  "Use / Trust Note",
]];
headerStyle(sources.getRange("A4:J4"));
const sourceRows = [
  [
    "SRC-001",
    "ChromaBridge Export 2026-07-17 17_57 - Color Nodes.pdf",
    "local_snapshot_pdf",
    "E:\\ChromaBridge Export 2026-07-17 17_57 - Color Nodes.pdf",
    new Date("2026-07-17T17:57:00Z"),
    39,
    2519,
    1009720,
    "47246C9114A402740233568FC93841D2B8B9539FE8C0C8B93E1F8DD3309B4834",
    "Authoritative for its own snapshot; not an external authority for universal semantic claims.",
  ],
  [
    "SRC-002",
    "ChromaBridge Export 2026-07-17 20_13 - Color Nodes.pdf",
    "local_snapshot_pdf",
    "E:\\ChromaBridge Export 2026-07-17 20_13 - Color Nodes.pdf",
    new Date("2026-07-17T20:13:00Z"),
    52,
    5011,
    1459216,
    "3FE0278381C21A033C542DB925BE074C6D020C25CE16F84B9ACD4F39392A4B88",
    "Authoritative for its own snapshot; relationship text needs visual or structured-source confirmation.",
  ],
  [
    "SRC-003",
    "ChromaBridge Export 2026-07-17 20_25 - Color Nodes.pdf",
    "local_snapshot_pdf",
    "E:\\ChromaBridge Export 2026-07-17 20_25 - Color Nodes.pdf",
    new Date("2026-07-17T20:25:00Z"),
    120,
    5011,
    1599053,
    "EFC2ED1A07D1DD0B28E5BD55050DEAD965C6B7D8296AF0F784DD933002E4B3A9",
    "Current reviewed imported-knowledge snapshot; preserve prior files as audit history.",
  ],
];
sources.getRange("A5:J7").values = sourceRows;
bodyStyle(sources.getRange("A5:J7"));
sources.getRange("E5:E7").format.numberFormat = "yyyy-mm-dd hh:mm";
sources.getRange("F5:H7").format.numberFormat = "#,##0";
sources.getRange("F5:H7").format.horizontalAlignment = "right";
sources.freezePanes.freezeRows(4);
sources.showGridLines = false;
const sourceWidths = { A: 15, B: 48, C: 22, D: 58, E: 20, F: 10, G: 11, H: 14, I: 68, J: 48 };
for (const [column, width] of Object.entries(sourceWidths)) {
  sources.getRange(`${column}:${column}`).format.columnWidth = width;
}
sources.getRange("1:1").format.rowHeight = 28;
sources.getRange("2:2").format.rowHeight = 34;
sources.getRange("4:4").format.rowHeight = 32;
sources.getRange("5:7").format.rowHeight = 82;

// Receipt Rules
titleBlock(
  rules,
  "VERA Receipt Rules",
  "How ARI’s verification teammate classifies evidence without confusing fact, personal context, or relational interpretation.",
  "D",
);

rules.getRange("A4:D4").merge();
rules.getRange("A4").values = [["Claim types"]];
rules.getRange("A4:D4").format = { fill: colors.sage, font: { bold: true, color: colors.sageText } };
rules.getRange("A5:C5").values = [["Claim Type", "Use", "Evidence Rule"]];
headerStyle(rules.getRange("A5:C5"));
rules.getRange("A6:C9").values = [
  ["external_fact", "A claim about the world outside the Garden", "Use current authoritative sources; prefer primary sources for important claims."],
  ["internal_dataset", "A claim about Garden records, snapshots, or calculations", "Reproduce the calculation from identified immutable sources and record the method."],
  ["personal_assertion", "A person’s stated fact or lived report", "Record as user-asserted unless independently documented; do not convert it into a universal claim."],
  ["interpretive_association", "A personal or relational meaning such as a color association", "Preserve the context and owner; do not present it as a universal fact."],
];
bodyStyle(rules.getRange("A6:C9"));

rules.getRange("A11:D11").merge();
rules.getRange("A11").values = [["Verdicts"]];
rules.getRange("A11:D11").format = { fill: colors.sage, font: { bold: true, color: colors.sageText } };
rules.getRange("A12:C12").values = [["Verdict", "Meaning", "Next Action"]];
headerStyle(rules.getRange("A12:C12"));
rules.getRange("A13:C19").values = [
  ["verified", "The cited evidence directly supports the bounded claim.", "Keep the receipt; graph change still requires a separate proposal."],
  ["contradicted", "The cited evidence directly conflicts with the bounded claim.", "Record the conflict and do not promote the claim."],
  ["mixed", "Reliable sources support different parts or disagree.", "Preserve each position and narrow the claim."],
  ["outdated", "The claim was once supported but is no longer current.", "Retain the historical receipt and issue a newer one."],
  ["insufficient_evidence", "The available sources cannot establish the claim.", "Identify the missing source or test; do not guess."],
  ["personal_assertion", "The statement belongs to the speaker’s record.", "Preserve ownership and context; verify only if appropriate and consented."],
  ["interpretive_association", "The statement is a relational interpretation.", "Keep it contextual and proposal-only."],
];
bodyStyle(rules.getRange("A13:C19"));

rules.getRange("A21:D21").merge();
rules.getRange("A21").values = [["Governance boundary"]];
rules.getRange("A21:D21").format = { fill: colors.sage, font: { bold: true, color: colors.sageText } };
rules.getRange("A22:B27").values = [
  ["No silent mutation", "VERA never changes approved nodes, routes, personal graphs, or shared knowledge from a receipt."],
  ["Proposal separation", "A supported receipt may be attached to a separate change proposal reviewed through ChromaBridge governance."],
  ["Source accountability", "Every factual verdict identifies sources, source locators, the checking method, date, and limits."],
  ["Corrections", "A correction creates a new receipt that supersedes the prior one; history stays visible."],
  ["Wikipedia", "Useful for orientation; follow its references to primary or authoritative sources for important claims."],
  ["Confidence", "Confidence measures evidence strength for the bounded verdict, not a permanent truth score for a person or concept."],
];
bodyStyle(rules.getRange("A22:B27"));

rules.showGridLines = false;
rules.freezePanes.freezeRows(5);
rules.getRange("A:A").format.columnWidth = 24;
rules.getRange("B:B").format.columnWidth = 48;
rules.getRange("C:C").format.columnWidth = 58;
rules.getRange("D:D").format.columnWidth = 4;
rules.getRange("1:1").format.rowHeight = 28;
rules.getRange("2:2").format.rowHeight = 36;
rules.getRange("5:5").format.rowHeight = 28;
rules.getRange("6:9").format.rowHeight = 54;
rules.getRange("12:12").format.rowHeight = 28;
rules.getRange("13:19").format.rowHeight = 50;
rules.getRange("22:27").format.rowHeight = 48;

// Compact verification before export.
const receiptsInspect = await wb.inspect({
  kind: "table",
  sheetId: "Evidence Receipts",
  range: "A1:L13",
  include: "values,formulas",
  tableMaxRows: 16,
  tableMaxCols: 12,
  maxChars: 12000,
});
console.log("INSPECT_RECEIPTS\n" + receiptsInspect.ndjson);

const formulaErrors = await wb.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
  maxChars: 3000,
});
console.log("FORMULA_ERRORS\n" + formulaErrors.ndjson);

for (const [sheetName, range, fileName] of [
  ["Evidence Receipts", "A1:L13", "evidence-receipts.png"],
  ["Source Register", "A1:J7", "source-register.png"],
  ["Receipt Rules", "A1:D27", "receipt-rules.png"],
]) {
  const image = await wb.render({ sheetName, range, scale: 1.25, format: "png" });
  await fs.writeFile(path.join(previewDir, fileName), new Uint8Array(await image.arrayBuffer()));
}

const output = await SpreadsheetFile.exportXlsx(wb);
await output.save(outputPath);
console.log(`OUTPUT=${outputPath}`);
