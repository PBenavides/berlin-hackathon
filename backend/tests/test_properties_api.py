"""Smoke tests for the Properties API — validates end-to-end DB reads."""


def test_list_properties_returns_list(client):
    resp = client.get("/api/v1/properties")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_get_nonexistent_property_returns_404(client):
    resp = client.get("/api/v1/properties/nonexistent-id-00000000")
    assert resp.status_code == 404
