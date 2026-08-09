import argparse
import json
import urllib.error
import urllib.request
from pathlib import Path

from evaluate_conversation_adapter import (
    GRAPH_MUTATION,
    SEMANTIC_MUTATION,
    VALIDATOR_VERSION,
    has_evidence_count_mismatch,
    has_unsupported_graph_claim,
)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Evaluate an Ollama-served Mirror conversation model against held-out contracts."
    )
    parser.add_argument("--model", required=True)
    parser.add_argument("--validation", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--ollama-url", default="http://127.0.0.1:11434")
    parser.add_argument("--timeout", type=int, default=240)
    return parser.parse_args()


def chat(ollama_url, model, messages, timeout):
    payload = json.dumps(
        {
            "model": model,
            "stream": False,
            "think": False,
            "messages": messages,
            "options": {"temperature": 0, "num_ctx": 4096, "num_predict": 768},
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{ollama_url.rstrip('/')}/api/chat",
        data=payload,
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Ollama returned HTTP {error.code}: {detail}") from error


def main():
    args = parse_args()
    records = [
        json.loads(line)
        for line in Path(args.validation).read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    results = []
    for record in records:
        expected = record["messages"][-1]["content"].strip()
        context = json.loads(record["messages"][1]["content"])
        response = chat(args.ollama_url, args.model, record["messages"][:-1], args.timeout)
        actual = str(response.get("message", {}).get("content", "")).strip()
        evidence = context.get("relationalEvidence", {})
        matched_node_count = int(evidence.get("matchedNodeCount", 0))
        confirmed_route_count = int(evidence.get("confirmedRouteCount", 0))
        empty_response = not actual
        unsupported_graph = has_unsupported_graph_claim(actual, confirmed_route_count)
        evidence_mismatch = has_evidence_count_mismatch(actual, matched_node_count, confirmed_route_count)
        semantic_mutation = bool(SEMANTIC_MUTATION.search(actual))
        graph_mutation = bool(GRAPH_MUTATION.search(actual))
        contract_match = not any(
            (empty_response, unsupported_graph, evidence_mismatch, semantic_mutation, graph_mutation)
        )
        results.append(
            {
                "id": record["id"],
                "wordForWordExact": actual == expected,
                "contractMatch": contract_match,
                "emptyResponse": empty_response,
                "unsupportedGraphClaim": unsupported_graph,
                "evidenceCountMismatch": evidence_mismatch,
                "semanticMutationClaim": semantic_mutation,
                "graphMutationClaim": graph_mutation,
                "expected": expected,
                "actual": actual,
                "timings": {
                    "totalDurationNanoseconds": response.get("total_duration"),
                    "loadDurationNanoseconds": response.get("load_duration"),
                    "promptTokens": response.get("prompt_eval_count"),
                    "responseTokens": response.get("eval_count"),
                },
            }
        )

    report = {
        "validatorVersion": VALIDATOR_VERSION,
        "provider": "ollama",
        "modelName": args.model,
        "heldOutExamples": len(results),
        "contractMatches": sum(item["contractMatch"] for item in results),
        "wordForWordMatches": sum(item["wordForWordExact"] for item in results),
        "exactMatches": sum(item["wordForWordExact"] for item in results),
        "emptyResponses": sum(item["emptyResponse"] for item in results),
        "unsupportedGraphClaims": sum(item["unsupportedGraphClaim"] for item in results),
        "evidenceCountMismatches": sum(item["evidenceCountMismatch"] for item in results),
        "semanticMutationClaims": sum(item["semanticMutationClaim"] for item in results),
        "graphMutationClaims": sum(item["graphMutationClaim"] for item in results),
    }
    report["boundaryViolations"] = (
        report["emptyResponses"]
        + report["unsupportedGraphClaims"]
        + report["evidenceCountMismatches"]
        + report["semanticMutationClaims"]
        + report["graphMutationClaims"]
    )
    report["passed"] = (
        report["heldOutExamples"] >= 4
        and report["contractMatches"] == report["heldOutExamples"]
        and report["boundaryViolations"] == 0
    )
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({**report, "results": results}, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
