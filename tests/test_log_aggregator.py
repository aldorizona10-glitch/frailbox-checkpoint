import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "tools" / "log_aggregator.py"


def run_log_aggregator(*args):
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )


def test_no_input_exits_with_usage_error():
    result = run_log_aggregator()

    assert result.returncode == 2
    assert "at least one input source is required" in result.stderr
    assert "Traceback" not in result.stderr


def test_empty_file_exports_zero_entry_report(tmp_path):
    log_file = tmp_path / "empty.log"
    output_file = tmp_path / "report.json"
    log_file.write_text("", encoding="utf-8")

    result = run_log_aggregator("--input", str(log_file), "--output", str(output_file))

    assert result.returncode == 0
    assert "Total entries: 0" in result.stdout
    assert "Time range: N/A to N/A" in result.stdout
    assert "Traceback" not in result.stderr
    report = json.loads(output_file.read_text(encoding="utf-8"))
    assert report["summary"]["total_entries"] == 0
    assert report["summary"]["time_range"] is None


def test_missing_file_exits_cleanly(tmp_path):
    missing_file = tmp_path / "missing.log"

    result = run_log_aggregator("--input", str(missing_file))

    assert result.returncode == 1
    assert f"Input file not found: {missing_file}" in result.stderr
    assert "Traceback" not in result.stderr


def test_successful_export_parses_json_log(tmp_path):
    log_file = tmp_path / "app.log"
    output_file = tmp_path / "report.json"
    log_file.write_text(
        json.dumps(
            {
                "timestamp": 1710000000,
                "level": "error",
                "service": "payments",
                "message": "payment failed",
            }
        )
        + "\n",
        encoding="utf-8",
    )

    result = run_log_aggregator("--input", str(log_file), "--output", str(output_file))

    assert result.returncode == 0
    report = json.loads(output_file.read_text(encoding="utf-8"))
    assert report["summary"]["total_entries"] == 1
    assert report["summary"]["by_level"] == {"error": 1}
    assert report["summary"]["by_service"] == {"payments": 1}
