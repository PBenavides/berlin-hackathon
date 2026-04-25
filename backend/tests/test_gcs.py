"""Validate GCS bucket connectivity using ADC (Application Default Credentials)."""
import os
import uuid
import pytest


GCS_BUCKET = os.environ.get("GCS_BUCKET", "buena-attachments-3236")


@pytest.mark.skipif(
    not os.environ.get("GCS_BUCKET") and os.environ.get("CI") != "1",
    reason="Set GCS_BUCKET env var to run GCS tests",
)
def test_gcs_upload_download_delete():
    """Round-trip: upload a small blob, download it, delete it."""
    from google.cloud import storage as gcs

    client = gcs.Client()
    bucket = client.bucket(GCS_BUCKET)

    blob_name = f"test/{uuid.uuid4().hex}.txt"
    payload = b"buena-gcs-test"

    blob = bucket.blob(blob_name)
    blob.upload_from_string(payload, content_type="text/plain")

    downloaded = blob.download_as_bytes()
    assert downloaded == payload

    blob.delete()
    assert not blob.exists()


def test_gcs_bucket_accessible():
    """Verify the GCS bucket exists and we can list objects (even if empty)."""
    from google.cloud import storage as gcs

    client = gcs.Client()
    bucket = client.bucket(GCS_BUCKET)
    # list_blobs raises if the bucket doesn't exist or we lack access
    blobs = list(client.list_blobs(GCS_BUCKET, max_results=1))
    # Just checking we can iterate — result may be empty
    assert isinstance(blobs, list)
