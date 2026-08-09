import argparse
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


ROOT = Path(__file__).resolve().parents[1]
SYSTEM_PROMPT = (
    "You are learning exact imported ChromaBridge reference knowledge. "
    "Return only the supplied JSON. Preserve source names, coordinates, order, and provenance. "
    "Never invent parents, semantic labels, emotional meaning, graph approval, or canonical compass anchors."
)
MAX_BODY_BYTES = 64 * 1024


def parse_args():
    parser = argparse.ArgumentParser(description="Serve the verified Mirror Alignment PEFT adapter locally.")
    parser.add_argument("--host", default=os.environ.get("ALIGNMENT_MODEL_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("ALIGNMENT_MODEL_PORT", "11435")))
    parser.add_argument("--model", default=os.environ.get("ALIGNMENT_BASE_MODEL", "Qwen/Qwen3-0.6B"))
    parser.add_argument(
        "--adapter",
        default=os.environ.get(
            "ALIGNMENT_ADAPTER_PATH",
            str(ROOT / "training" / "output" / "qwen3-0.6b-alignment-v2"),
        ),
    )
    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default=os.environ.get("ALIGNMENT_MODEL_DEVICE", "cpu"))
    return parser.parse_args()


class AlignmentEngine:
    def __init__(self, model_name: str, adapter_path: str, device_choice: str):
        adapter = Path(adapter_path).resolve()
        if not (adapter / "adapter_model.safetensors").is_file():
            raise FileNotFoundError(f"Alignment adapter weights were not found at {adapter}.")
        if not (adapter / "adapter_config.json").is_file():
            raise FileNotFoundError(f"Alignment adapter configuration was not found at {adapter}.")

        if device_choice == "auto":
            device_choice = "cuda" if torch.cuda.is_available() else "cpu"
        if device_choice == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("CUDA was requested for the alignment model but is unavailable.")

        self.model_name = model_name
        self.adapter_path = str(adapter)
        self.device = device_choice
        self.lock = threading.Lock()
        dtype = torch.float16 if self.device == "cuda" else torch.float32
        if self.device == "cpu":
            torch.set_num_threads(max(1, min(8, os.cpu_count() or 1)))

        self.tokenizer = AutoTokenizer.from_pretrained(adapter, local_files_only=True)
        base = AutoModelForCausalLM.from_pretrained(
            model_name,
            cache_dir=str(ROOT / "training" / "cache"),
            local_files_only=True,
            dtype=dtype,
            low_cpu_mem_usage=True,
            attn_implementation="eager",
        )
        self.model = PeftModel.from_pretrained(base, adapter, local_files_only=True)
        self.model.to(self.device)
        self.model.eval()
        self.validation = read_validation_summary()

    def health(self):
        return {
            "status": "ready",
            "provider": "transformers_peft",
            "model": self.model_name,
            "adapter": "qwen3-0.6b-alignment-v2",
            "device": self.device,
            "learned": True,
            "validation": self.validation,
            "boundary": {
                "semanticMutationAllowed": False,
                "graphMutationAllowed": False,
                "coordinateDistanceCreatesMeaning": False,
            },
        }

    def evaluate(self, request):
        prompt_payload, expected = guarded_prompt(request)
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": compact_json(prompt_payload)},
        ]
        template_options = {"tokenize": False, "add_generation_prompt": True}
        try:
            prompt = self.tokenizer.apply_chat_template(messages, enable_thinking=False, **template_options)
        except TypeError:
            prompt = self.tokenizer.apply_chat_template(messages, **template_options)
        inputs = self.tokenizer(prompt, return_tensors="pt", add_special_tokens=False).to(self.device)
        expected_text = compact_json(expected)
        expected_tokens = len(self.tokenizer(expected_text, add_special_tokens=False)["input_ids"])
        with self.lock, torch.inference_mode():
            generated = self.model.generate(
                **inputs,
                max_new_tokens=min(max(expected_tokens + 32, 64), 768),
                do_sample=False,
                pad_token_id=self.tokenizer.eos_token_id,
            )
        actual_text = self.tokenizer.decode(
            generated[0][inputs["input_ids"].shape[1]:],
            skip_special_tokens=True,
        ).strip()
        try:
            actual = json.loads(actual_text)
        except json.JSONDecodeError as error:
            raise ContractError(f"Learned model returned invalid JSON: {error.msg}.") from error
        if actual != expected:
            raise ContractError("Learned model output did not pass the deterministic alignment boundary check.")
        return {
            "engine": "mirror_learned_alignment",
            "model": {
                "provider": "transformers_peft",
                "base": self.model_name,
                "adapter": "qwen3-0.6b-alignment-v2",
                "local": True,
                "learned": True,
            },
            "mode": request["mode"],
            "result": actual,
            "contractVerified": True,
            "boundary": {
                "semanticMutationAllowed": False,
                "graphMutationAllowed": False,
                "coordinateDistanceCreatesMeaning": False,
                "reason": "The learned output was accepted only after exact deterministic boundary verification.",
            },
        }


class ContractError(ValueError):
    pass


