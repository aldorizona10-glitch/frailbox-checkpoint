import importlib.util
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "health_check", ROOT / "tools" / "health_check.py"
)
health_check = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(health_check)


class FakeResponse:
    def __init__(self, status=200, body=b"ok"):
        self.status = status
        self._body = body

    def read(self):
        return self._body


class FakeConnection:
    def __init__(self, response=None, error=None):
        self.response = response or FakeResponse()
        self.error = error
        self.closed = False

    def request(self, method, path):
        if self.error is not None:
            raise self.error

    def getresponse(self):
        return self.response

    def close(self):
        self.closed = True


class HealthCheckRetryTests(TestCase):
    def test_http_probe_succeeds_after_retry(self):
        connections = [
            FakeConnection(error=OSError("temporary failure")),
            FakeConnection(response=FakeResponse(200)),
        ]
        sleep_calls = []

        with patch("http.client.HTTPConnection", side_effect=connections):
            with self.assertLogs(health_check.logger, level="WARNING") as logs:
                status, detail, code = health_check.check_http_service(
                    "localhost",
                    8080,
                    "/health",
                    5,
                    max_attempts=2,
                    initial_backoff=0.25,
                    sleep_func=sleep_calls.append,
                )

        self.assertEqual((status, detail, code), ("OK", "HTTP 200", 200))
        self.assertEqual(sleep_calls, [0.25])
        self.assertIn("attempt 1/2", logs.output[0])
        self.assertTrue(all(conn.closed for conn in connections))

    def test_http_probe_exhausts_retries(self):
        connections = [
            FakeConnection(error=ConnectionError("still down")),
            FakeConnection(error=ConnectionError("still down")),
            FakeConnection(error=ConnectionError("still down")),
        ]
        sleep_calls = []

        with patch("http.client.HTTPConnection", side_effect=connections):
            with self.assertLogs(health_check.logger, level="WARNING") as logs:
                status, detail, code = health_check.check_http_service(
                    "localhost",
                    8080,
                    "/health",
                    5,
                    max_attempts=3,
                    initial_backoff=0.5,
                    sleep_func=sleep_calls.append,
                )

        self.assertEqual(status, "CRITICAL")
        self.assertEqual(detail, "still down")
        self.assertEqual(code, 0)
        self.assertEqual(sleep_calls, [0.5, 1.0])
        self.assertEqual(len(logs.output), 2)
        self.assertIn("attempt 2/3", logs.output[1])
        self.assertTrue(all(conn.closed for conn in connections))
