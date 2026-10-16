"""Photo storage: Cloudflare R2 (S3-compatible) or local disk."""
import os
from pathlib import Path

STORAGE_BACKEND = os.environ.get("STORAGE_BACKEND", "local").lower()  # "r2" | "local"
LOCAL_DIR = Path(os.environ.get("LOCAL_STORAGE_DIR", "/data/uploads"))
R2_BUCKET = os.environ.get("R2_BUCKET", "")
APP_NAME = os.environ.get("STORAGE_PREFIX", "nurserypos")  # folder in the bucket; staging uses its own

_s3 = None


def init_storage():
    """Call once at startup. Idempotent."""
    global _s3
    if STORAGE_BACKEND == "r2":
        if _s3 is None:
            import boto3
            _s3 = boto3.client(
                "s3",
                endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
                aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
                aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
                region_name="auto",
            )
        return _s3
    LOCAL_DIR.mkdir(parents=True, exist_ok=True)
    return None


def _local_path(path: str) -> Path:
    p = (LOCAL_DIR / path).resolve()
    if LOCAL_DIR.resolve() not in p.parents:
        raise ValueError("Invalid path")
    return p


def put_object(path: str, data: bytes, content_type: str) -> dict:
    s3 = init_storage()
    if s3 is not None:
        s3.put_object(Bucket=R2_BUCKET, Key=path, Body=data, ContentType=content_type)
    else:
        p = _local_path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
    return {"path": path, "size": len(data)}


def get_object(path: str) -> tuple[bytes, str]:
    s3 = init_storage()
    if s3 is not None:
        obj = s3.get_object(Bucket=R2_BUCKET, Key=path)
        return obj["Body"].read(), obj.get("ContentType", "application/octet-stream")
    p = _local_path(path)
    ext = p.suffix.lower()
    ctype = {".png": "image/png", ".webp": "image/webp"}.get(ext, "image/jpeg")
    return p.read_bytes(), ctype
