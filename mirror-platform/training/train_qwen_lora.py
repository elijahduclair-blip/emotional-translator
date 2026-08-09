import argparse
import importlib.util
import inspect
import json
import math
import random
from pathlib import Path

import torch
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from torch.utils.data import Dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, Trainer, TrainingArguments


class ConversationDataset(Dataset):
    def __init__(self, path, tokenizer, max_length):
        self.examples = []
        self.skipped = []
        for line_number, line in enumerate(Path(path).read_text(encoding="utf-8").splitlines(), 1):
            if not line.strip():
                continue
            record = json.loads(line)
            encoded = encode_conversation(record, tokenizer, max_length)
            if encoded is None:
                self.skipped.append({"line": line_number, "id": record.get("id"), "task": record.get("task")})
            else:
                self.examples.append(encoded)
        if not self.examples:
            raise ValueError(f"No trainable examples remained in {path}.")

    def __len__(self):
        return len(self.examples)

    def __getitem__(self, index):
        return self.examples[index]


class CompletionCollator:
    def __init__(self, pad_token_id):
        self.pad_token_id = pad_token_id

    def __call__(self, examples):
        width = max(len(example["input_ids"]) for example in examples)
        input_ids, attention_mask, labels = [], [], []
        for example in examples:
            padding = width - len(example["input_ids"])
            input_ids.append(example["input_ids"] + [self.pad_token_id] * padding)
            attention_mask.append([1] * len(example["input_ids"]) + [0] * padding)
            labels.append(example["labels"] + [-100] * padding)
        return {
            "input_ids": torch.tensor(input_ids, dtype=torch.long),
            "attention_mask": torch.tensor(attention_mask, dtype=torch.long),
            "labels": torch.tensor(labels, dtype=torch.long),
        }


def apply_chat_template(tokenizer, messages, add_generation_prompt):
    options = {"tokenize": False, "add_generation_prompt": add_generation_prompt}
    try:
        return tokenizer.apply_chat_template(messages, enable_thinking=False, **options)
    except TypeError:
        return tokenizer.apply_chat_template(messages, **options)


