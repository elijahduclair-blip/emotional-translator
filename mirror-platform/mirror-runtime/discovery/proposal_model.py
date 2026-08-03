"""
proposal_model.py

Module to define lightweight proposal/ranker models used by the runtime. Keep model classes small and serializable.
"""


class ProposalModel:
    def __init__(self):
        # placeholder for model parameters
        self.params = {}

    def score(self, context, candidate):
        """Return a score for a candidate given context."""
        # TODO: implement scoring
        return 0.0


if __name__ == "__main__":
    m = ProposalModel()
    print(m.score(None, None))
