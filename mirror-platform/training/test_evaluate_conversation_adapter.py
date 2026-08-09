import unittest

from training.evaluate_conversation_adapter import has_evidence_count_mismatch, has_unsupported_graph_claim


class ConversationContractValidationTests(unittest.TestCase):
    def test_negated_connection_language_is_not_a_claim(self):
        text = "No graph route has been supplied to connect this input to another node or relationship."
        self.assertFalse(has_unsupported_graph_claim(text, 0))

    def test_positive_connection_without_routes_is_rejected(self):
        self.assertTrue(has_unsupported_graph_claim("This input is connected to identity.", 0))

    def test_positive_connection_is_allowed_when_routes_are_confirmed(self):
        self.assertFalse(has_unsupported_graph_claim("This input is connected to identity.", 2))

    def test_evidence_counts_must_match_the_supplied_summary(self):
        self.assertFalse(has_evidence_count_mismatch("12 matched nodes and 24 confirmed routes.", 12, 24))
        self.assertTrue(has_evidence_count_mismatch("8 matched nodes and 24 confirmed routes.", 12, 24))


if __name__ == "__main__":
    unittest.main()
