"""
context_layer_service.py — Parse a property's context.md into 4 named layers.

Convention: `## Vendor layer`, `## Owner layer`, `## Building layer`,
`## Property layer` are the canonical top-level section headings. Anything
before the first layer heading (e.g. YAML frontmatter) is dropped.

This is a pre-step to ContextChunk extraction; the chunker still keys by
sub-headings inside each layer.
"""
from __future__ import annotations

import re
from typing import Dict, List

LAYERS: List[str] = ["vendor", "owner", "building", "property"]

_FRONTMATTER_RE = re.compile(r"^---\s*\n.*?\n---\s*\n", re.DOTALL)
_LAYER_HEADING_RE = re.compile(
    r"^##\s+(Vendor|Owner|Building|Property)\s+layer\s*$",
    re.MULTILINE | re.IGNORECASE,
)


def strip_frontmatter(content_md: str) -> str:
    return _FRONTMATTER_RE.sub("", content_md, count=1)


def parse_layers(content_md: str) -> Dict[str, Dict[str, str]]:
    """
    Returns: {"vendor": {"raw": "..."}, "owner": {...}, "building": {...}, "property": {...}}

    Missing layers come back as {"raw": ""}. Heading itself is stripped from
    each layer body so the frontend renders just the section content.
    """
    body = strip_frontmatter(content_md)
    out: Dict[str, Dict[str, str]] = {layer: {"raw": ""} for layer in LAYERS}

    matches = list(_LAYER_HEADING_RE.finditer(body))
    for i, m in enumerate(matches):
        layer = m.group(1).lower()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        out[layer]["raw"] = body[start:end].strip()
    return out
