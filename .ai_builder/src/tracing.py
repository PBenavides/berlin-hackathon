"""Optional OpenInference tracing for Arize Phoenix.

All tracing logic is isolated here. If the required packages are not
installed, every public function becomes a no-op — the rest of the
codebase never needs to check.
"""

import logging
from contextlib import contextmanager

logger = logging.getLogger("ai_builder.tracing")

_TRACING_AVAILABLE = False
_tracer = None


def init_tracing(
    project_name: str,
    phoenix_endpoint: str | None = None,
    phoenix_api_key: str | None = None,
) -> bool:
    """Initialize Phoenix OTEL tracing and auto-instrument the Claude Agent SDK.

    Returns True if tracing was successfully initialized.
    """
    # global _TRACING_AVAILABLE, _tracer

    # try:
    #     try:
    #         from arize_phoenix.otel import register
    #     except ImportError:
    #         from phoenix.otel import register
    #     from openinference.instrumentation.claude_agent_sdk import (
    #         ClaudeAgentSDKInstrumentor,
    #     )
    #     from opentelemetry import trace
    # except ImportError:
    #     logger.info("Tracing packages not installed — tracing disabled")
    #     return False

    # kwargs = {"project_name": project_name}
    # if phoenix_endpoint:
    #     kwargs["endpoint"] = phoenix_endpoint
    # if phoenix_api_key:
    #     kwargs["headers"] = {"api_key": phoenix_api_key}

    # tracer_provider = register(**kwargs)

    # ClaudeAgentSDKInstrumentor().instrument(tracer_provider=tracer_provider)

    # _tracer = trace.get_tracer("ai_builder")
    # _TRACING_AVAILABLE = True
    # logger.info(
    #     f"Tracing initialized — Phoenix endpoint: "
    #     f"{phoenix_endpoint or 'localhost:6006'}"
    # )
    # return True

    logger.info("Tracing disabled (Phoenix implementation commented out)")
    return False


@contextmanager
def trace_root(name: str, session_id: str, attributes: dict | None = None):
    """Create a NEW root span (new trace) with session.id for Phoenix grouping.

    Phoenix groups traces into sessions via the ``session.id`` attribute on
    root spans. To start a new trace (not a child of the current one), we
    attach an empty context so this span becomes a trace root.
    """
    yield None  # no-op: Phoenix tracing commented out

    # if not _TRACING_AVAILABLE or _tracer is None:
    #     yield None
    #     return

    # from opentelemetry import context as otel_context

    # token = otel_context.attach(otel_context.Context())
    # try:
    #     with _tracer.start_as_current_span(name) as span:
    #         span.set_attribute("session.id", session_id)
    #         if attributes:
    #             for k, v in attributes.items():
    #                 if v is not None:
    #                     span.set_attribute(k, v)
    #         yield span
    # finally:
    #     otel_context.detach(token)


@contextmanager
def trace_span(name: str, attributes: dict | None = None):
    """Create a child span within the current trace context.

    If tracing is not available, yields None (no-op context manager).
    """
    yield None  # no-op: Phoenix tracing commented out

    # if not _TRACING_AVAILABLE or _tracer is None:
    #     yield None
    #     return

    # with _tracer.start_as_current_span(name) as span:
    #     if attributes:
    #         for k, v in attributes.items():
    #             if v is not None:
    #                 span.set_attribute(k, v)
    #     yield span


def shutdown_tracing():
    """Flush pending spans and shut down the tracer provider."""
    if not _TRACING_AVAILABLE:
        return
    # try:
    #     from opentelemetry import trace

    #     provider = trace.get_tracer_provider()
    #     if hasattr(provider, "force_flush"):
    #         provider.force_flush()
    #     if hasattr(provider, "shutdown"):
    #         provider.shutdown()
    #     logger.info("Tracing shut down")
    # except Exception as e:
    #     logger.warning(f"Tracing shutdown error: {e}")
