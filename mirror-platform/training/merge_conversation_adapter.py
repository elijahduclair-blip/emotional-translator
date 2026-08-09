import argparse
import hashlib
import json
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


def parse_args():
    parser = argparse.ArgumentParser(
        description="Merge a validated Mirror conversational LoRA into a deployable copy of its exact base model."
    )
    parser.add_argument("--model", required=True, help="Exact Hugging Face base model used for training.")
    parser.add_argument("--adapter", required=True, help="Validated PEFT adapter directory.")
    parser.add_argument("--output", required=True, help="Destination for merged Safetensors weights.")
    parser.add_argument("--cache-dir", required=True, help="Hugging Face cache directory.")
    parser.add_argument("--max-shard-size", default="4GB")
    return parser.parse_args()


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    args = parse_args()
    adapter_path = Path(args.adapter).resolve()
    output_path = Path(args.output).resolve()
    cache_path = Path(args.cache_dir).resolve()

    if not (adapter_path / "adapter_model.safetensors").is_file():
        raise FileNotFoundError(f"Missing PEFT weights: {adapter_path / 'adapter_model.safetensors'}")
    if output_path.exists() and any(output_path.iterdir()):
        raise RuntimeError(f"Refusing to overwrite non-empty output directory: {output_path}")

    output_path.mkdir(parents=True, exist_ok=True)
    tokenizer = AutoTokenizer.from_pretrained(args.model, cache_dir=str(cache_path))
    base_model = AutoModelForCausalLM.from_pretrained(
        args.model,
        cache_dir=str(cache_path),
        dtype=torch.float16,
        device_map="cpu",
        low_cpu_mem_usage=True,
        attn_implementation="eager",
    )
    adapted_model = PeftModel.from_pretrained(base_model, str(adapter_path), is_trainable=False)
    merged_model = adapted_model.merge_and_unload(safe_merge=True)
    merged_model.save_pretrained(
        str(output_path),
        safe_serialization=True,
        max_shard_size=args.max_shard_size,
    )
    tokenizer.save_pretrained(str(output_path))

    weight_files = sorted(output_path.glob("*.safetensors"))
    if not weight_files:
        raise RuntimeError("The merged model did not produce Safetensors weights.")

    report = {
        "status": "merged",
        "baseModel": args.model,
        "adapterPath": str(adapter_path),
        "adapterSha256": sha256_file(adapter_path / "adapter_model.safetensors"),
        "outputPath": str(output_path),
        "dtype": "float16",
        "weightFiles": [
            {
                "name": weight_file.name,
                "bytes": weight_file.stat().st_size,
                "sha256": sha256_file(weight_file),
            }
            for weight_file in weight_files
        ],
        "boundary": {
            "baseWeightsChanged": False,
            "adapterWeightsChanged": False,
            "derivedDeploymentCopyCreated": True,
            "semanticAuthorityGranted": False,
            "graphMutationAllowed": False,
        },
    }
    (output_path / "merge_report.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
