import os
import re

import fiona
import geopandas as gpd
import numpy as np
import rasterio
import rioxarray
import xarray as xr
import zarr
from distributed import (
    Client,
)
from rasterio.enums import (
    Resampling,
)
from rasterio.features import (
    rasterize,
)
from rasterio.transform import (
    from_origin,
)
from rasterio.vrt import (
    WarpedVRT,
)
from tqdm import (
    tqdm,
)

# === Config ===
INPUT_ROOT = "data/tifs"
ZARR_OUTPUT_PATH = "data/output_1000.zarr"
CHUNK_SIZE = {"x": 4096, "y": 4096}

CATEGORY_LABELS = {
    "human_disturbance": {
        1: "Mining",
        2: "Rail & Infrastructure",
        3: "Oil and Gas Infrastructure (Roads)",
        4: "Power",
        5: "Right of Ways",
        6: "Urban",
        7: "Recreation",
        8: "Oil and Gas Geophysical",
        9: "Cut blocks",
        10: "Agriculture",
        11: "Results Reserves",
    },
    "roads": {
        1: "Hwy, Arterial",
        2: "Primary, Paved",
        3: "Secondary FSR",
        4: "Tertiary, Operational Local",
        5: "Quaternary, In-Block",
        6: "Trail",
    },
    "protected_areas": {
        1: "National Park",
        2: "Ecological Reserve",
        3: "Provincial Park",
        4: "Conservancy",
        5: "Protected Area",
        6: "Heritage Site",
        7: "Recreation Area",
        8: "Regional Park",
    },
}


def safe_varname(label: str) -> str:
    name = re.sub(r"\W+", "_", label.lower()).strip("_")
    return f"val_{name}" if name and name[0].isdigit() else name


def rasterize_gdb(
    gdb_path,
    target_crs,
    transform,
    width,
    height,
    output_dir="data/tifs/ecological/species",
):
    os.makedirs(output_dir, exist_ok=True)
    created_tifs = []

    for layer_name in fiona.listlayers(gdb_path):
        try:
            gdf = gpd.read_file(gdb_path, layer=layer_name).iloc[:10]
            if gdf.empty or not gdf.geometry.notnull().any():
                continue

            gdf = gdf.to_crs(target_crs)
            shapes = ((geom, 1) for geom in gdf.geometry if geom is not None)

            out_arr = rasterize(
                shapes=shapes,
                out_shape=(height, width),
                transform=transform,
                fill=0,
                dtype="uint8",
            )

            meta = {
                "driver": "GTiff",
                "height": height,
                "width": width,
                "count": 1,
                "dtype": "uint8",
                "crs": target_crs,
                "transform": transform,
            }

            output_path = os.path.join(
                output_dir,
                f"{os.path.basename(gdb_path).removesuffix('.gdb')}_{layer_name}.tif",
            )

            with rasterio.open(output_path, "w", **meta) as dst:
                dst.write(out_arr, 1)

            created_tifs.append(output_path)

        except Exception as e:
            print(f"⚠ Skipping layer '{layer_name}' in {gdb_path}: {e}")

    return created_tifs


def open_and_reproject(path, crs, transform, width, height, resampling):
    with rasterio.open(path) as src:
        with WarpedVRT(
            src,
            crs=crs,
            transform=transform,
            width=width,
            height=height,
            resampling=resampling,
        ) as vrt:
            return rioxarray.open_rasterio(vrt, chunks=CHUNK_SIZE).squeeze(
                "band", drop=True
            )


def create_category_dataset(da_input, base_name, label_dict):
    unique_vals = np.unique(da_input.data.compute())
    mask_vars = {}

    for val in unique_vals:
        if val == 0 or np.isnan(val):
            continue
        label = label_dict.get(int(val), f"Value {int(val)}")
        varname = safe_varname(label)
        mask = (da_input == val).astype("uint8")
        mask.name = varname
        mask.attrs = {
            "label": label,
            "description": (
                f"Binary mask for value {int(val)}: {label} (1=present, 0=absent)"
            ),
        }
        mask_vars[varname] = mask

    if not mask_vars:
        return None

    if len(mask_vars) > 1:
        any_mask = (
            xr.concat(list(mask_vars.values()), dim="category")
            .max("category")
            .astype("uint8")
        )
        any_mask.name = f"any_{base_name}"
        any_mask.attrs = {
            "label": f"Any {base_name}",
            "description": f"Binary mask where any {base_name} category is present.",
        }
        mask_vars[any_mask.name] = any_mask

    return xr.Dataset(mask_vars)


def write_dataset_to_zarr(ds: xr.Dataset, group_path: str):
    encoding = {
        var: {"compressor": zarr.Blosc(cname="zstd", clevel=3)} for var in ds.data_vars
    }
    ds.to_zarr(
        ZARR_OUTPUT_PATH,
        group=group_path,
        mode="w",
        encoding=encoding,
        write_empty_chunks=False,
        consolidated=False,
    )


def find_reference_tif():
    for root, _, files in os.walk(INPUT_ROOT):
        for f in files:
            if f.endswith(".tif"):
                return os.path.join(root, f)
    return None


def main():
    client = Client()

    print("▶ Scanning input directory for GDBs...")
    gdb_paths = [
        os.path.join(root, d)
        for root, dirs, _ in os.walk(INPUT_ROOT)
        for d in dirs
        if d.endswith(".gdb")
    ]

    if not gdb_paths:
        print("⚠ No GDBs found, continuing with existing TIFFs...")

    reference_tif = find_reference_tif()
    if not reference_tif:
        raise FileNotFoundError("No reference .tif found to infer CRS and bounds.")

    with rasterio.open(reference_tif) as src:
        target_crs = src.crs
        bounds = src.bounds

    target_res = 5000
    width = int((bounds.right - bounds.left) / target_res)
    height = int((bounds.top - bounds.bottom) / target_res)
    transform = from_origin(bounds.left, bounds.top, target_res, target_res)

    if gdb_paths:
        print(f"▶ Converting {len(gdb_paths)} GDB(s) to TIFF...")
        for gdb_path in gdb_paths:
            rasterize_gdb(gdb_path, target_crs, transform, width, height)

    print("▶ Scanning for all TIFFs...")
    all_tifs = [
        os.path.join(root, f)
        for root, _, files in os.walk(INPUT_ROOT)
        for f in files
        if f.endswith(".tif")
    ]

    if not all_tifs:
        raise FileNotFoundError("No .tif files found in input directory.")

    print(f"▶ Found {len(all_tifs)} TIFFs")
    for tif_path in tqdm(all_tifs, desc="Processing TIFFs"):
        rel_path = os.path.relpath(tif_path, INPUT_ROOT)
        group_path = os.path.dirname(rel_path).replace(os.sep, "/")
        base_name = os.path.splitext(os.path.basename(tif_path))[0]

        da = open_and_reproject(
            tif_path, target_crs, transform, width, height, Resampling.mode
        )
        da.name = base_name

        if base_name in CATEGORY_LABELS:
            cat_ds = create_category_dataset(da, base_name, CATEGORY_LABELS[base_name])
            if cat_ds:
                write_dataset_to_zarr(cat_ds, group_path)
        else:
            da.attrs = {
                "label": base_name.replace("_", " ").title(),
                "description": f"Continuous raster from {base_name}.tif",
            }
            write_dataset_to_zarr(xr.Dataset({base_name: da}), group_path)

    print(f"✅ Finished writing to {ZARR_OUTPUT_PATH}")
    zarr.consolidate_metadata(ZARR_OUTPUT_PATH)
    print("✅ Metadata consolidated.")

    client.close()


if __name__ == "__main__":
    main()
