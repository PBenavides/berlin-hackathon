"""Smoke tests for the Properties API — validates end-to-end DB reads."""


def test_list_properties_returns_list(client):
    resp = client.get("/api/properties")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_list_properties_v1_compat(client):
    """Backward-compat /api/v1 prefix still works."""
    resp = client.get("/api/v1/properties")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_get_nonexistent_property_returns_404(client):
    resp = client.get("/api/properties/nonexistent-id-00000000")
    assert resp.status_code == 404


def test_properties_response_is_camel_case(client):
    """Each property object must use camelCase field names."""
    resp = client.get("/api/properties")
    assert resp.status_code == 200
    items = resp.json()
    if not items:
        return  # Nothing to assert — empty seed is valid

    prop = items[0]
    # camelCase keys must be present; snake_case keys must NOT appear
    assert "createdAt" in prop, f"Expected 'createdAt' in {list(prop.keys())}"
    assert "created_at" not in prop, "snake_case 'created_at' should not appear"
    # slack_channel → slackChannel
    if prop.get("slackChannel") is not None or "slackChannel" in prop:
        assert "slack_channel" not in prop
