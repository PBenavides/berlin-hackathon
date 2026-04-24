import difflib
import re
from typing import List, Tuple
from sqlalchemy.orm import Session

from app.models.context_versions import ContextVersion
from app.models.context_chunks import ContextChunk


def compute_diff(text_a: str, text_b: str, from_label: str = "a", to_label: str = "b") -> str:
    """Return unified diff between two markdown strings."""
    lines_a = text_a.splitlines(keepends=True)
    lines_b = text_b.splitlines(keepends=True)
    diff = difflib.unified_diff(
        lines_a,
        lines_b,
        fromfile=from_label,
        tofile=to_label,
        lineterm="",
    )
    return "".join(diff)


def parse_markdown_chunks(content_md: str) -> List[Tuple[str, str]]:
    """
    Parse markdown content into (heading, content) chunks.
    Returns list of (heading, chunk_content) tuples.
    """
    chunks = []
    # Split on headings (## or ###)
    heading_pattern = re.compile(r"^(#{1,3})\s+(.+)$", re.MULTILINE)
    matches = list(heading_pattern.finditer(content_md))

    if not matches:
        # No headings found, treat entire content as one chunk
        chunks.append(("Document", content_md.strip()))
        return chunks

    for i, match in enumerate(matches):
        heading_text = match.group(2).strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(content_md)
        chunk_content = content_md[start:end].strip()
        chunks.append((heading_text, chunk_content))

    return chunks


def create_context_chunks(
    db: Session,
    context_version_id: str,
    property_id: str,
    content_md: str,
) -> List[ContextChunk]:
    """Parse markdown content and create ContextChunk records."""
    chunks = parse_markdown_chunks(content_md)
    db_chunks = []
    for heading, content in chunks:
        if not content:
            continue
        chunk = ContextChunk(
            context_version_id=context_version_id,
            property_id=property_id,
            heading=heading,
            content=content,
        )
        db.add(chunk)
        db_chunks.append(chunk)
    db.flush()
    return db_chunks


def get_next_version(db: Session, property_id: str) -> int:
    """Get the next version number for a property."""
    result = (
        db.query(ContextVersion)
        .filter(ContextVersion.property_id == property_id)
        .order_by(ContextVersion.version.desc())
        .first()
    )
    if result is None:
        return 1
    return result.version + 1
