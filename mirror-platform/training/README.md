# Local Qwen learning

This directory performs actual parameter-efficient learning. It is separate from the runtime context bridge.

The hardware target is this workstation's 4 GB NVIDIA GPU. Training therefore uses `Qwen/Qwen3-0.6B` with FP16 LoRA rank 4 and gradient checkpointing. The installed 4B Ollama quantization remains available for general inference but is not used as a training checkpoint.

## Dataset

Run from the `mirror-platform` directory:

```powershell
node training/export_dataset.mjs
```

The split is deterministic and source-row stratified. All lessons from one PDF row remain together, so validation never sees another task derived from a training row. `train-rules.jsonl` and `validation-rules.jsonl` teach generalizable imported-authority boundaries and preservation of coordinate evidence already calculated by deterministic code. Qwen is not trained to invent or calculate coordinates. `core` contains fact lookup and reverse lookup, while `all` additionally contains the longer six-dot structural tasks.

## Environment and training

Create `training/.venv`, install the official CUDA-enabled PyTorch wheel appropriate for Windows, then install `training/requirements.txt`. A bounded one-step smoke run is:

```powershell
training\.venv\Scripts\python.exe training\train_qwen_lora.py --max-steps 1
```

After that succeeds, the verified adapter was produced as two bounded stages:

```powershell
training\.venv\Scripts\python.exe training\train_qwen_lora.py --epochs 2 --output training\output\qwen3-0.6b-alignment
training\.venv\Scripts\python.exe training\train_qwen_lora.py --adapter training\output\qwen3-0.6b-alignment --epochs 1 --output training\output\qwen3-0.6b-alignment-v2
```

Evaluate held-out rows before and after training:

```powershell
training\.venv\Scripts\python.exe training\evaluate_qwen_adapter.py --limit 4 --output training\reports\base-evaluation.json
training\.venv\Scripts\python.exe training\evaluate_qwen_adapter.py --adapter training\output\qwen3-0.6b-alignment-v2 --output training\reports\adapter-v2-rules-evaluation-full.json
```

The v2 adapter must pass all 38 held-out generated responses exactly. Serve it locally with:

```powershell
training\.venv\Scripts\python.exe training\serve_adapter.py --device cpu
```

The server listens only on `127.0.0.1:11435`. `pnpm dev` starts it automatically and Mirror Runtime exposes a same-origin façade at `POST /local-ai/alignment/evaluate`. CPU is the default so the learned 0.6B model does not compete with the general 4B Ollama model for the 4 GB GPU.

Ollama 0.32.5 does not directly deploy this Qwen PEFT safetensor adapter; its documented safetensor adapter architectures currently omit Qwen. The platform therefore uses Transformers and PEFT directly instead of claiming a prompt-only Ollama model is trained.

Every generated response is parsed and compared with a deterministic expected boundary before it is returned. A mismatch returns HTTP 422. The adapter changes adapter weights only. It does not grant semantic authority, mutate graph records, turn coordinate distance into meaning, or rewrite the nine fixed compass anchors.

### Memory-efficient 4B training

On an NVIDIA GPU with limited VRAM, use QLoRA so the 4B base checkpoint is loaded as NF4 4-bit weights with nested quantization while only the LoRA parameters are trained. Keep the large model cache on a spacious drive:

```powershell
training\.venv\Scripts\python.exe training\train_qwen_lora.py --model Qwen/Qwen3-4B --qlora --cache-dir D:\mirror-model-cache --max-steps 1 --max-length 512 --output training\output\qwen3-4b-qlora-smoke
```

This smoke command verifies that the model loads and completes one bounded training step. It is not a quality evaluation or an activatable conversation-model version.

## Governed Qwen3 4B conversation adapter

Conversational corrections target a separate `conversation_lora` for `Qwen/Qwen3-4B`. They never continue training the 0.6B alignment verifier. The Governance room requires at least 20 administrator-accepted feedback records and reserves at least four records for deterministic held-out validation before it will prepare a version.

Download the prepared version package, then verify and unpack it:

```powershell
node training\prepare_conversation_package.mjs C:\path\to\qwen3-4b-conversation-training-package.json
```

Train on a machine capable of loading the non-quantized Qwen3 4B checkpoint and optimizer state:

```powershell
training\.venv\Scripts\python.exe training\train_qwen_lora.py --model Qwen/Qwen3-4B --qlora --cache-dir D:\mirror-model-cache --train training\data\conversation-DIGEST\train.jsonl --validation training\data\conversation-DIGEST\validation.jsonl --output training\output\qwen3-4b-conversation-VERSION
training\.venv\Scripts\python.exe training\evaluate_conversation_adapter.py --model Qwen/Qwen3-4B --adapter training\output\qwen3-4b-conversation-VERSION --validation training\data\conversation-DIGEST\validation.jsonl --output training\reports\qwen3-4b-conversation-VERSION.json --qlora --cache-dir D:\mirror-model-cache
```

This workstation now has an 8 GB RTX 3070 and 32 GB of system RAM. A bounded Qwen3-4B QLoRA run has been verified locally; the older non-quantized FP16 4B training path is still not considered safe within 8 GB of VRAM. The resulting artifact must be reported, pass every held-out response contract with zero boundary violations, be merged into a copy of the exact training base, be imported into Ollama, and pass a live Ollama probe. Word-for-word equality is recorded as a diagnostic, not used as the conversational acceptance rule. Only then can an administrator activate it. Mirror Runtime reads only the active, deployment-verified version and falls back to `qwen3:4b-instruct` if that model becomes unavailable.

Create a deployment copy without changing the downloaded base or validated adapter:

```powershell
python training/merge_conversation_adapter.py `
  --model Qwen/Qwen3-4B `
  --adapter training/output/qwen3-4b-conversation-20260809-v1 `
  --output D:/mirror-model-deploy/qwen3-4b-conversation-20260809-v2 `
  --cache-dir D:/mirror-model-cache

python D:/mirror-tools/llama.cpp/convert_hf_to_gguf.py `
  D:/mirror-model-deploy/qwen3-4b-conversation-20260809-v2 `
  --outfile D:/mirror-model-deploy/qwen3-4b-conversation-20260809-v2/mirror-qwen3-conversation-v2-q8_0.gguf `
  --outtype q8_0 `
  --model-name mirror-qwen3-conversation-v2

ollama create mirror-qwen3-conversation:v2 `
  --file training/Modelfile.qwen3-conversation-v2

training\.venv\Scripts\python.exe training\evaluate_ollama_conversation.py `
  --model mirror-qwen3-conversation:v2 `
  --validation training\data\conversation-7f551e17f48d\validation.jsonl `
  --output training\reports\qwen3-4b-conversation-20260809-v2-ollama.json
```
