import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "file:///C:/Users/eli/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(projectRoot, "data", "color-synonyms.json");
const exportDir = path.join(projectRoot, "exports");
const exportPath = path.join(exportDir, "active-node-positions-semantic-labels.xlsx");

const raw = await fs.readFile(sourcePath, "utf8");
const data = JSON.parse(raw);
const graph = data.graph ?? {};
const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
const edges = Array.isArray(graph.edges) ? graph.edges : [];

function colName(index) {
  let n = index;
  let name = "";
  while (n > 0) {
    const mod = (n - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    n = Math.floor((n - mod) / 26);
  }
  return name;
}

function asText(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join("; ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function compactJson(value, max = 600) {
  if (value == null) return "";
  const text = JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function pickCoordinate(node) {
  const candidates = [
    node?.metadata?.coordinates,
    node?.metadata?.position,
    node?.coordinates,
    node?.position,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length >= 3) {
      return {
        x: Number(candidate[0]),
        y: Number(candidate[1]),
        z: Number(candidate[2]),
        source: "array",
      };
    }
    if (candidate && typeof candidate === "object") {
      const x = Number(candidate.x);
      const y = Number(candidate.y);
      const z = Number(candidate.z);
      if ([x, y, z].every(Number.isFinite)) {
        return { x, y, z, source: "object" };
      }
    }
  }
  return { x: "", y: "", z: "", source: "" };
}

function semanticLabels(node) {
  const metadata = node.metadata ?? {};
  return [
    node.type,
    metadata.semanticLabel,
    metadata.semanticLabels,
    metadata.labels,
    metadata.tags,
    metadata.role,
    metadata.schemaRole,
    metadata.family,
    metadata.baseColor,
    metadata.secondaryColor,
    metadata.shade,
    metadata.associationBasis,
    metadata.definitionBasis,
    metadata.emotionDefinition,
    metadata.boundary,
  ]
    .map(asText)
    .filter(Boolean)
    .join("; ");
}

function nodeFamily(node) {
  const metadata = node.metadata ?? {};
  return metadata.family ?? metadata.baseColor ?? metadata.baseFamily ?? "";
}

function isActive(node) {
  const status = String(node?.metadata?.status ?? node?.status ?? "").toLowerCase();
  return node.active !== false && status !== "inactive" && status !== "archived";
}

const activeNodes = nodes.filter(isActive);

const nodeHeaders = [
  "nodeId",
  "label",
  "type",
  "active",
  "family",
  "baseColor",
  "secondaryColor",
  "shade",
  "semanticLabels",
  "x",
  "y",
  "z",
  "coordinateSource",
  "hasCoordinates",
  "parentFamilies",
  "influenceWeights",
  "activationWeight",
  "definitionBasis",
  "metadataSummary",
];

const nodeRows = activeNodes.map((node) => {
  const metadata = node.metadata ?? {};
  const c = pickCoordinate(node);
  const hasCoordinates = [c.x, c.y, c.z].every((value) => value !== "" && Number.isFinite(value));
  return [
    node.id ?? "",
    node.label ?? node.name ?? node.id ?? "",
    node.type ?? metadata.type ?? "",
    isActive(node) ? "yes" : "no",
    nodeFamily(node),
    metadata.baseColor ?? metadata.baseFamily ?? "",
    metadata.secondaryColor ?? metadata.bridgeColor ?? "",
    metadata.shade ?? "",
    semanticLabels(node),
    c.x,
    c.y,
    c.z,
    c.source,
    hasCoordinates ? "yes" : "no",
    asText(metadata.parentFamilies ?? metadata.parents ?? metadata.parentColors),
    asText(metadata.influenceWeights ?? metadata.bridgeInfluence),
    metadata.activationWeight ?? metadata.weight ?? "",
    metadata.definitionBasis ?? metadata.associationBasis ?? "",
    compactJson(metadata),
  ];
});

const edgeHeaders = [
  "source",
  "target",
  "type",
  "label",
  "weight",
  "activationWeight",
  "evidence",
  "sourceType",
  "metadataSummary",
];

const edgeRows = edges.map((edge) => {
  const metadata = edge.metadata ?? {};
  return [
    edge.source ?? edge.from ?? "",
    edge.target ?? edge.to ?? "",
    edge.type ?? metadata.type ?? "",
    edge.label ?? metadata.label ?? "",
    edge.weight ?? metadata.weight ?? "",
    edge.activationWeight ?? metadata.activationWeight ?? "",
    asText(edge.evidence ?? metadata.evidence ?? metadata.sourceNote),
    metadata.sourceType ?? metadata.routeSource ?? "",
    compactJson(metadata),
  ];
});

const summaryHeaders = ["metric", "value"];
const summaryRows = [
  ["sourceFile", sourcePath],
  ["generatedAt", new Date().toISOString()],
  ["totalNodes", nodes.length],
  ["activeNodes", activeNodes.length],
  ["activeNodesWithCoordinates", nodeRows.filter((row) => row[13] === "yes").length],
  ["activeNodesMissingCoordinates", nodeRows.filter((row) => row[13] !== "yes").length],
  ["totalEdges", edges.length],
  ["note", "All non-inactive graph nodes are treated as active for this export."],
];

function addSheet(workbook, name, headers, rows) {
  const sheet = workbook.worksheets.add(name);
  const width = headers.length;
  sheet.getRange(`A1:${colName(width)}1`).values = [headers];
  if (rows.length > 0) {
    sheet.getRange(`A2:${colName(width)}${rows.length + 1}`).values = rows;
  }
}

const workbook = Workbook.create();
addSheet(workbook, "Node Positions", nodeHeaders, nodeRows);
addSheet(workbook, "Edges", edgeHeaders, edgeRows);
addSheet(workbook, "Summary", summaryHeaders, summaryRows);

await fs.mkdir(exportDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(exportPath);

console.log(JSON.stringify({
  exportPath,
  activeNodes: activeNodes.length,
  activeNodesWithCoordinates: nodeRows.filter((row) => row[13] === "yes").length,
  activeNodesMissingCoordinates: nodeRows.filter((row) => row[13] !== "yes").length,
  edges: edges.length,
}, null, 2));
