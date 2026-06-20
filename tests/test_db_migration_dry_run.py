import importlib.util
import json
import subprocess
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "tools" / "db_migration.py"

spec = importlib.util.spec_from_file_location("db_migration", MODULE_PATH)
db_migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(db_migration)


class DbMigrationDryRunTest(unittest.TestCase):
    def sample_status(self):
        return [
            {
                "version": "20210101000000",
                "description": "Initial schema",
                "type": "sql",
                "applied": True,
            },
            {
                "version": "20210102000000",
                "description": "Add user profiles",
                "type": "sql",
                "applied": True,
            },
            {
                "version": "20210103000000",
                "description": "Create audit logs",
                "type": "sql",
                "applied": False,
            },
        ]

    def test_no_pending_migrations_returns_empty_plan(self):
        status = [
            {**migration, "applied": True}
            for migration in self.sample_status()
        ]

        plan = db_migration.build_dry_run_plan(status, "up")

        self.assertTrue(plan["dry_run"])
        self.assertEqual("up", plan["direction"])
        self.assertFalse(plan["execution_attempted"])
        self.assertEqual(0, plan["migration_count"])
        self.assertEqual([], plan["migrations"])

    def test_pending_migrations_include_machine_readable_fields(self):
        plan = db_migration.build_dry_run_plan(self.sample_status(), "up")

        self.assertEqual(1, plan["migration_count"])
        migration = plan["migrations"][0]
        self.assertEqual("20210103000000", migration["version"])
        self.assertEqual("Create audit logs", migration["description"])
        self.assertEqual("up", migration["direction"])
        self.assertFalse(migration["execution_attempted"])
        self.assertTrue(migration["would_execute"])

    def test_specific_rollback_target_plans_only_applied_migrations(self):
        plan = db_migration.build_dry_run_plan(
            self.sample_status(),
            "down",
            target_version="20210101000000",
        )

        self.assertEqual("down", plan["direction"])
        self.assertEqual(2, plan["migration_count"])
        self.assertEqual(
            ["20210102000000", "20210101000000"],
            [migration["version"] for migration in plan["migrations"]],
        )
        self.assertTrue(
            all(migration["direction"] == "down" for migration in plan["migrations"])
        )

    def test_rollback_to_unapplied_target_fails_clearly(self):
        with self.assertRaises(ValueError) as ctx:
            db_migration.build_dry_run_plan(
                self.sample_status(),
                "down",
                target_version="20210103000000",
            )

        self.assertIn("not yet applied", str(ctx.exception))

    def test_up_dry_run_json_cli_does_not_require_postgres(self):
        result = subprocess.run(
            [
                sys.executable,
                str(MODULE_PATH),
                "--up",
                "--dry-run",
                "--json",
            ],
            capture_output=True,
            text=True,
            check=True,
        )

        plan = json.loads(result.stdout)
        self.assertTrue(plan["dry_run"])
        self.assertEqual("up", plan["direction"])
        self.assertFalse(plan["execution_attempted"])
        self.assertEqual(len(db_migration.MIGRATIONS), plan["migration_count"])

    def test_down_dry_run_json_cli_reports_json_errors(self):
        result = subprocess.run(
            [
                sys.executable,
                str(MODULE_PATH),
                "--down",
                "--version",
                "20210101000000",
                "--dry-run",
                "--json",
            ],
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(1, result.returncode)
        self.assertEqual("", result.stdout)
        error = json.loads(result.stderr)
        self.assertIn("not yet applied", error["error"])


if __name__ == "__main__":
    unittest.main()
