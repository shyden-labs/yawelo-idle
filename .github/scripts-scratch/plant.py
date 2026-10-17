"""Throwaway (#649): plants one change, asserting its anchor matches once."""

import sys

path, anchor, replacement = sys.argv[1:4]
text = open(path, encoding="utf-8").read()
count = text.count(anchor)
if count != 1:
    sys.exit(f"{path}: {count} matches of {anchor!r}")
open(path, "w", encoding="utf-8").write(text.replace(anchor, replacement))
print(f"planted in {path}")
