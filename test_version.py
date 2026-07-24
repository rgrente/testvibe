"""Test for the VERSION file.

Uses only the Python standard library (unittest).
Run with: python -m unittest -v
"""

import os
import unittest


VERSION_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "VERSION")

EXPECTED_VERSION = "0.1.0"


class VersionFileTest(unittest.TestCase):
    def test_version_file_contains_expected_version(self):
        with open(VERSION_PATH, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertEqual(content, EXPECTED_VERSION)


if __name__ == "__main__":
    unittest.main()
