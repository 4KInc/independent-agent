#!/usr/bin/env python3
"""Independence check — asserts this repo imports NOTHING from the gateway package.

Scans all .py files in this repo for any import of the gateway package.
Exits non-zero if any gateway import is found.
"""

import os
import re
import sys


def main():
    repo_root = os.path.dirname(os.path.abspath(__file__))
    violations = []

    # Patterns that would indicate importing from the gateway codebase
    patterns = [
        re.compile(r"^\s*from\s+gateway[\s.]"),
        re.compile(r"^\s*import\s+gateway[\s.]"),
        re.compile(r"^\s*import\s+gateway\s*$"),
        re.compile(r"^\s*from\s+gateway\s+import"),
    ]

    for dirpath, dirnames, filenames in os.walk(repo_root):
        # Skip venvs, __pycache__, .git
        dirnames[:] = [d for d in dirnames if d not in (".venv", "__pycache__", ".git", "node_modules")]
        for fname in filenames:
            if not fname.endswith(".py"):
                continue
            fpath = os.path.join(dirpath, fname)
            rel = os.path.relpath(fpath, repo_root)
            with open(fpath) as f:
                for lineno, line in enumerate(f, 1):
                    for pat in patterns:
                        if pat.search(line):
                            violations.append(f"{rel}:{lineno}: {line.rstrip()}")

    if violations:
        print("INDEPENDENCE CHECK FAILED — gateway imports found:")
        for v in violations:
            print(f"  {v}")
        return 1
    else:
        print("INDEPENDENCE CHECK PASSED — zero imports from the gateway package")
        return 0


if __name__ == "__main__":
    sys.exit(main())
