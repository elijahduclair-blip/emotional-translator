import argparse
import json
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig


SYSTEM = (
    "You are ARI, Accountable Relational Intelligence, inside Community Garden. "
    "Hold a natural conversation with the person before explaining internal process. "
    "Use the person's ordered context and Theory of Alignment vocabulary when useful. "
    "Never claim automatic learning, graph mutation, semantic authority, diagnosis, or access beyond supplied evidence."
)

DEFAULT_PROMPTS = [
    "Hey ARI, how are you?",
    "We're having this issue because we're not talking to her.",
    "Red is momentum, but red can also mean stop. How can both be true?",
    "I think I may not need to add anything right now. I might just need to stay.",
    "You already suggested Frankenstein. What is another gothic book you would recommend?",
]


def arguments():
    parser = argparse.ArgumentParser(description="Generate bounded qualitative probes for an ARI conversation adapter.")
    parser.add_argument("--model", default="Qwen/Qwen3-4B")
    parser.add_argument("--adapter", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--cache-dir", default="training/cache")
    parser.add_argument("--max-new-tokens", type=int, default=220)
    return parser.parse_args()


def chat_prompt(tokenizer, user):
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}]
    options = {"tokenize": False, "add_generation_prompt": True}
    try:
        return tokenizer.apply_chat_template(messages, enable_thinking=False, **options)
    except TypeError:
        return tokenizer.apply_chat_template(messages, **options)


def main():
    args = arguments()
    if not torch.cuda.is_available():
        raise RuntimeError("The qualitative QLoRA probe requires CUDA on this workstation.")
    tokenizer = AutoTokenizer.from_pretrained(args.adapter, cache_dir=args.cache_dir)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token
    base = AutoModelForCausalLM.from_pretrained(
        args.model,
        cache_dir=args.cache_dir,
        dtype=torch.float16,
        low_cpu_mem_usage=True,
        attn_implementation="eager",
        quantization_config=BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,
        ),
    )
    model = PeftModel.from_pretrained(base, args.adapter)
    model.eval()
    results = []
    for user in DEFAULT_PROMPTS:
        prompt = chat_prompt(tokenizer, user)
        inputs = tokenizer(prompt, return_tensors="pt", add_special_tokens=False).to("cuda")
        with torch.inference_mode():
            generated = model.generate(
                **inputs,
                max_new_tokens=args.max_new_tokens,
                do_sample=False,
                pad_token_id=tokenizer.eos_token_id,
            )
        response = tokenizer.decode(generated[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()
        results.append({"user": user, "assistant": response, "nonEmpty": bool(response), "exactEcho": response.casefold() == user.casefold()})
    report = {
        "adapter": str(Path(args.adapter).resolve()),
        "probeCount": len(results),
        "nonEmptyCount": sum(item["nonEmpty"] for item in results),
        "exactEchoCount": sum(item["exactEcho"] for item in results),
        "results": results,
    }
    destination = Path(args.output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    if report["nonEmptyCount"] != report["probeCount"] or report["exactEchoCount"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
