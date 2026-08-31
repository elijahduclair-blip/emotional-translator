import unittest

from verify_color_knowledge import expected_semantic_code, verify


def record(name="Danger", semantic_code="D06400", parents=None):
    return {
        "tier": "base",
        "name": name,
        "hexColor": "#EF5350",
        "semanticCode": semantic_code,
        "coordinates": {"x": 160, "y": 100, "z": -150},
        "parents": parents or [],
        "synonyms": [],
        "opposites": [],
        "semanticLabels": ["canonical-anchor"],
        "provenance": {
            "page": 1,
            "row": 1,
            "relationshipExtractionConfidence": "high",
        },
    }


def knowledge(records):
    return {
        "recordCount": len(records),
        "source": {"document": "Color Nodes.pdf", "sha256": "abc", "pageCount": 1},
        "records": records,
    }


class VeraColorKnowledgeTests(unittest.TestCase):
    def test_semantic_code_formula_matches_anchor(self):
        self.assertEqual(expected_semantic_code({"x": 160, "y": 100, "z": -150}), "D06400")

    def test_valid_export_is_structurally_verified_without_semantic_authority(self):
        receipt = verify(knowledge([record()]))
        self.assertEqual(receipt["decision"]["structuralVerification"], "verified")
        self.assertEqual(receipt["decision"]["semanticVerification"], "needs_independent_evidence")
        self.assertFalse(receipt["decision"]["graphMutationAllowed"])

    def test_semantic_code_mismatch_blocks_export(self):
        receipt = verify(knowledge([record(semantic_code="000000")]))
        self.assertEqual(receipt["decision"]["status"], "blocked")
        self.assertEqual(receipt["checks"]["semanticCodeFormulaMismatches"], 1)

    def test_duplicate_and_unresolved_parent_require_review(self):
        records = [record(parents=["Missing Anchor"]), record(parents=["Missing Anchor"])]
        records[1]["provenance"] = {**records[1]["provenance"], "row": 2}
        receipt = verify(knowledge(records))
        self.assertEqual(receipt["decision"]["status"], "review_required")
        self.assertEqual(receipt["checks"]["exactDuplicateRows"], 1)
        self.assertEqual(receipt["checks"]["relationships"]["parents"]["unresolvedInsideExport"], 2)


if __name__ == "__main__":
    unittest.main()
