import subprocess
import sys
import unittest

import build


class ModuleSelectionTests(unittest.TestCase):
    def test_parse_module_names_strips_optional_spaces(self):
        self.assertEqual(
            build.parse_module_names(" frontend, market ,backend "),
            ["frontend", "market", "backend"],
        )

    def test_select_all_returns_every_known_module(self):
        selected, invalid = build.select_modules("all")

        self.assertEqual(invalid, [])
        self.assertEqual([module.name for module in selected], build.valid_module_names())

    def test_select_modules_reports_invalid_names(self):
        selected, invalid = build.select_modules("frontend, missing-one, backend")

        self.assertEqual([module.name for module in selected], ["backend", "frontend"])
        self.assertEqual(invalid, ["missing-one"])

    def test_list_modules_cli_outputs_clean_commands(self):
        result = subprocess.run(
            [sys.executable, "build.py", "--list-modules"],
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Available modules:", result.stdout)
        self.assertIn("clean:", result.stdout)

    def test_clean_path_validates_module_before_cleaning(self):
        result = subprocess.run(
            [sys.executable, "build.py", "--clean", "--module", "not-a-module"],
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 1)
        self.assertIn("Unknown module name(s):", result.stdout)
        self.assertIn("Available:", result.stdout)
        self.assertNotIn("Cleaning build artifacts", result.stdout)


if __name__ == "__main__":
    unittest.main()
