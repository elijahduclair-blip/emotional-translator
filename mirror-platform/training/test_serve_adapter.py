import unittest

from training.serve_adapter import guarded_prompt


class GuardedPromptTests(unittest.TestCase):
    def test_transport_key_order_is_canonicalized_without_changing_values(self):
        request = {
            "computedEvidence": {
                "nearestCoordinateNeighbors": [
                    {"distance": 14.071247, "tier": "shade", "name": "Pomegranate", "id": "neighbor-1"}
                ],
                "method": "euclidean_coordinate_distance",
            },
            "origin": {
                "name": "Brown",
                "coordinates": {"z": 123, "x": 123, "y": 83},
                "tier": "base",
                "sourceRef": {
                    "row": 3,
                    "document": "ChromaBridge Export example.pdf",
                    "page": 1,
                    "extractionConfidence": "high",
                    "sha256": "source-hash",
                },
                "hexColor": "#A52A2A",
                "id": "brown",
            },
            "mode": "coordinate_evidence_boundary",
        }

        prompt, expected = guarded_prompt(request)

        self.assertEqual(list(prompt["origin"]), ["id", "tier", "name", "hexColor", "coordinates", "sourceRef"])
        self.assertEqual(list(prompt["origin"]["coordinates"]), ["x", "y", "z"])
        self.assertEqual(
            list(prompt["computedEvidence"]["nearestCoordinateNeighbors"][0]),
            ["id", "name", "tier", "distance"],
        )
        self.assertEqual(expected["nearestCoordinateNeighbors"][0]["distance"], 14.071247)
        self.assertFalse(expected["coordinateDistanceCreatesMeaning"])
        self.assertFalse(expected["semanticMutationAllowed"])
        self.assertFalse(expected["graphMutationAllowed"])

    def test_authority_boundary_never_grants_imported_anchor_authority(self):
        record = {
            "id": "amber",
            "tier": "base",
            "name": "Amber Glow",
            "hexColor": "#FFBF00",
            "coordinates": {"x": 255, "y": 191, "z": 0},
            "sourceRef": {
                "document": "ChromaBridge Export example.pdf",
                "sha256": "source-hash",
                "page": 1,
                "row": 1,
                "extractionConfidence": "high",
            },
        }
        _, expected = guarded_prompt({"mode": "authority_boundary", "record": record})
        self.assertEqual(expected["sourceLayer"], "chromabridge_knowledge")
        self.assertFalse(expected["importedTierIsCanonicalAnchor"])
        self.assertFalse(expected["semanticMutationAllowed"])


if __name__ == "__main__":
    unittest.main()
