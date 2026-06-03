import os
from pathlib import Path
import shutil
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

import boto3
import fsspec
from botocore.config import Config


@dataclass(frozen=True)
class ObjectStoreConfig:
    endpoint: str
    region: str
    access_key: str
    secret_key: str
    force_path_style: bool
    bucket: str


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
    )


def get_source_object_store_config() -> ObjectStoreConfig:
    """
    Load source object store configuration for reading the Zarr layer library.
    """
    endpoint = (
        os.getenv("SOURCE_OBJECT_STORE_ENDPOINT")
        or os.getenv("SOURCE_OBJECT_STORE_URL")
        or os.getenv("OBJECT_STORE_ENDPOINT")
        or os.getenv("OBJECT_STORE_URL")
    )
    region = os.getenv("SOURCE_OBJECT_STORE_REGION") or os.getenv(
        "OBJECT_STORE_REGION", "us-east-1"
    )
    access_key = os.getenv("SOURCE_OBJECT_STORE_ACCESS_KEY_ID") or os.getenv(
        "OBJECT_STORE_ACCESS_KEY_ID"
    )
    secret_key = os.getenv("SOURCE_OBJECT_STORE_SECRET_KEY_ID") or os.getenv(
        "OBJECT_STORE_SECRET_KEY_ID"
    )
    bucket = os.getenv("SOURCE_OBJECT_STORE_BUCKET_NAME") or os.getenv(
        "OBJECT_STORE_BUCKET_NAME"
    )
    force_path_style = _parse_bool(
        os.getenv("SOURCE_OBJECT_STORE_FORCE_PATH_STYLE")
        or os.getenv("OBJECT_STORE_FORCE_PATH_STYLE")
    )

    if not endpoint:
        raise ValueError("SOURCE_OBJECT_STORE_ENDPOINT is not configured.")
    if not access_key or not secret_key:
        raise ValueError("Source object storage credentials are not configured.")
    if not bucket:
        raise ValueError("SOURCE_OBJECT_STORE_BUCKET_NAME is not configured.")

    return ObjectStoreConfig(
        endpoint=_normalize_endpoint(endpoint),
        region=region,
        access_key=access_key,
        secret_key=secret_key,
        force_path_style=force_path_style,
        bucket=bucket,
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


def get_source_zarr_store(zarr_path: Optional[str]):
    """
    Build an xarray-compatible Zarr store using SOURCE_OBJECT_STORE_* when the
    configured path points at object storage.
    """
    if not zarr_path:
        raise ValueError("ZARR_STORE_PATH is not configured.")

    if not _is_remote_zarr_path(zarr_path) and not os.getenv(
        "SOURCE_OBJECT_STORE_BUCKET_NAME"
    ):
        return zarr_path.strip().strip("\"'")

    config = get_source_object_store_config()
    key = build_object_key(_normalize_zarr_path(zarr_path, config.bucket))
    storage_options: Dict[str, Any] = {
        "key": config.access_key,
        "secret": config.secret_key,
        "client_kwargs": {
            "endpoint_url": config.endpoint,
            "region_name": config.region,
        },
    }

    if config.force_path_style:
        storage_options["config_kwargs"] = {"s3": {"addressing_style": "path"}}

    fs = fsspec.filesystem("s3", **storage_options)

    return fs.get_mapper(f"{config.bucket}/{key}")


def get_source_boundary_key() -> str:
    """
    Build the source object key for the BC boundary asset.
    """
    boundary_path = os.getenv("SOURCE_BC_BOUNDARY_PATH")

    if not boundary_path:
        raise ValueError("SOURCE_BC_BOUNDARY_PATH is not configured.")

    config = get_source_object_store_config()
    return build_object_key(_normalize_source_path(boundary_path, config.bucket))


def download_source_object(
    *,
    key: str,
    local_path: str,
) -> str:
    """
    Download a source object or object prefix from source object storage to local path.
    """
    if not key:
        raise ValueError("Source object key is required.")
    if not local_path:
        raise ValueError("local_path is required.")

    config = get_source_object_store_config()
    local_target = Path(local_path)
    if local_target.exists():
        if local_target.is_file():
            local_target.unlink()
        else:
            shutil.rmtree(local_target)

    local_target.parent.mkdir(parents=True, exist_ok=True)

    storage_options: Dict[str, Any] = {
        "key": config.access_key,
        "secret": config.secret_key,
        "client_kwargs": {
            "endpoint_url": config.endpoint,
            "region_name": config.region,
        },
    }

    if config.force_path_style:
        storage_options["config_kwargs"] = {"s3": {"addressing_style": "path"}}

    fs = fsspec.filesystem("s3", **storage_options)
    fs.get(f"{config.bucket}/{key}", str(local_target), recursive=True)

    if not local_target.exists():
        raise FileNotFoundError(f"Failed to download source object to {local_target}")

    return str(local_target)


def build_object_key(key: str) -> str:
    """
    Build a normalized object key.
    """
    return key.lstrip("/")


def _is_remote_zarr_path(zarr_path: str) -> bool:
    normalized = zarr_path.strip().strip("\"'")

    return (
        normalized.startswith("s3://")
        or normalized.startswith("http://")
        or normalized.startswith("https://")
    )


def _normalize_zarr_path(zarr_path: str, bucket: Optional[str] = None) -> str:
    normalized = zarr_path.strip().strip("\"'")

    if normalized.startswith("s3://"):
        without_scheme = normalized[len("s3://") :]
        parts = without_scheme.split("/", 1)
        if len(parts) == 1:
            return ""
        return parts[1].strip("/")

    if normalized.startswith("http://") or normalized.startswith("https://"):
        without_scheme = normalized.split("://", 1)[1]
        path_parts = without_scheme.split("/")[1:]
        if bucket and path_parts and path_parts[0] == bucket:
            path_parts = path_parts[1:]
        return "/".join(path_parts).strip("/")

    return _strip_bucket_prefix(normalized, bucket)


def _strip_bucket_prefix(path: str, bucket: Optional[str]) -> str:
    """
    Strip a plain <bucket>/ prefix from source paths when present.
    """
    normalized_bucket = bucket.strip("/") if bucket else ""
    if normalized_bucket and path.startswith(f"{normalized_bucket}/"):
        return path[len(normalized_bucket) + 1 :]
    return path.strip("/")


def _normalize_source_path(source_path: str, bucket: Optional[str] = None) -> str:
    return _normalize_zarr_path(source_path, bucket)


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
