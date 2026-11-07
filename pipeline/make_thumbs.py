"""Make 320px-wide thumbnails of the matched storefront images for the sidebar strip."""
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "web" / "public" / "images"
DST = ROOT / "web" / "public" / "thumbs"
WIDTH = 320


def main():
    DST.mkdir(exist_ok=True)
    keep = set()
    for src in SRC.glob("*.jpg"):
        keep.add(src.name)
        out = DST / src.name
        if out.exists():
            continue
        img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        img.thumbnail((WIDTH, WIDTH * 2))
        img.save(out, quality=78, optimize=True)
    for stale in DST.glob("*.jpg"):
        if stale.name not in keep:
            stale.unlink()
    print(f"{len(keep)} thumbs -> {DST}")


if __name__ == "__main__":
    main()