def encode_conversation(record, tokenizer, max_length):
    messages = record["messages"]
    if len(messages) < 2 or messages[-1]["role"] != "assistant":
        raise ValueError(f"Record {record.get('id')} does not end with an assistant message.")
    prompt_text = apply_chat_template(tokenizer, messages[:-1], True)
    full_text = apply_chat_template(tokenizer, messages, False)
    prompt_ids = tokenizer(prompt_text, add_special_tokens=False)["input_ids"]
    full_ids = tokenizer(full_text, add_special_tokens=False)["input_ids"]
    assistant_ids = full_ids[len(prompt_ids):]
    if not assistant_ids or len(assistant_ids) >= max_length:
        return None
    prompt_budget = max_length - len(assistant_ids)
    kept_prompt = prompt_ids[-prompt_budget:]
    input_ids = kept_prompt + assistant_ids
    return {
        "input_ids": input_ids,
        "labels": [-100] * len(kept_prompt) + assistant_ids,
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Train a bounded Qwen3 LoRA adapter on verified Mirror Platform lessons.")
    parser.add_argument("--model", default="Qwen/Qwen3-0.6B")
    parser.add_argument("--adapter", help="Optional existing PEFT adapter to continue training.")
    parser.add_argument("--train", default="training/data/train-rules.jsonl")
    parser.add_argument("--validation", default="training/data/validation-rules.jsonl")
    parser.add_argument("--output", default="training/output/qwen3-0.6b-alignment")
    parser.add_argument("--cache-dir", default="training/cache")
    parser.add_argument(
        "--qlora",
        action="store_true",
        help="Load the base model in trainable NF4 4-bit form for memory-efficient LoRA training.",
    )
    parser.add_argument("--max-length", type=int, default=768)
    parser.add_argument("--epochs", type=float, default=3.0)
    parser.add_argument("--max-steps", type=int, default=-1)
    parser.add_argument("--gradient-accumulation", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    parser.add_argument("--seed", type=int, default=20260803)
    return parser.parse_args()


def main():
    args = parse_args()
    random.seed(args.seed)
    torch.manual_seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    if args.qlora and device != "cuda":
        raise RuntimeError("--qlora requires a CUDA GPU.")
    if args.qlora and importlib.util.find_spec("bitsandbytes") is None:
        raise RuntimeError("--qlora requires bitsandbytes; install training/requirements.txt first.")
    dtype = torch.float16 if device == "cuda" else torch.float32
    tokenizer = AutoTokenizer.from_pretrained(args.model, cache_dir=args.cache_dir)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token

    train_dataset = ConversationDataset(args.train, tokenizer, args.max_length)
    validation_dataset = ConversationDataset(args.validation, tokenizer, args.max_length)
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
    base_model = AutoModelForCausalLM.from_pretrained(args.model, **model_load_kwargs)
    base_model.config.use_cache = False
    if args.qlora:
        base_model = prepare_model_for_kbit_training(base_model, use_gradient_checkpointing=True)
    else:
        base_model.gradient_checkpointing_enable()
        base_model.enable_input_require_grads()
    if args.adapter:
        from peft import PeftModel
        model = PeftModel.from_pretrained(base_model, args.adapter, is_trainable=True)
    else:
        model = get_peft_model(base_model, LoraConfig(
            r=4,
            lora_alpha=8,
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM",
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        ))
    model.print_trainable_parameters()

    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    training_kwargs = dict(
        output_dir=str(output),
        num_train_epochs=args.epochs,
        max_steps=args.max_steps,
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=args.gradient_accumulation,
        learning_rate=args.learning_rate,
        warmup_ratio=0.05,
        logging_steps=1,
        save_strategy="no",
        fp16=device == "cuda",
        bf16=False,
        gradient_checkpointing=True,
        report_to="none",
        remove_unused_columns=False,
        dataloader_num_workers=0,
        seed=args.seed,
    )
    if args.qlora:
        training_kwargs["optim"] = "paged_adamw_8bit"
    parameter_names = inspect.signature(TrainingArguments).parameters
    training_kwargs["eval_strategy" if "eval_strategy" in parameter_names else "evaluation_strategy"] = "no"
    training_args = TrainingArguments(**training_kwargs)
    trainer_kwargs = dict(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=validation_dataset,
        data_collator=CompletionCollator(tokenizer.pad_token_id),
    )
    if "processing_class" in inspect.signature(Trainer).parameters:
        trainer_kwargs["processing_class"] = tokenizer
    else:
        trainer_kwargs["tokenizer"] = tokenizer
    trainer = Trainer(**trainer_kwargs)
    train_result = trainer.train()
    eval_result = trainer.evaluate()
    trainer.save_model(str(output))
    tokenizer.save_pretrained(str(output))

    report = {
        "status": "trained",
        "baseModel": args.model,
        "continuedFromAdapter": args.adapter,
        "device": device,
        "gpu": torch.cuda.get_device_name(0) if device == "cuda" else None,
        "quantization": "nf4_4bit_double_quant" if args.qlora else "none",
        "modelMemoryFootprintBytes": base_model.get_memory_footprint(),
        "peakGpuMemoryAllocatedBytes": torch.cuda.max_memory_allocated() if device == "cuda" else 0,
        "cacheDir": str(Path(args.cache_dir).resolve()),
        "maxLength": args.max_length,
        "epochs": args.epochs,
        "maxSteps": args.max_steps,
        "trainingExamples": len(train_dataset),
        "validationExamples": len(validation_dataset),
        "skippedTrainingExamples": train_dataset.skipped,
        "skippedValidationExamples": validation_dataset.skipped,
        "trainMetrics": train_result.metrics,
        "evalMetrics": eval_result,
        "evalPerplexity": math.exp(eval_result["eval_loss"]) if eval_result.get("eval_loss", 100) < 20 else None,
        "boundary": {
            "baseWeightsChanged": False,
            "adapterWeightsChanged": True,
            "semanticAuthorityGranted": False,
            "graphMutationAllowed": False,
        },
    }
    (output / "training_report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