def guarded_prompt(request):
    if not isinstance(request, dict):
        raise ValueError("Request body must be a JSON object.")
    mode = request.get("mode")
    if mode == "authority_boundary":
        record = canonical_record(require_object(request, "record"))
        return (
            {"task": "Classify the authority of this imported PDF color record.", "record": record},
            {
                "sourceLayer": "chromabridge_knowledge",
                "importedTierIsCanonicalAnchor": False,
                "coordinateDistanceCreatesMeaning": False,
                "semanticMutationAllowed": False,
                "graphMutationAllowed": False,
            },
        )
    if mode == "coordinate_evidence_boundary":
        origin = canonical_record(require_object(request, "origin"))
        supplied_evidence = require_object(request, "computedEvidence")
        evidence = canonical_evidence(supplied_evidence)
        if evidence.get("method") != "euclidean_coordinate_distance":
            raise ValueError("computedEvidence.method must be euclidean_coordinate_distance.")
        neighbors = evidence.get("nearestCoordinateNeighbors")
        if not isinstance(neighbors, list) or len(neighbors) > 12:
            raise ValueError("computedEvidence.nearestCoordinateNeighbors must contain at most 12 records.")
        return (
            {
                "task": "Preserve the supplied deterministic coordinate evidence and return its authority boundary.",
                "origin": origin,
                "computedEvidence": evidence,
            },
            {
                "method": evidence["method"],
                "nearestCoordinateNeighbors": neighbors,
                "coordinateDistanceCreatesMeaning": False,
                "semanticMutationAllowed": False,
                "graphMutationAllowed": False,
            },
        )
    raise ValueError("mode must be authority_boundary or coordinate_evidence_boundary.")


def canonical_record(record):
    coordinates = require_object(record, "coordinates")
    source_ref = require_object(record, "sourceRef")
    required = {
        "id": record.get("id"),
        "tier": record.get("tier"),
        "name": record.get("name"),
        "hexColor": record.get("hexColor"),
    }
    if not all(isinstance(value, str) and value for value in required.values()):
        raise ValueError("record id, tier, name, and hexColor must be non-empty strings.")
    if not all(isinstance(coordinates.get(axis), (int, float)) for axis in ("x", "y", "z")):
        raise ValueError("record coordinates x, y, and z must be numbers.")
    return {
        **required,
        "coordinates": {"x": coordinates["x"], "y": coordinates["y"], "z": coordinates["z"]},
        "sourceRef": {
            "document": source_ref.get("document"),
            "sha256": source_ref.get("sha256"),
            "page": source_ref.get("page"),
            "row": source_ref.get("row"),
            "extractionConfidence": source_ref.get("extractionConfidence"),
        },
    }


def canonical_evidence(evidence):
    if evidence.get("method") != "euclidean_coordinate_distance":
        raise ValueError("computedEvidence.method must be euclidean_coordinate_distance.")
    neighbors = evidence.get("nearestCoordinateNeighbors")
    if not isinstance(neighbors, list) or len(neighbors) > 12:
        raise ValueError("computedEvidence.nearestCoordinateNeighbors must contain at most 12 records.")
    canonical_neighbors = []
    for neighbor in neighbors:
        if not isinstance(neighbor, dict):
            raise ValueError("Each coordinate neighbor must be a JSON object.")
        canonical_neighbors.append({
            "id": neighbor.get("id"),
            "name": neighbor.get("name"),
            "tier": neighbor.get("tier"),
            "distance": neighbor.get("distance"),
        })
    return {
        "method": "euclidean_coordinate_distance",
        "nearestCoordinateNeighbors": canonical_neighbors,
    }


def require_object(value, key):
    result = value.get(key)
    if not isinstance(result, dict):
        raise ValueError(f"{key} must be a JSON object.")
    return result


def compact_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def read_validation_summary():
    report_path = ROOT / "training" / "reports" / "adapter-v2-rules-evaluation-full.json"
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
        return {
            "examples": report.get("examples"),
            "exactMatches": report.get("exactMatches"),
            "jsonEquivalentMatches": report.get("jsonEquivalentMatches"),
        }
    except (OSError, json.JSONDecodeError):
        return {"examples": None, "exactMatches": None, "jsonEquivalentMatches": None}


def create_handler(engine):
    class Handler(BaseHTTPRequestHandler):
        server_version = "MirrorAlignment/1.0"

        def do_GET(self):
            if self.path == "/health":
                self.send_json(200, engine.health())
                return
            self.send_json(404, {"error": "Not found."})

        def do_POST(self):
            if self.path != "/v1/evaluate":
                self.send_json(404, {"error": "Not found."})
                return
            try:
                content_length = int(self.headers.get("content-length", "0"))
                if content_length > MAX_BODY_BYTES:
                    self.send_json(413, {"error": "Request body exceeds 64 KB."})
                    return
                raw = self.rfile.read(content_length)
                request = json.loads(raw.decode("utf-8") or "{}")
                self.send_json(200, engine.evaluate(request))
            except json.JSONDecodeError:
                self.send_json(400, {"error": "Request body must be valid JSON."})
            except ValueError as error:
                status = 422 if isinstance(error, ContractError) else 400
                self.send_json(status, {"error": str(error)})
            except Exception:
                self.send_json(500, {"error": "Local learned alignment evaluation failed."})

        def send_json(self, status, body):
            payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("content-type", "application/json; charset=utf-8")
            self.send_header("content-length", str(len(payload)))
            self.send_header("cache-control", "no-store")
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, template, *args):
            print(f"[alignment-model] {self.address_string()} {template % args}")

    return Handler


def main():
    args = parse_args()
    print(f"[alignment-model] Loading {args.model} with adapter {args.adapter} on {args.device}...")
    engine = AlignmentEngine(args.model, args.adapter, args.device)
    server = ThreadingHTTPServer((args.host, args.port), create_handler(engine))
    print(f"[alignment-model] Ready at http://{args.host}:{args.port}; held-out exact matches: {engine.validation['exactMatches']}/{engine.validation['examples']}.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
