import json
from pathlib import Path


def test_provider_shape():
    data = json.loads(Path("vector_dbs.json").read_text())
    assert data["generated_at"] == "2026-08-10"
    databases = data["databases"]
    assert len(databases) >= 5
    names = {db["name"].lower() for db in databases}
    assert {"chroma", "weaviate", "qdrant", "milvus"} <= names
    required = ["name", "github_url", "github_stars", "license", "primary_language",
                "embedding_support", "language_clients", "storage_backends",
                "highlights", "summary"]
    for db in databases:
        assert all(field in db for field in required)
        assert isinstance(db["github_stars"], int) and db["github_stars"] > 0
        assert db["github_url"].startswith("https://github.com/")
        assert db["embedding_support"] and db["language_clients"] and db["highlights"]
        assert len(db["summary"]) > 20


if __name__ == "__main__":
    test_provider_shape()
    print("ALL TESTS PASSED")
