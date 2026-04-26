from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncIterator, Callable, Iterable, Optional, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")

# ── Data models ────────────────────────────────────────────────────────────────

@dataclass
class Record:
    id: str
    source: str
    payload: dict[str, Any]
    received_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    processed: bool = False
    error: Optional[str] = None

    def mark_done(self) -> None:
        self.processed = True

    def mark_error(self, message: str) -> None:
        self.error = message

    def fingerprint(self) -> str:
        raw = json.dumps(self.payload, sort_keys=True)
        return hashlib.sha256(raw.encode()).hexdigest()


@dataclass
class ProcessingResult:
    record_id: str
    success: bool
    output: Optional[dict[str, Any]] = None
    error: Optional[str] = None
    duration_ms: float = 0.0


# ── Transformer protocol ───────────────────────────────────────────────────────

class Transformer:
    """Base class for data transformers."""

    def transform(self, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    def validate(self, payload: dict[str, Any]) -> list[str]:
        """Return a list of validation error messages, or empty list if valid."""
        return []


class NormalizeKeysTransformer(Transformer):
    """Lowercases all top-level keys and strips leading/trailing whitespace from string values."""

    def transform(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {
            k.lower(): v.strip() if isinstance(v, str) else v
            for k, v in payload.items()
        }


class FilterFieldsTransformer(Transformer):
    def __init__(self, allowed_keys: Iterable[str]) -> None:
        self._allowed = frozenset(allowed_keys)

    def transform(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {k: v for k, v in payload.items() if k in self._allowed}


class RequiredFieldsValidator(Transformer):
    def __init__(self, required: Iterable[str]) -> None:
        self._required = list(required)

    def transform(self, payload: dict[str, Any]) -> dict[str, Any]:
        return payload  # validator only; no mutation

    def validate(self, payload: dict[str, Any]) -> list[str]:
        return [f"Missing required field: '{f}'" for f in self._required if f not in payload]


class PipelineTransformer(Transformer):
    """Chains multiple transformers sequentially."""

    def __init__(self, steps: list[Transformer]) -> None:
        self._steps = steps

    def transform(self, payload: dict[str, Any]) -> dict[str, Any]:
        result = payload
        for step in self._steps:
            result = step.transform(result)
        return result

    def validate(self, payload: dict[str, Any]) -> list[str]:
        errors: list[str] = []
        for step in self._steps:
            errors.extend(step.validate(payload))
        return errors


# ── Pipeline processor ─────────────────────────────────────────────────────────

class DataPipeline:
    def __init__(
        self,
        transformer: Transformer,
        sink: Callable[[Record, dict[str, Any]], None],
        *,
        max_retries: int = 3,
        retry_delay_ms: int = 500,
    ) -> None:
        self._transformer = transformer
        self._sink = sink
        self._max_retries = max_retries
        self._retry_delay = retry_delay_ms / 1000
        self._stats: dict[str, int] = defaultdict(int)

    async def process(self, record: Record) -> ProcessingResult:
        start = asyncio.get_event_loop().time()

        errors = self._transformer.validate(record.payload)
        if errors:
            record.mark_error("; ".join(errors))
            self._stats["validation_failed"] += 1
            return ProcessingResult(
                record_id=record.id,
                success=False,
                error="; ".join(errors),
            )

        for attempt in range(1, self._max_retries + 1):
            try:
                transformed = self._transformer.transform(record.payload)
                self._sink(record, transformed)
                record.mark_done()
                self._stats["success"] += 1
                duration = (asyncio.get_event_loop().time() - start) * 1000
                return ProcessingResult(
                    record_id=record.id,
                    success=True,
                    output=transformed,
                    duration_ms=round(duration, 2),
                )
            except Exception as exc:
                logger.warning("Attempt %d/%d failed for record %s: %s", attempt, self._max_retries, record.id, exc)
                if attempt < self._max_retries:
                    await asyncio.sleep(self._retry_delay * attempt)
                else:
                    record.mark_error(str(exc))
                    self._stats["failed"] += 1
                    return ProcessingResult(record_id=record.id, success=False, error=str(exc))

        # unreachable, but satisfy type checker
        return ProcessingResult(record_id=record.id, success=False, error="Unknown failure")

    async def process_batch(self, records: list[Record]) -> list[ProcessingResult]:
        tasks = [self.process(r) for r in records]
        return await asyncio.gather(*tasks)

    def stats(self) -> dict[str, int]:
        return dict(self._stats)


# ── JSONL file source ──────────────────────────────────────────────────────────

async def read_jsonl(path: Path) -> AsyncIterator[dict[str, Any]]:
    """Async generator that yields parsed JSON objects from a .jsonl file."""
    loop = asyncio.get_event_loop()
    lines = await loop.run_in_executor(None, path.read_text, "utf-8")
    for line in lines.splitlines():
        line = line.strip()
        if line:
            try:
                yield json.loads(line)
            except json.JSONDecodeError as exc:
                logger.error("Skipping malformed line: %s", exc)


async def load_records_from_jsonl(path: Path, source: str) -> list[Record]:
    records: list[Record] = []
    async for payload in read_jsonl(path):
        record_id = payload.get("id") or hashlib.md5(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:12]
        records.append(Record(id=str(record_id), source=source, payload=payload))
    return records
