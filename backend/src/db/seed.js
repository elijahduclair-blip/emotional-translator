import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function seed() {
  try {
    console.log('?? Seeding database...');

    const jsonPath = path.join(__dirname, '../../../data/color-synonyms.json');
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`color-synonyms.json not found at ${jsonPath}`);
    }

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, ''));

    if (data.graph?.nodes) {
      console.log(`  ?? Inserting ${data.graph.nodes.length} nodes...`);
      for (const node of data.graph.nodes) {
        await query(
          `INSERT INTO nodes (id, label, type, family, hex_color, metadata) 
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             label = EXCLUDED.label,
             type = EXCLUDED.type,
             family = EXCLUDED.family,
             hex_color = EXCLUDED.hex_color,
             metadata = EXCLUDED.metadata`,
          [
            node.id,
            node.label,
            node.type,
            node.family || null,
            node.hex_color || null,
            node.metadata ? JSON.stringify(node.metadata) : null
          ]
        );
      }
    }

    if (data.themeComposition?.themes) {
      console.log(`  ?? Inserting ${data.themeComposition.themes.length} theme nodes...`);
      for (const theme of data.themeComposition.themes) {
        await query(
          `INSERT INTO nodes (id, label, type, family, metadata)
           VALUES ($1, $2, 'theme', NULL, $3)
           ON CONFLICT (id) DO UPDATE SET
             label = EXCLUDED.label,
             type = 'theme',
             metadata = EXCLUDED.metadata`,
          [
            `theme-${theme.id}`,
            theme.label,
            JSON.stringify({
              category: theme.category,
              cues: theme.cues || [],
              baseClimate: theme.baseClimate,
              anchorIds: theme.anchorIds || [],
              emotionalLogic: theme.emotionalLogic,
              boundary: theme.boundary,
              source: 'themeComposition'
            })
          ]
        );
      }
    }

    if (data.graph?.edges) {
      console.log(`  ?? Inserting ${data.graph.edges.length} edges...`);
      for (const edge of data.graph.edges) {
        await query(
          `INSERT INTO edges (id, source, target, type, evidence, confidence) 
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             source = EXCLUDED.source,
             target = EXCLUDED.target,
             type = EXCLUDED.type,
             evidence = EXCLUDED.evidence,
             confidence = EXCLUDED.confidence`,
          [
            edge.id || `${edge.source}->${edge.target}:${edge.type}`,
            edge.source,
            edge.target,
            edge.type,
            edge.evidence || null,
            edge.confidence || null
          ]
        );
      }
    }

    console.log('? Seeding complete');
    process.exit(0);
  } catch (error) {
    console.error('? Seeding failed:', error);
    process.exit(1);
  }
}

seed();
