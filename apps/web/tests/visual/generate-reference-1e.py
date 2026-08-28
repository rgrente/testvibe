#!/usr/bin/env python3
"""Regenerate the five normative 1e crops from the verified issue archive."""

from __future__ import annotations

import argparse
import hashlib
import shutil
import subprocess
import tempfile
from pathlib import Path
from zipfile import ZipFile

ARCHIVE_SHA256 = "64ffe56f2c10c5e9506a4cb338f3d5e2c3f002658e8e87a5257faef14da0056b"
CROP_SHA256 = {
    "fan.png": "482a2ad8fc4e8868234a0cf5961b85d13f085e07a658017665dc14bd614829d0",
    "statistics.png": "b69972c69de971d5c6957c2316fe25099eec1bfbca08329652da174d4b8cdbe3",
    "map.png": "88fb9a9af090c7c700406607cc6b920448095de1438fcc45a74eca7891ff2118",
    "gedcom.png": "f0e7db3663fd4771992e41a8ea89c8260683a78ffebe7c354f5fe236f7a7d339",
    "on-this-day.png": "f10a5579cdbc035a053790a78d979b5702221fb898c3f42a0ba7d92d25183bc5",
}


def digest(path: Path) -> str:
    checksum = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            checksum.update(chunk)
    return checksum.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path, help="Path to the normative ZIP archive")
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("reference-1e"))
    parser.add_argument("--check", action="store_true", help="Verify tracked crops after a reproducible temporary render")
    args = parser.parse_args()

    archive = args.archive.resolve()
    if digest(archive) != ARCHIVE_SHA256:
        raise SystemExit(f"archive SHA-256 mismatch: {digest(archive)}")

    script = Path(__file__).with_name("generate-reference-1e.mjs")
    with tempfile.TemporaryDirectory(prefix="testvibe-reference-1e-") as temporary:
        work = Path(temporary)
        with ZipFile(archive) as source:
            html_name = "Arbre Genealogique.dc.html"
            for member in source.infolist():
                destination = (work / member.filename).resolve()
                if work.resolve() not in destination.parents and destination != work.resolve():
                    raise SystemExit(f"unsafe archive member: {member.filename}")
            source.extractall(work)
        rendered = work / "rendered"
        subprocess.run(["node", str(script), str(work / html_name), str(rendered)], check=True)

        for filename, expected in CROP_SHA256.items():
            actual = digest(rendered / filename)
            if actual != expected:
                raise SystemExit(f"{filename} SHA-256 mismatch: expected {expected}, got {actual}")
            if args.check:
                tracked = args.output / filename
                if not tracked.is_file() or digest(tracked) != expected:
                    raise SystemExit(f"tracked crop mismatch: {tracked}")
            else:
                args.output.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(rendered / filename, args.output / filename)

    print(f"verified archive {ARCHIVE_SHA256} and {len(CROP_SHA256)} crops")


if __name__ == "__main__":
    main()
