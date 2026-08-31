"""Produce a bounded ARI/VERA receipt for extracted ChromaBridge knowledge.

The verifier proves document readability, row accountability, structural
consistency, and deterministic semantic-code encoding. It does not treat a PDF
as independent evidence for its own semantic claims and never authorizes graph
mutation.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


RECEIPT_VERSION = "vera.chromabridge-export.v1"
ALLOWED_TIERS = {"base", "bridge", "shade", "words"}
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
SEMANTIC_CODE = re.compile(r"^[0-9a-fA-F]{6}$")
CANONICAL_COORDINATE_RANGES = {
    "x": (-255.0, 255.0),
    "y": (0.0, 255.0),
    "z": (-255.0, 255.0),
}
RELATION_FIELDS = ("parents", "synonyms", "opposites")


def normalized_name(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def round_half_up(value: float) -> int:
    return math.floor(float(value) + 0.5)


def clamp_byte(value: float) -> int:
    return max(0, min(255, round_half_up(value)))


def expected_semantic_code(coordinates: dict[str, Any]) -> str:
    """Reproduce ChromaBridge's compact coordinate code.

    X is centered from -255..255 into a byte. Y is a direct 0..255 byte. Z
    retains positive vivid magnitude and clips negative muted magnitude to 0.
    The full signed coordinates remain authoritative.
    """

    values = (
        clamp_byte((float(coordinates["x"]) + 255.0) / 2.0),
        clamp_byte(float(coordinates["y"])),
        clamp_byte(float(coordinates["z"])),
    )
    return "".join(f"{value:02X}" for value in values)


def location(record: dict[str, Any]) -> dict[str, Any]:
    provenance = record.get("provenance") or {}
    return {
        "name": str(record.get("name") or ""),
        "page": int(provenance.get("page") or 0),
        "row": int(provenance.get("row") or 0),
    }


def relation_targets(records: list[dict[str, Any]], names: set[str], field: str) -> dict[str, Any]:
    total = 0
    resolved = 0
    unresolved: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        for value in record.get(field) or []:
            total += 1
            if normalized_name(value) in names:
                resolved += 1
            else:
                unresolved[str(value)].append(location(record))
    return {
        "total": total,
        "resolvedInsideExport": resolved,
        "unresolvedInsideExport": total - resolved,
        "unresolvedTargets": [
            {"target": target, "usedBy": locations}
            for target, locations in sorted(unresolved.items(), key=lambda item: normalized_name(item[0]))
        ],
    }


def record_fingerprint(record: dict[str, Any]) -> str:
    value = {
        "tier": record.get("tier"),
        "name": normalized_name(record.get("name")),
        "hexColor": str(record.get("hexColor") or "").lower(),
        "semanticCode": str(record.get("semanticCode") or "").lower(),
        "coordinates": record.get("coordinates"),
        "parents": [normalized_name(value) for value in record.get("parents") or []],
        "synonyms": [normalized_name(value) for value in record.get("synonyms") or []],
        "opposites": [normalized_name(value) for value in record.get("opposites") or []],
        "semanticLabels": [normalized_name(value) for value in record.get("semanticLabels") or []],
    }
    canonical = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def compare_names(records: list[dict[str, Any]], comparison: dict[str, Any] | None) -> dict[str, Any] | None:
    if comparison is None:
        return None
    current_names = {normalized_name(record.get("name")) for record in records}
    prior_records = comparison.get("records") or []
    prior_names = {normalized_name(record.get("name")) for record in prior_records}
    return {
        "priorRecordCount": len(prior_records),
        "sharedNormalizedNames": len(current_names & prior_names),
        "newNormalizedNames": len(current_names - prior_names),
        "missingPriorNormalizedNames": len(prior_names - current_names),
        "boundary": "Version comparison detects continuity and change; it is not independent semantic evidence.",
    }


def verify(knowledge: dict[str, Any], comparison: dict[str, Any] | None = None) -> dict[str, Any]:
    records = list(knowledge.get("records") or [])
    declared_count = int(knowledge.get("recordCount") or 0)
    source = knowledge.get("source") or {}
    names = {normalized_name(record.get("name")) for record in records if normalized_name(record.get("name"))}

    malformed: list[dict[str, Any]] = []
    semantic_mismatches: list[dict[str, Any]] = []
    out_of_range: list[dict[str, Any]] = []
    extraction_confidence = Counter()
    tiers = Counter()
    label_counts = Counter()
    fingerprints: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for record in records:
        tiers[str(record.get("tier") or "")] += 1
        provenance = record.get("provenance") or {}
        extraction_confidence[str(provenance.get("relationshipExtractionConfidence") or "unknown")] += 1
        for label in record.get("semanticLabels") or []:
            label_counts[str(label)] += 1

        issues: list[str] = []
        if record.get("tier") not in ALLOWED_TIERS:
            issues.append("invalid_tier")
        if not normalized_name(record.get("name")):
            issues.append("missing_name")
        if not HEX_COLOR.fullmatch(str(record.get("hexColor") or "")):
            issues.append("invalid_hex_color")
        if not SEMANTIC_CODE.fullmatch(str(record.get("semanticCode") or "")):
            issues.append("invalid_semantic_code")

        coordinates = record.get("coordinates")
        if not isinstance(coordinates, dict):
            issues.append("missing_coordinates")
        else:
            for axis in ("x", "y", "z"):
                value = coordinates.get(axis)
                if not isinstance(value, (int, float)) or not math.isfinite(float(value)):
                    issues.append(f"invalid_{axis}_coordinate")
            if not any(issue.startswith("invalid_") and issue.endswith("_coordinate") for issue in issues):
                expected = expected_semantic_code(coordinates)
                actual = str(record.get("semanticCode") or "").upper()
                if actual != expected:
                    semantic_mismatches.append({**location(record), "actual": actual, "expected": expected})
                outside = {
                    axis: float(coordinates[axis])
                    for axis, (minimum, maximum) in CANONICAL_COORDINATE_RANGES.items()
                    if float(coordinates[axis]) < minimum or float(coordinates[axis]) > maximum
                }
                if outside:
                    out_of_range.append({**location(record), "coordinates": dict(coordinates), "outside": outside})

        if issues:
            malformed.append({**location(record), "issues": issues})
        fingerprints[record_fingerprint(record)].append(record)

    duplicate_rows = [
        {"occurrences": [location(record) for record in group]}
        for group in fingerprints.values()
        if len(group) > 1
    ]
    relationships = {
        field: relation_targets(records, names, field)
        for field in RELATION_FIELDS
    }
    integrity_blockers = (
        len(records) != declared_count
        or bool(malformed)
        or bool(semantic_mismatches)
    )
    review_items = (
        len(out_of_range)
        + len(duplicate_rows)
        + extraction_confidence.get("medium", 0)
        + extraction_confidence.get("low", 0)
        + relationships["parents"]["unresolvedInsideExport"]
    )

    receipt: dict[str, Any] = {
        "receiptVersion": RECEIPT_VERSION,
        "verifier": {
            "agent": "ARI",
            "teamMember": "VERA",
            "expandedName": "Verification and Relational Authority",
        },
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "document": source.get("document"),
            "sha256": source.get("sha256"),
            "pageCount": source.get("pageCount"),
            "declaredRecordCount": declared_count,
            "extractedRecordCount": len(records),
        },
        "decision": {
            "status": "blocked" if integrity_blockers else ("review_required" if review_items else "structurally_verified"),
            "structuralVerification": "failed" if integrity_blockers else "verified",
            "relationshipVerification": "review_required" if review_items else "verified_inside_export",
            "semanticVerification": "needs_independent_evidence",
            "graphMutationAllowed": False,
            "reason": (
                "The export is structurally readable and internally accountable, but its relationship and color-meaning claims are not independently proven by the PDF that contains them."
                if not integrity_blockers
                else "Core structural errors prevent this export from entering a verified lane."
            ),
        },
        "checks": {
            "recordCountMatches": len(records) == declared_count,
            "tiers": dict(sorted(tiers.items())),
            "malformedCoreRecords": len(malformed),
            "semanticCodeFormulaMismatches": len(semantic_mismatches),
            "coordinatesOutsideCanonicalRange": len(out_of_range),
            "exactDuplicateRows": len(duplicate_rows),
            "relationshipExtractionConfidence": dict(sorted(extraction_confidence.items())),
            "normalizedUniqueNames": len(names),
            "relationships": relationships,
            "semanticLabels": dict(label_counts.most_common()),
        },
        "exceptions": {
            "malformedCoreRecords": malformed,
            "semanticCodeFormulaMismatches": semantic_mismatches,
            "coordinatesOutsideCanonicalRange": out_of_range,
            "exactDuplicateRows": duplicate_rows,
        },
        "comparisonToPrior": compare_names(records, comparison),
        "evidenceBoundary": {
            "sourceProves": [
                "the document hash and page count",
                "the exact rows extracted from each page",
                "the recorded tiers, names, colors, coordinates, relationships, and labels",
            ],
            "sourceDoesNotProve": [
                "that a synonym or opposite is lexically correct",
                "that a color association is universal or factual",
                "that a coordinate is the correct placement for every person or context",
                "that imported knowledge may mutate an approved, shared, or personal graph",
            ],
            "requiredNextEvidence": "Attach independent lexical or primary-source evidence to contested relationship claims, then review exceptions before proposing graph changes.",
        },
    }
    canonical = json.dumps(receipt, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    receipt["receiptSha256"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path, help="Extracted ChromaBridge JSON")
    parser.add_argument("output", type=Path, help="VERA receipt JSON")
    parser.add_argument("--comparison", type=Path, help="Optional prior knowledge JSON")
    args = parser.parse_args()

    knowledge = json.loads(args.input.read_text(encoding="utf-8"))
    comparison = (
        json.loads(args.comparison.read_text(encoding="utf-8"))
        if args.comparison
        else None
    )
    receipt = verify(knowledge, comparison)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    decision = receipt["decision"]
    print(
        f"VERA {decision['status']}: {receipt['source']['extractedRecordCount']} records; "
        f"receipt {receipt['receiptSha256']}"
    )


if __name__ == "__main__":
    main()
