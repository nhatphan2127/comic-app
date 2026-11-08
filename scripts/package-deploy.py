"""Build the deployment bundle deploy-dist/comic-app-deploy.zip.

    python scripts/package-deploy.py

Layout inside the zip:
    app/backend, app/frontend, app/default.conf   -> /opt/comic-app on the app server
    object-storage/seaweedfs                      -> SeaweedFS Dockerfile + init.sh (app server)
    monitoring/                                   -> monitoring server (monitoring/agent -> app server)
    README.md

Secrets (.env), dependencies, build output, runtime data and logs are never packaged; only *.env.example.
Text files are normalized to LF so shell scripts and env files work on Linux even when the Windows
checkout uses CRLF. *.sh files are marked executable.
"""
from __future__ import annotations

import fnmatch
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "deploy-dist"
OUT_FILE = OUT_DIR / "comic-app-deploy.zip"

# Directory/file names excluded anywhere in the tree.
COMMON_EXCLUDES = {"node_modules", ".git", ".DS_Store", "Thumbs.db", "__pycache__"}

# (source relative to ROOT, destination inside the zip, extra excludes relative to the source)
SOURCES = [
    ("backend", "app/backend", ["data", "storage", "logs", "tests", "coverage", "vitest.config.js", "instruction.md"]),
    ("frontend", "app/frontend", ["dist", "coverage"]),
    ("nginx/default.conf", "app/default.conf", []),
    ("storage/seaweedfs", "object-storage/seaweedfs", []),
    ("monitoring", "monitoring", []),
    ("README.md", "README.md", []),
]

TEXT_SUFFIXES = {
    ".js", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".md", ".css", ".html", ".svg", ".yml", ".yaml",
    ".conf", ".service", ".sh", ".alloy", ".txt", ".webmanifest", ".example", ".gitkeep",
}
TEXT_NAMES = {"Dockerfile", ".gitignore", ".gitkeep"}


def is_env_secret(name: str) -> bool:
    # .env, .env.local, .env.production ... but keep *.env.example templates
    return (name == ".env" or name.startswith(".env.")) and not name.endswith(".example")


def excluded(rel: Path, extra: list[str]) -> bool:
    parts = rel.parts
    if any(p in COMMON_EXCLUDES for p in parts):
        return True
    if is_env_secret(parts[-1]):
        return True
    rel_posix = rel.as_posix()
    return any(rel_posix == e or rel_posix.startswith(e + "/") or fnmatch.fnmatch(rel_posix, e) for e in extra)


def is_text(path: Path) -> bool:
    return path.suffix.lower() in TEXT_SUFFIXES or path.name in TEXT_NAMES


def add_file(zf: zipfile.ZipFile, src: Path, arcname: str) -> None:
    data = src.read_bytes()
    if is_text(src) and b"\0" not in data:
        data = data.replace(b"\r\n", b"\n")
    info = zipfile.ZipInfo(arcname, date_time=_mtime(src))
    info.compress_type = zipfile.ZIP_DEFLATED
    mode = 0o755 if src.suffix == ".sh" else 0o644
    info.external_attr = (0o100000 | mode) << 16  # regular file + unix permissions
    info.create_system = 3  # unix, so unzip honours the permission bits
    zf.writestr(info, data)


def _mtime(path: Path):
    import time

    t = time.localtime(path.stat().st_mtime)
    return (max(t.tm_year, 1980), t.tm_mon, t.tm_mday, t.tm_hour, t.tm_min, t.tm_sec)


def main() -> int:
    OUT_DIR.mkdir(exist_ok=True)
    count = 0
    with zipfile.ZipFile(OUT_FILE, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for src_rel, dest, extra in SOURCES:
            src = ROOT / src_rel
            if not src.exists():
                print(f"missing: {src_rel}", file=sys.stderr)
                return 1
            if src.is_file():
                add_file(zf, src, dest)
                count += 1
                continue
            for path in sorted(src.rglob("*")):
                if not path.is_file():
                    continue
                rel = path.relative_to(src)
                if excluded(rel, extra):
                    continue
                add_file(zf, path, f"{dest}/{rel.as_posix()}")
                count += 1
    size_mb = OUT_FILE.stat().st_size / (1024 * 1024)
    print(f"{OUT_FILE} ({count} files, {size_mb:.1f} MiB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
