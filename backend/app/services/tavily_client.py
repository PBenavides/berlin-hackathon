"""
tavily_client.py — Minimal Tavily Search API client.

We don't pull in the official `tavily-python` SDK; the API surface we need is
one POST to `/search`. Mirrors the Mailosaur client's no-deps style.

Docs: https://docs.tavily.com/docs/rest-api/api-reference
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

import httpx

from app.config import get_settings


_BASE_URL = "https://api.tavily.com"


class TavilyClient:
    """Tiny wrapper around POST {base}/search."""

    def __init__(self, api_key: Optional[str] = None) -> None:
        self.api_key = api_key or get_settings().tavily_api_key
        if not self.api_key:
            raise RuntimeError(
                "Tavily is not configured: set TAVILY_API_KEY in the environment."
            )

    def search(
        self,
        query: str,
        *,
        max_results: int = 5,
        include_answer: bool = True,
        search_depth: str = "basic",
        topic: str = "general",
    ) -> Dict[str, Any]:
        """
        Run a single Tavily search. Returns the raw response dict with at least:
          - query (str)
          - answer (str | None)        — short LLM-style summary
          - results (list[dict])       — each {title, url, content, score, ...}
        Raises httpx.HTTPError on transport / non-2xx responses.
        """
        payload = {
            "api_key": self.api_key,
            "query": query,
            "search_depth": search_depth,
            "topic": topic,
            "max_results": max_results,
            "include_answer": include_answer,
        }
        with httpx.Client(timeout=20) as client:
            resp = client.post(f"{_BASE_URL}/search", json=payload)
            resp.raise_for_status()
            return resp.json()


def normalise_results(raw: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Project Tavily's verbose response down to what we surface to the LLM/UI."""
    out: List[Dict[str, Any]] = []
    for r in raw.get("results") or []:
        out.append(
            {
                "title": r.get("title") or "",
                "url": r.get("url") or "",
                "content": (r.get("content") or "")[:600],
                "score": r.get("score"),
            }
        )
    return out
