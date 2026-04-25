"""Health endpoint smoke test — validates DB connectivity indirectly."""


def test_health_ok(client):
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "buena-contextops"
