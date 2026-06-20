#!/bin/sh
set -u

passed=0
failed=0
skipped=0

run_case() {
    name=$1
    binary=$2

    if [ ! -x "$binary" ]; then
        printf 'SKIP %-28s %s not executable\n' "$name" "$binary"
        skipped=$((skipped + 1))
        return
    fi

    if "$binary"; then
        printf 'PASS %-28s\n' "$name"
        passed=$((passed + 1))
    else
        rc=$?
        printf 'FAIL %-28s exit=%s\n' "$name" "$rc"
        failed=$((failed + 1))
    fi
}

run_case "connector" "$1"
run_case "arena-smoke" "$2"
run_case "logger-smoke" "$3"
run_case "sandbox-smoke" "$4"

printf 'frailbox self-test summary: passed=%s failed=%s skipped=%s\n' "$passed" "$failed" "$skipped"

if [ "$failed" -ne 0 ]; then
    exit 1
fi
exit 0
