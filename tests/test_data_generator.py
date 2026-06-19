import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools import data_generator


class DataGeneratorCliTests(unittest.TestCase):
    def test_format_both_writes_json_and_csv_outputs(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            data_generator.main([
                "--output-dir", tmpdir,
                "--seed", "123",
                "--users", "2",
                "--orders", "2",
                "--trades", "2",
                "--ticks", "1",
                "--candles", "1",
                "--format", "both",
            ])

            expected_json = [
                "users.json",
                "orders.json",
                "trades.json",
                "ticks.json",
                "candles.json",
                "instruments.json",
            ]
            expected_csv = ["users.csv", "orders.csv", "trades.csv"]
            for filename in expected_json + expected_csv:
                self.assertTrue((Path(tmpdir) / filename).exists(), filename)

            users = json.loads((Path(tmpdir) / "users.json").read_text())
            self.assertEqual({"id", "email", "name"} & set(users[0]), {"id", "email", "name"})

    def test_legacy_json_and_csv_flags_select_output_format(self):
        json_args = data_generator.parse_args(["--json"])
        csv_args = data_generator.parse_args(["--csv"])
        both_args = data_generator.parse_args(["--json", "--csv"])

        self.assertEqual(data_generator.resolve_output_format(json_args), "json")
        self.assertEqual(data_generator.resolve_output_format(csv_args), "csv")
        self.assertEqual(data_generator.resolve_output_format(both_args), "both")

    def test_negative_counts_fail_with_argparse_error(self):
        stderr = io.StringIO()
        with contextlib.redirect_stderr(stderr), self.assertRaises(SystemExit) as raised:
            data_generator.parse_args(["--users", "-1"])

        self.assertEqual(raised.exception.code, 2)
        self.assertIn("non-negative integer", stderr.getvalue())

    def test_same_seed_produces_deterministic_records(self):
        first = data_generator.DataGenerator(seed=987)
        second = data_generator.DataGenerator(seed=987)

        first_records = {
            "users": first.generate_users(5),
            "orders": first.generate_orders(5),
            "trades": first.generate_trades(5),
        }
        second_records = {
            "users": second.generate_users(5),
            "orders": second.generate_orders(5),
            "trades": second.generate_trades(5),
        }

        self.assertEqual(first_records, second_records)


if __name__ == "__main__":
    unittest.main()
