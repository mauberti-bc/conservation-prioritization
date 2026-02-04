import os
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

import boto3
from botocore.config import Config


@dataclass(frozen=True)
class ObjectStoreConfig:
    endpoint: str
    region: str
    access_key: str
    secret_key: str
    force_path_style: bool
    bucket: str
    prefix: str


def _normalize_endpoint(endpoint: str) -> str:
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        return endpoint
    return f"https://{endpoint}"


def _parse_bool(value: Optional[str]) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "y"}


def get_object_store_config() -> ObjectStoreConfig:
    """
    Load object store configuration from environment variables.
    """
    endpoint = os.getenv("OBJECT_STORE_ENDPOINT")
    region = os.getenv("OBJECT_STORE_REGION", "us-east-1")
    access_key = os.getenv("OBJECT_STORE_ACCESS_KEY_ID")
    secret_key = os.getenv("OBJECT_STORE_SECRET_KEY_ID")
    bucket = os.getenv("OBJECT_STORE_BUCKET_NAME")
    prefix = os.getenv("OBJECT_STORE_PREFIX", "").strip("/")
    force_path_style = _parse_bool(os.getenv("OBJECT_STORE_FORCE_PATH_STYLE"))

    if not endpoint:
        raise ValueError("OBJECT_STORE_ENDPOINT is not configured.")
    if not access_key or not secret_key:
        raise ValueError("Object storage credentials are not configured.")
    if not bucket:
        raise ValueError("OBJECT_STORE_BUCKET_NAME is not configured.")

    return ObjectStoreConfig(
        endpoint=_normalize_endpoint(endpoint),
        region=region,
        access_key=access_key,
        secret_key=secret_key,
        force_path_style=force_path_style,
        bucket=bucket,
        prefix=prefix,
    )


def get_object_store_client(config: ObjectStoreConfig):
    """
    Build a configured boto3 S3 client for the object store.
    """
    client_config = Config()

    if config.force_path_style:
        client_config = Config(s3={"addressing_style": "path"})

    return boto3.client(
        "s3",
        endpoint_url=config.endpoint,
        aws_access_key_id=config.access_key,
        aws_secret_access_key=config.secret_key,
        region_name=config.region,
        config=client_config,
    )


def build_object_key(prefix: str, key: str) -> str:
    """
    Build an object key with an optional prefix.
    """
    if prefix:
        return f"{prefix}/{key.lstrip('/')}"
    return key.lstrip("/")


def make_uri(bucket: str, key: str) -> str:
    """
    Build an S3 URI from bucket/key.
    """
    return f"s3://{bucket}/{key}"


def parse_uri(uri: str) -> Tuple[str, str]:
    """
    Parse an S3 URI into bucket/key.
    """
    if not uri.startswith("s3://"):
        raise ValueError(f"Unsupported object store URI: {uri}")
    without_scheme = uri[len("s3://") :]
    parts = without_scheme.split("/", 1)
    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise ValueError(f"Invalid object store URI: {uri}")
    return parts[0], parts[1]


def put_object(
    *,
    local_path: str,
    bucket: str,
    key: str,
    content_type: Optional[str] = None,
    metadata: Optional[Dict[str, str]] = None,
) -> Dict[str, Optional[str]]:
    """
    Upload a local file to object storage.
    """
    config = get_object_store_config()
    client = get_object_store_client(config)
    extra_args: Dict[str, Any] = {}

    if content_type:
        extra_args["ContentType"] = content_type
    if metadata:
        extra_args["Metadata"] = metadata

    client.upload_file(local_path, bucket, key, ExtraArgs=extra_args or None)

    head = client.head_object(Bucket=bucket, Key=key)
    return {"uri": make_uri(bucket, key), "etag": head.get("ETag")}


def get_object(
    *,
    bucket: str,
    key: str,
) -> Any:
    """
    Fetch an object from storage and return the response body stream.
    """
    config = get_object_store_config()
    client = get_object_store_client(config)
    response = client.get_object(Bucket=bucket, Key=key)
    return response["Body"]


def head_object(
    *,
    bucket: str,
    key: str,
) -> Dict[str, Any]:
    """
    Fetch object metadata from storage.
    """
    config = get_object_store_config()
    client = get_object_store_client(config)
    return client.head_object(Bucket=bucket, Key=key)


def download_object(
    *,
    bucket: str,
    key: str,
    local_path: str,
) -> str:
    """
    Download an object to a local file path.
    """
    config = get_object_store_config()
    client = get_object_store_client(config)
    client.download_file(bucket, key, local_path)
    return local_path
