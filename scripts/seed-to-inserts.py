#!/usr/bin/env python3
"""
Convert COPY FROM stdin blocks in a pg_dump seed file to
INSERT ... ON CONFLICT DO NOTHING statements.

Works with any PostgreSQL client (psql, pgx, Prisma, etc.).

Usage:
    python3 scripts/seed-to-inserts.py supabase/seed.sql
"""

import re
import sys


def decode_copy_field(field: str) -> str | None:
    """
    Decode a single COPY text-format field into a Python string.
    Returns None for NULL (backslash-N).
    """
    if field == "\\N":
        return None

    chars = []
    i = 0
    while i < len(field):
        if field[i] == "\\" and i + 1 < len(field):
            nc = field[i + 1]
            if nc == "N":
                chars.append("\\N")  # literal \N (not a NULL)
            elif nc == "t":
                chars.append("\t")
            elif nc == "n":
                chars.append("\n")
            elif nc == "r":
                chars.append("\r")
            elif nc == "\\":
                chars.append("\\")
            elif nc == "b":
                chars.append("\b")
            elif nc == "f":
                chars.append("\f")
            elif nc == "v":
                chars.append("\v")
            else:
                chars.append(field[i])
                chars.append(field[i + 1])
            i += 2
        else:
            chars.append(field[i])
            i += 1

    return "".join(chars)


def to_sql_literal(field: str) -> str:
    """Convert a decoded COPY field value to a SQL literal."""
    value = decode_copy_field(field)
    if value is None:
        return "NULL"
    # Escape single quotes for SQL string literal
    escaped = value.replace("'", "''")
    return f"'{escaped}'"


COPY_RE = re.compile(r"^COPY (\S+) \((.+)\) FROM stdin;$")


def convert(path: str) -> None:
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()

    out: list[str] = []
    in_copy = False
    table = ""
    columns: list[str] = []
    rows: list[str] = []

    for line in lines:
        if not in_copy:
            m = COPY_RE.match(line)
            if m:
                table = m.group(1)
                columns = [c.strip() for c in m.group(2).split(",")]
                rows = []
                in_copy = True
            else:
                out.append(line)
        else:
            if line == "\\.":
                in_copy = False
                if rows:
                    col_list = ", ".join(columns)
                    out.append(f"INSERT INTO {table} ({col_list}) VALUES")
                    out.append(",\n".join(rows))
                    out.append("ON CONFLICT DO NOTHING;")
                out.append("")
            else:
                fields = line.split("\t")
                literals = [to_sql_literal(f) for f in fields]
                rows.append("(" + ", ".join(literals) + ")")

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")

    print(f"Converted: {path}")


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "supabase/seed.sql"
    convert(target)
