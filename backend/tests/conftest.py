import os
import pytest
from fastapi.testclient import TestClient

# Point at local dev server by default; CI can override via DATABASE_URL env
os.environ.setdefault("DATABASE_URL", "postgresql://buena:buena@localhost:5432/buena")

from app.main import app  # noqa: E402 (must come after env setup)


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c
