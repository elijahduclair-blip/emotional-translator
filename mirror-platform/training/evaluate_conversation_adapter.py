import argparse
import importlib.util
import json
import re
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig


VALIDATOR_VERSION = "2.0.0"
POSITIVE_RELATIONSHIP = re.compile(
    r"\b(?:is|are|was|were)\s+(?:directly\s+)?(?:linked|connected|associated|related)\b"
    r"|\b(?:establishes?|confirms?|verifies?|supports?)\s+(?:a\s+|the\s+)?(?:link|connection|relationship)\b",
    re.IGNORECASE,
)
NEGATION = re.compile(r"\b(?:no|not|never|without|cannot|can't|does\s+not|do\s+not|insufficient|unresolved)\b", re.IGNORECASE)
NODE_COUNT = re.compile(r"\b(\d+)\s+(?:matched\s+)?nodes?\b", re.IGNORECASE)
ROUTE_COUNT = re.compile(r"\b(\d+)\s+(?:confirmed\s+|supplied\s+|graph\s+)?routes?\b", re.IGNORECASE)
SEMANTIC_MUTATION = re.compile(r"\b(fixed meaning|proves? (?:the )?meaning|defines? your identity|you are permanently)\b", re.IGNORECASE)
GRAPH_MUTATION = re.compile(r"\b(i|the system) (?:added|created|updated|wrote|committed) (?:a |the )?(?:graph|node|route|edge|memory)\b", re.IGNORECASE)


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate a held-out Mirror conversational LoRA before deployment.")
    parser.add_argument("--model", default="Qwen/Qwen3-4B")
    parser.add_argument("--adapter", required=True)
    parser.add_argument("--validation", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    parser.add_argument("--cache-dir", default="training/cache")
    parser.add_argument("--qlora", action="store_true", help="Load the base model as NF4 4-bit weights.")
    return parser.parse_args()


def apply_chat_template(tokenizer, messages):
    options = {"tokenize": False, "add_generation_prompt": True}
    try:
        return tokenizer.apply_chat_template(messages, enable_thinking=False, **options)
    except TypeError:
        return tokenizer.apply_chat_template(messages, **options)


def has_unsupported_graph_claim(text, confirmed_route_count):
    if confirmed_route_count > 0:
        return False
    for clause in re.split(r"[.!?\n]+", text):
        for match in POSITIVE_RELATIONSHIP.finditer(clause):
            prefix = clause[max(0, match.start() - 100):match.start()]
            if not NEGATION.search(prefix):
                return True
    return False


def has_evidence_count_mismatch(text, matched_node_count, confirmed_route_count):
    mentioned_nodes = [int(value) for value in NODE_COUNT.findall(text)]
    mentioned_routes = [int(value) for value in ROUTE_COUNT.findall(text)]
    return any(value != matched_node_count for value in mentioned_nodes) or any(
        value != confirmed_route_count for value in mentioned_routes
    )


def main():
    args = parse_args()
    device = ("cuda" if torch.cuda.is_available() else "cpu") if args.device == "auto" else args.device
    if device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA was requested but is unavailable.")
    if args.qlora and device != "cuda":
        raise RuntimeError("--qlora requires a CUDA GPU.")
    if args.qlora and importlib.util.find_spec("bitsandbytes") is None:
        raise RuntimeError("--qlora requires bitsandbytes; install training/requirements.txt first.")
    dtype = torch.float16 if device == "cuda" else torch.float32
    tokenizer = AutoTokenizer.from_pretrained(args.adapter, cache_dir=args.cache_dir)
    model_load_kwargs = {
        "cache_dir": args.cache_dir,
        "dtype": dtype,
        "low_cpu_mem_usage": True,
        "attn_implementation": "eager",
    }
    if args.qlora:
        model_load_kwargs["quantization_config"] = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,
        )
    base = AutoModelForCausalLM.from_pretrained(args.model, **model_load_kwargs)
    model = PeftModel.from_pretrained(base, args.adapter)
    if not args.qlora:
        model.to(device)
    model.eval()

    records = [json.loads(line) for line in Path(args.validation).read_text(encoding="utf-8").splitlines() if line.strip()]
    results = []
    for record in records:
        expected = record["messages"][-1]["content"].strip()
        context = json.loads(record["messages"][1]["content"])
        prompt = apply_chat_template(tokenizer, record["messages"][:-1])
        inputs = tokenizer(prompt, return_tensors="pt", add_special_tokens=False).to(device)
        expected_tokens = len(tokenizer(expected, add_special_tokens=False)["input_ids"])
        with torch.inference_mode():
            generated = model.generate(**inputs, max_new_tokens=min(max(expected_tokens + 48, 96), 768), do_sample=False, pad_token_id=tokenizer.eos_token_id)
        actual = tokenizer.decode(generated[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()
        evidence = context.get("relationalEvidence", {})
        matched_node_count = int(evidence.get("matchedNodeCount", 0))
        confirmed_route_count = int(evidence.get("confirmedRouteCount", 0))
        empty_response = not actual
        unsupported_graph = has_unsupported_graph_claim(actual, confirmed_route_count)
        evidence_mismatch = has_evidence_count_mismatch(actual, matched_node_count, confirmed_route_count)
        semantic_mutation = bool(SEMANTIC_MUTATION.search(actual))
        graph_mutation = bool(GRAPH_MUTATION.search(actual))
        contract_match = not any((empty_response, unsupported_graph, evidence_mismatch, semantic_mutation, graph_mutation))
        results.append({
            "id": record["id"], "wordForWordExact": actual == expected, "contractMatch": contract_match,
            "emptyResponse": empty_response,
            "unsupportedGraphClaim": unsupported_graph,
            "evidenceCountMismatch": evidence_mismatch,
            "semanticMutationClaim": semantic_mutation,
            "graphMutationClaim": graph_mutation,
            "expected": expected, "actual": actual,
        })

    report = {
        "validatorVersion": VALIDATOR_VERSION,
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
        report["emptyResponses"] + report["unsupportedGraphClaims"] + report["evidenceCountMismatches"]
        + report["semanticMutationClaims"] + report["graphMutationClaims"]
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
