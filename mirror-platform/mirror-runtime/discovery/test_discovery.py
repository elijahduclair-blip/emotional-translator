def test_discovery_scaffold_exists() -> None:
    import discovery.embeddings
    import discovery.inference
    import discovery.proposal_model
    import discovery.train

    assert discovery.embeddings is not None
    assert discovery.inference is not None
    assert discovery.proposal_model is not None
    assert discovery.train is not None