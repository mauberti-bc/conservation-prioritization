import numpy as np


def resolution_to_max_zoom(
    resolution: int,
    min_res: int = 30,
    max_res: int = 5000,
    min_zoom: int = 7,
    max_zoom: int = 13,
) -> int:
    """Map a planning-grid resolution to a bounded presentation zoom level."""
    resolved = np.clip(resolution, min_res, max_res)
    proportion = (np.log(resolved) - np.log(min_res)) / (
        np.log(max_res) - np.log(min_res)
    )
    return int(round(max_zoom - proportion * (max_zoom - min_zoom)))
