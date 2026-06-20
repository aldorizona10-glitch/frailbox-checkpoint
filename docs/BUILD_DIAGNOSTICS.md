# Build Diagnostics

Build diagnostics are required for bounty PRs so reviewers can inspect the
actual build environment and module results for the submitted commit.

## Real Diagnostic Files

`python3 build.py` names diagnostics from the first eight hex characters of the
current `HEAD` commit:

- `diagnostic/build-<commit>.json`
- `diagnostic/build-<commit>.logd`
- `diagnostic/build-<commit>-part001.logd`, `part002.logd`, and so on when the
  encrypted log is larger than the chunk limit

For example, a branch whose implementation commit starts with `1a2b3c4d` should
produce `diagnostic/build-1a2b3c4d.json` and `diagnostic/build-1a2b3c4d.logd`.
The JSON metadata records the commit id, module results, encrypted log path,
decrypt password, and unpack command.

`diagnostic/build-00000000.logd` and `diagnostic/build-00000000.json` are stub
examples only. They are invalid for payouts because `00000000` means the files
were not generated for a real PR commit. Do not copy, rename, or hand-edit those
stub files.

## Generate Diagnostics

Run diagnostics after your code or documentation change is committed, and rerun
them after every rebase or final fix. The script commits the generated
diagnostic files for the current implementation commit.

```bash
git status --short
git add <changed-files>
git commit -m "Describe the implementation"
python3 build.py
git log --oneline -2
git status --short -- diagnostic
```

The build may return a nonzero exit code when unrelated modules fail in the
local environment. That is acceptable only when the generated JSON and `.logd`
still exist and clearly record the module failures.

## Verify Before Pushing

Use this check before pushing a PR:

```bash
python3 - <<'PY'
import json
from pathlib import Path

diagnostic = Path("diagnostic")
reports = sorted(diagnostic.glob("build-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f].json"))
if not reports:
    raise SystemExit("missing diagnostic/build-<commit>.json")

report = reports[-1]
data = json.loads(report.read_text())
commit = data.get("commit")
if not isinstance(commit, str) or len(commit) != 8 or commit == "00000000":
    raise SystemExit(f"invalid diagnostic commit: {commit!r}")
if data.get("diagnostic_logd_error"):
    raise SystemExit(data["diagnostic_logd_error"])
if not data.get("password"):
    raise SystemExit("missing diagnostic decrypt password")

logd = data.get("diagnostic_logd")
paths = [logd] if isinstance(logd, str) else list(logd or [])
if not paths:
    raise SystemExit("missing diagnostic_logd path")
for path in paths:
    file = Path(path)
    if not file.exists():
        raise SystemExit(f"missing referenced logd: {path}")
    if file.stat().st_size < 10240:
        raise SystemExit(f"logd is too small to be real: {path}")
print(f"diagnostic OK: {report}")
PY
git diff --check HEAD~1..HEAD
```

For split logs, reassemble chunks before unpacking:

```bash
cat diagnostic/build-<commit>-part*.logd > diagnostic/build-<commit>.logd
```

Then use the `decrypt_command` printed in the JSON metadata.

## Common Failures

### Missing Toolchains

`build.py` checks for Cargo, npm, Go, GCC, CMake, Java, Ruby, Lua, and GHC. If a
tool is missing, the script still tries the build and records the failed module
output in the diagnostic JSON and encrypted log.

Install the missing toolchain before rerunning, or use `python3 build.py -m
<module>` for local diagnosis. Bounty PRs should still include the full required
diagnostic bundle when possible.

### Encryptly Preflight Failed

Before module builds start, `build.py` verifies that `tools/encryptly/<platform>`
can create an encrypted `.logd`. If this fails, the script writes JSON with
`diagnostic_logd_error`, but that JSON alone is not a valid payout diagnostic.

Check that the platform-specific binary exists, run from the repository root,
and rerun `python3 build.py`. Do not create a fake `.logd`.

### Stale Metadata

The GitHub diagnostic check verifies that the commit recorded in
`diagnostic/build-<commit>.json` is an ancestor of the PR head and that the
referenced `.logd` files are included in the PR diff. After a rebase, amended
commit, or final code change, run diagnostics again:

```bash
python3 build.py
git push --force-with-lease
```

### Stale Stub Files

If a PR only shows the tracked `build-00000000` examples, keep those examples
unchanged and generate real files for your branch:

```bash
python3 build.py
git status --short -- diagnostic
```

Do not commit a change that deletes the `build-00000000` examples unless a
maintainer explicitly asks for that cleanup.

## Cleaning Diagnostics

`python3 build.py --clean` removes module build outputs and generated diagnostic
artifacts matching `diagnostic/build-<commit>*.json` and
`diagnostic/build-<commit>*.logd`.

Use it before regenerating a branch that has stale diagnostic files:

```bash
python3 build.py --clean
python3 build.py
```

If `--clean` marks the repository's `build-00000000` example files as deleted,
restore those examples before committing:

```bash
git restore -- diagnostic/build-00000000.json diagnostic/build-00000000.logd
```
