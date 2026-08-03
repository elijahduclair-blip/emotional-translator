import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db/pool.js';
import { buildKnowledgePlacements } from '../src/engine/fixed-color-space.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultInput = path.resolve(scriptDirectory, '../../../data/chromabridge-color-knowledge.json');
const inputPath = path.resolve(process.argv[2] || defaultInput);
const BATCH_SIZE = 250;

async function main() {
  const knowledge = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  validateKnowledge(knowledge);

  const sourceDocument = knowledge.source.document;
  const placements = buildKnowledgePlacements(knowledge.records);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM knowledge_edges WHERE source_document = $1', [sourceDocument]);
    await client.query('DELETE FROM knowledge_nodes WHERE source_document = $1', [sourceDocument]);

    const nodeRows = knowledge.records.map(record => ({
      ...placements.get(record.id),
      id: record.id,
      tier: record.tier,
      name: record.name,
      normalizedName: normalize(record.name),
      hexColor: record.hexColor || null,
      semanticCode: record.semanticCode || null,
      coordinateX: record.coordinates.x,
      coordinateY: record.coordinates.y,
      coordinateZ: record.coordinates.z,
      parents: record.parents || [],
      synonyms: record.synonyms || [],
      opposites: record.opposites || [],
      semanticLabels: record.semanticLabels || [],
      sourceDocument: record.provenance.sourceDocument,
      sourceSha256: record.provenance.sourceSha256,
      sourcePage: record.provenance.page,
      sourceRow: record.provenance.row,
      relationshipExtractionConfidence: record.provenance.relationshipExtractionConfidence,
      provenance: record.provenance
    }));

    for (const batch of batches(nodeRows, BATCH_SIZE)) {
      await client.query(
        `INSERT INTO knowledge_nodes (
          id, tier, name, normalized_name, hex_color, semantic_code,
          coordinate_x, coordinate_y, coordinate_z,
          fixed_anchor, degree_of_vision, decimal_address, address_depth,
          placement_basis,
          parents, synonyms, opposites, semantic_labels,
          source_document, source_sha256, source_page, source_row,
          relationship_extraction_confidence, provenance
        )
        SELECT
          item.id, item.tier, item.name, item.normalized_name, item.hex_color, item.semantic_code,
          item.coordinate_x, item.coordinate_y, item.coordinate_z,
          item.fixed_anchor, item.degree_of_vision, item.decimal_address, item.address_depth,
          item.placement_basis,
          item.parents, item.synonyms, item.opposites, item.semantic_labels,
          item.source_document, item.source_sha256, item.source_page, item.source_row,
          item.relationship_extraction_confidence, item.provenance
        FROM jsonb_to_recordset($1::jsonb) AS item(
          id TEXT, tier TEXT, name TEXT, normalized_name TEXT, hex_color TEXT, semantic_code TEXT,
          coordinate_x DOUBLE PRECISION, coordinate_y DOUBLE PRECISION, coordinate_z DOUBLE PRECISION,
          fixed_anchor TEXT, degree_of_vision NUMERIC, decimal_address TEXT, address_depth INTEGER,
          placement_basis TEXT,
          parents TEXT[], synonyms TEXT[], opposites TEXT[], semantic_labels TEXT[],
          source_document TEXT, source_sha256 TEXT, source_page INTEGER, source_row INTEGER,
          relationship_extraction_confidence TEXT, provenance JSONB
        )`,
        [JSON.stringify(batch.map(toDatabaseKeys))]
      );
    }

    const edgeRows = knowledge.records.flatMap(record => [
      ...relationshipEdges(record, 'parent', record.parents || [], sourceDocument),
      ...relationshipEdges(record, 'synonym', record.synonyms || [], sourceDocument),
      ...relationshipEdges(record, 'antonym', record.opposites || [], sourceDocument)
    ]);

    for (const batch of batches(edgeRows, BATCH_SIZE)) {
      await client.query(
        `INSERT INTO knowledge_edges (
          id, source_id, relation_type, target_name, normalized_target_name, evidence, source_document
        )
        SELECT item.id, item.source_id, item.relation_type, item.target_name,
          item.normalized_target_name, item.evidence, item.source_document
        FROM jsonb_to_recordset($1::jsonb) AS item(
          id TEXT, source_id TEXT, relation_type TEXT, target_name TEXT,
          normalized_target_name TEXT, evidence JSONB, source_document TEXT
        )`,
        [JSON.stringify(batch.map(toDatabaseKeys))]
      );
    }

    await client.query(
      `WITH unique_targets AS (
        SELECT normalized_name, MIN(id) AS id
        FROM knowledge_nodes
        WHERE source_document = $1
        GROUP BY normalized_name
        HAVING COUNT(*) = 1
      )
      UPDATE knowledge_edges edge
      SET target_id = target.id
      FROM unique_targets target
      WHERE edge.source_document = $1
        AND edge.normalized_target_name = target.normalized_name`,
      [sourceDocument]
    );

    const edgeSummary = await client.query(
      `SELECT COUNT(*)::int AS total,
        COUNT(target_id)::int AS resolved,
        (COUNT(*) - COUNT(target_id))::int AS unresolved
       FROM knowledge_edges WHERE source_document = $1`,
      [sourceDocument]
    );
    await client.query('COMMIT');

    console.log(`Imported ${nodeRows.length} knowledge nodes from ${sourceDocument}.`);
    console.log(`Assigned ${placements.size} fixed-space decimal addresses.`);
    console.log(
      `Knowledge edges: ${edgeSummary.rows[0].total} total, ` +
      `${edgeSummary.rows[0].resolved} resolved, ${edgeSummary.rows[0].unresolved} retained by name.`
    );
    console.log('No runtime evaluations, approved graph records, or user history were changed.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function validateKnowledge(value) {
  if (value?.kind !== 'chromabridge_color_knowledge') throw new Error('Unexpected knowledge file kind.');
  if (!Array.isArray(value.records) || value.records.length !== value.recordCount) {
    throw new Error('Knowledge record count does not match the records array.');
  }
  for (const record of value.records) {
    if (!record.id || !record.name || !record.tier || !record.coordinates) {
      throw new Error('Knowledge record is missing required core fields.');
    }
  }
}

function relationshipEdges(record, relationType, values, sourceDocument) {
  return values.map((targetName, index) => ({
    id: `cbke-${crypto.createHash('sha256')
      .update(`${record.id}|${relationType}|${normalize(targetName)}|${index}`)
      .digest('hex')
      .slice(0, 24)}`,
    sourceId: record.id,
    relationType,
    targetName,
    normalizedTargetName: normalize(targetName),
    evidence: {
      source: sourceDocument,
      page: record.provenance.page,
      row: record.provenance.row,
      extractionConfidence: record.provenance.relationshipExtractionConfidence,
      boundary: 'Imported reference knowledge; not a memory or approved semantic commit.'
    },
    sourceDocument
  }));
}

function normalize(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ');
}

function toDatabaseKeys(value) {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`), item])
  );
}

function* batches(values, size) {
  for (let index = 0; index < values.length; index += size) {
    yield values.slice(index, index + size);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
