"""Health endpoint smoke test — validates DB connectivity indirectly."""


def test_health_ok_new_prefix(client):
    """Primary /api prefix works."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "buena-contextops"


def test_health_ok_v1_compat(client):
    """Backward-compat /api/v1 prefix still returns 200."""
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
