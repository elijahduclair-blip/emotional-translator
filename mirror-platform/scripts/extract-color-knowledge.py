"""Extract ChromaBridge color knowledge from the spreadsheet-style PDF export.

The PDF is knowledge, not memory. This extractor preserves source provenance and
keeps relationship confidence separate from the reliable core node fields.
"""

from __future__ import annotations

import argparse
import hashlib
import itertools
import json
import re
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


TIERS = {"base", "bridge", "shade", "words"}
RELATION_COLUMNS = ("parents", "synonyms", "opposites", "semanticLabels")
KNOWN_X_COLUMNS = {710: 0, 811: 1, 912: 2, 1013: 3}
LABEL_PREFIXES = ("wordnet-", "phrase-word")


def compact(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def split_values(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in value.split(",") if part.strip()]


def is_semantic_label(value: str) -> bool:
    normalized = value.strip().lower()
    return normalized.startswith(LABEL_PREFIXES)


def relationship_score(value: str, cell: str | None, column: int) -> float:
    left = compact(value)
    right = compact(cell)
    if not left or not right:
        return -0.5
    score = SequenceMatcher(None, left, right).ratio()
    prefix = left[: min(8, len(left))]
    if prefix and prefix in right:
        score += 1.5
    if column == 3 and is_semantic_label(value):
        score += 4
    if column != 3 and is_semantic_label(value):
        score -= 4
    return score


def page_groups(page) -> list[list[dict[str, object]]]:
    chunks: list[dict[str, object]] = []

    def visitor(text, _cm, tm, _font, _size):
        cleaned = text.strip()
        if cleaned:
            chunks.append({"text": cleaned, "x": round(float(tm[4]))})

    page.extract_text(visitor_text=visitor)
    starts = [
        index
        for index, chunk in enumerate(chunks)
        if str(chunk["text"]).strip().lower() in TIERS and int(chunk["x"]) == 3
    ]
    return [
        chunks[start : starts[index + 1] if index + 1 < len(starts) else len(chunks)]
        for index, start in enumerate(starts)
    ]


def assign_relationships(chunks, table_row):
    cells = list(table_row[7:11])
    while len(cells) < 4:
        cells.append(None)

    assigned: list[str | None] = [None, None, None, None]
    confidence_parts: list[str] = []
    unknown: list[str] = []

    for chunk in chunks:
        value = str(chunk["text"]).strip()
        x = int(chunk["x"])
        column = KNOWN_X_COLUMNS.get(x)
        if column is not None and assigned[column] is None:
            assigned[column] = value
            confidence_parts.append("position")
        elif is_semantic_label(value) and assigned[3] is None:
            assigned[3] = value
            confidence_parts.append("label")
        else:
            unknown.append(value)

    available = [index for index, value in enumerate(assigned) if value is None]
    if unknown:
        best_score = float("-inf")
        best_columns = None
        for columns in itertools.permutations(available, len(unknown)):
            score = sum(
                relationship_score(value, cells[column], column)
                for value, column in zip(unknown, columns)
            )
            if score > best_score:
                best_score = score
                best_columns = columns
        if best_columns is None:
            raise ValueError("Unable to assign relationship fields")
        for value, column in zip(unknown, best_columns):
            assigned[column] = value
        confidence_parts.append("fuzzy" if best_score >= 0 else "heuristic")

    confidence = "high"
    if "heuristic" in confidence_parts:
        confidence = "low"
    elif "fuzzy" in confidence_parts:
        confidence = "medium"

    return {
        name: split_values(assigned[index])
        for index, name in enumerate(RELATION_COLUMNS)
    }, confidence


def stable_id(document_hash: str, page: int, row: int, core: list[str]) -> str:
    source = "|".join([document_hash, str(page), str(row), *core])
    return "cbk-" + hashlib.sha256(source.encode("utf-8")).hexdigest()[:24]


def extract(input_path: Path) -> dict[str, object]:
    document_bytes = input_path.read_bytes()
    document_hash = hashlib.sha256(document_bytes).hexdigest()
    reader = PdfReader(str(input_path))
    records: list[dict[str, object]] = []

    with pdfplumber.open(str(input_path)) as plumber_pdf:
        if len(reader.pages) != len(plumber_pdf.pages):
            raise ValueError("PDF readers disagree about the page count")

        for page_number, (reader_page, plumber_page) in enumerate(
            zip(reader.pages, plumber_pdf.pages), start=1
        ):
            groups = page_groups(reader_page)
            tables = plumber_page.extract_tables()
            if len(tables) != 1:
                raise ValueError(f"Expected one table on page {page_number}, found {len(tables)}")
            table_rows = tables[0][1:] if page_number == 1 else tables[0]
            table_rows = [row for row in table_rows if row and any(value for value in row)]
            if len(groups) != len(table_rows):
                raise ValueError(
                    f"Page {page_number}: {len(groups)} content rows but {len(table_rows)} grid rows"
                )

            for row_number, (group, table_row) in enumerate(zip(groups, table_rows), start=1):
                if len(group) < 7:
                    raise ValueError(f"Page {page_number} row {row_number}: incomplete core fields")
                core = [str(chunk["text"]).strip() for chunk in group[:7]]
                tier, name, hex_color, semantic_code, x_value, y_value, z_value = core
                if tier.lower() not in TIERS:
                    raise ValueError(f"Unexpected tier {tier!r} on page {page_number}")
                try:
                    coordinates = {
                        "x": float(x_value),
                        "y": float(y_value),
                        "z": float(z_value),
                    }
                except ValueError as error:
                    raise ValueError(
                        f"Page {page_number} row {row_number}: invalid coordinates"
                    ) from error

                relationships, confidence = assign_relationships(group[7:], table_row)
                records.append(
                    {
                        "id": stable_id(document_hash, page_number, row_number, core),
                        "tier": tier.lower(),
                        "name": name,
                        "hexColor": hex_color,
                        "semanticCode": semantic_code,
                        "coordinates": coordinates,
                        **relationships,
                        "provenance": {
                            "sourceDocument": input_path.name,
                            "sourceSha256": document_hash,
                            "page": page_number,
                            "row": row_number,
                            "relationshipExtractionConfidence": confidence,
                        },
                    }
                )

    return {
        "schemaVersion": "1.0.0",
        "kind": "chromabridge_color_knowledge",
        "source": {
            "document": input_path.name,
            "sha256": document_hash,
            "pageCount": len(reader.pages),
        },
        "extractedAt": datetime.now(timezone.utc).isoformat(),
        "recordCount": len(records),
        "records": records,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    result = extract(args.input.resolve())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"Extracted {result['recordCount']} knowledge records from "
        f"{result['source']['pageCount']} pages into {args.output}"
    )


if __name__ == "__main__":
    main()
