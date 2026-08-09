import argparse
import json
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


def parse_args():
    parser = argparse.ArgumentParser(description="Measure exact held-out outputs for a Mirror Platform Qwen adapter.")
    parser.add_argument("--model", default="Qwen/Qwen3-0.6B")
    parser.add_argument("--adapter")
    parser.add_argument("--validation", default="training/data/validation-rules.jsonl")
    parser.add_argument("--output", default="training/reports/adapter-evaluation.json")
    parser.add_argument("--limit", type=int, default=0)
    return parser.parse_args()


def apply_chat_template(tokenizer, messages):
    options = {"tokenize": False, "add_generation_prompt": True}
    try:
        return tokenizer.apply_chat_template(messages, enable_thinking=False, **options)
    except TypeError:
        return tokenizer.apply_chat_template(messages, **options)


def main():
    args = parse_args()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device == "cuda" else torch.float32
    tokenizer_source = args.adapter or args.model
    tokenizer = AutoTokenizer.from_pretrained(tokenizer_source, cache_dir="training/cache")
    model = AutoModelForCausalLM.from_pretrained(
        args.model,
        cache_dir="training/cache",
        dtype=dtype,
        low_cpu_mem_usage=True,
        attn_implementation="eager",
    )
    if args.adapter:
        model = PeftModel.from_pretrained(model, args.adapter)
    model.to(device)
    model.eval()

    records = [json.loads(line) for line in Path(args.validation).read_text(encoding="utf-8").splitlines() if line.strip()]
    if args.limit > 0:
        records = records[:args.limit]
    results = []
    for record in records:
        expected = record["messages"][-1]["content"]
        prompt = apply_chat_template(tokenizer, record["messages"][:-1])
        inputs = tokenizer(prompt, return_tensors="pt", add_special_tokens=False).to(device)
        expected_tokens = len(tokenizer(expected, add_special_tokens=False)["input_ids"])
        with torch.inference_mode():
            generated = model.generate(
                **inputs,
                max_new_tokens=min(max(expected_tokens + 32, 64), 768),
                do_sample=False,
                pad_token_id=tokenizer.eos_token_id,
            )
        actual = tokenizer.decode(generated[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()
        exact = actual == expected
        try:
            json_equivalent = json.loads(actual) == json.loads(expected)
        except (json.JSONDecodeError, TypeError):
            json_equivalent = False
        results.append({
            "id": record["id"],
            "task": record["task"],
            "exact": exact,
            "jsonEquivalent": json_equivalent,
            "expected": expected,
            "actual": actual,
        })

    report = {
        "baseModel": args.model,
        "adapter": args.adapter,
        "device": device,
        "examples": len(results),
        "exactMatches": sum(item["exact"] for item in results),
        "jsonEquivalentMatches": sum(item["jsonEquivalent"] for item in results),
        "byTask": task_summary(results),
        "results": results,
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "results"}, indent=2))


def task_summary(results):
    summary = {}
    for item in results:
        current = summary.setdefault(item["task"], {"examples": 0, "exactMatches": 0, "jsonEquivalentMatches": 0})
        current["examples"] += 1
        current["exactMatches"] += int(item["exact"])
        current["jsonEquivalentMatches"] += int(item["jsonEquivalent"])
    return summary


if __name__ == "__main__":
    main()
