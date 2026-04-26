#!/usr/bin/env python3
import asyncio
import os
import sys


def _find_ai_builder_dir():
    """Walk up from CWD to find .ai_builder/, like git finds .git/."""
    d = os.path.abspath(os.getcwd())
    while True:
        candidate = os.path.join(d, ".ai_builder")
        if os.path.isdir(candidate) and os.path.isfile(os.path.join(candidate, "run.py")):
            return candidate
        parent = os.path.dirname(d)
        if parent == d:
            break
        d = parent
    return None


def cli():
    found = _find_ai_builder_dir()
    # Fall back to the installed location only if no .ai_builder/ in tree
    ai_builder_dir = found or os.path.dirname(os.path.abspath(__file__))

    # Preserve the directory the user actually invoked from, so config can
    # derive a per-invocation instance key (e.g. "frontend" vs "backend").
    os.environ.setdefault("AI_BUILDER_INVOKE_DIR", os.path.abspath(os.getcwd()))

    os.chdir(ai_builder_dir)
    # Add it to sys.path so `import run`, `import config`, `import src.*` work.
    if ai_builder_dir not in sys.path:
        sys.path.insert(0, ai_builder_dir)

    import run as _run
    asyncio.run(_run.main())
