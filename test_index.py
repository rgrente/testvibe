"""Tests for the static status page index.html.

Uses only the Python standard library (unittest + html.parser).
Run with: python -m unittest -v
"""

import os
import unittest
from html.parser import HTMLParser


INDEX_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.html")


class _TextExtractor(HTMLParser):
    """Collects visible text (outside script/style) from an HTML document."""

    def __init__(self):
        super().__init__()
        self._skip_depth = 0
        self.text_parts = []
        self.parse_error = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip_depth += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data):
        if self._skip_depth == 0:
            self.text_parts.append(data)

    @property
    def visible_text(self):
        return " ".join(part.strip() for part in self.text_parts if part.strip())


class IndexHtmlTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not os.path.isfile(INDEX_PATH):
            raise AssertionError("index.html is missing at the repository root")
        with open(INDEX_PATH, encoding="utf-8") as fh:
            cls.html = fh.read()
        parser = _TextExtractor()
        parser.feed(cls.html)
        parser.close()
        cls.visible_text = parser.visible_text

    def test_is_valid_html_document(self):
        lowered = self.html.lstrip().lower()
        self.assertTrue(
            lowered.startswith("<!doctype html"),
            "index.html must start with an HTML5 doctype declaration",
        )
        self.assertIn("<html", lowered, "index.html must contain an <html> element")
        self.assertIn("</html>", lowered, "index.html must close the <html> element")

    def test_visible_text_contains_testvibe(self):
        self.assertIn(
            "testvibe",
            self.visible_text,
            "index.html must visibly display the text 'testvibe'",
        )

    def test_visible_text_contains_workflow_ok(self):
        self.assertIn(
            "Hermes coder workflow OK",
            self.visible_text,
            "index.html must visibly display the text 'Hermes coder workflow OK'",
        )


if __name__ == "__main__":
    unittest.main()
