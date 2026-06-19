import unittest
from unittest import mock
import json

import build


class BuildLoggingTests(unittest.TestCase):
    def test_format_command_quotes_arguments(self):
        self.assertEqual(
            build.format_command(["python3", "script with space.py", "--flag"]),
            "python3 'script with space.py' --flag",
        )

    def test_command_diagnostic_includes_command_context(self):
        module = build.Module(
            name="sample",
            language="Python",
            dir=build.ROOT / "tools",
            build_cmd=["python3", "tool.py"],
            clean_cmd=["true"],
        )

        output = build.command_diagnostic(
            module,
            ["python3", "tool.py"],
            7,
            "hello\n",
            "warning\n",
        )

        self.assertIn("cwd: tools", output)
        self.assertIn("command: python3 tool.py", output)
        self.assertIn("exit_code: 7", output)
        self.assertIn("--- stdout ---\nhello", output)
        self.assertIn("--- stderr ---\nwarning", output)

    def test_command_error_diagnostic_includes_missing_tool_context(self):
        module = build.Module(
            name="sample",
            language="Python",
            dir=build.ROOT / "tools",
            build_cmd=["missing-tool"],
            clean_cmd=["true"],
        )

        output = build.command_error_diagnostic(
            module,
            ["missing-tool", "--version"],
            FileNotFoundError("missing-tool"),
        )

        self.assertIn("cwd: tools", output)
        self.assertIn("command: missing-tool --version", output)
        self.assertIn("exit_code: command-not-started", output)
        self.assertIn("error: missing-tool", output)


class DiagnosticErrorHandlingTests(unittest.TestCase):
    def test_record_diagnostic_failure_writes_metadata(self):
        metadata_path = build.DIAGNOSTIC_DIR / "test-diagnostic-failure.json"
        try:
            with (
                mock.patch.object(build, "commit_diagnostic_artifacts", return_value=False),
                mock.patch("builtins.print"),
            ):
                ok = build.record_diagnostic_failure(
                    metadata_path,
                    [("sample", False, 0.25, "build output", None)],
                    "deadbeef",
                    RuntimeError("archive failed"),
                    message_blocker="rerun after fixing diagnostics",
                )

            self.assertFalse(ok)
            report = json.loads(metadata_path.read_text(encoding="utf-8"))
            self.assertEqual(report["commit"], "deadbeef")
            self.assertEqual(report["diagnostic_logd_error"], "RuntimeError: archive failed")
            self.assertEqual(report["message_blocker"], "rerun after fixing diagnostics")
            self.assertEqual(report["failed"], 1)
        finally:
            metadata_path.unlink(missing_ok=True)

    def test_commit_diagnostic_artifacts_handles_git_exceptions(self):
        artifact_path = build.DIAGNOSTIC_DIR / "test-artifact.tmp"
        try:
            artifact_path.parent.mkdir(parents=True, exist_ok=True)
            artifact_path.write_text("temporary diagnostic artifact\n", encoding="utf-8")
            with (
                mock.patch.object(build.subprocess, "run", side_effect=OSError("git unavailable")),
                mock.patch("builtins.print"),
            ):
                ok = build.commit_diagnostic_artifacts([artifact_path], "deadbeef")

            self.assertFalse(ok)
        finally:
            artifact_path.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
