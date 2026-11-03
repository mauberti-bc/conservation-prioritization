import unittest

from src.utils.filename import sanitize_filename_stem


class FilenameTest(unittest.TestCase):
    def test_removes_path_separators_and_reserved_characters(self) -> None:
        self.assertEqual(
            "Coastal_Habitat", sanitize_filename_stem("../Coastal / Habitat:*?")
        )

    def test_normalizes_accents_and_bounds_length(self) -> None:
        self.assertEqual("Cafe", sanitize_filename_stem("Caf\u00e9"))
        self.assertEqual(80, len(sanitize_filename_stem("A" * 200)))

    def test_empty_or_punctuation_only_names_have_a_fallback(self) -> None:
        for name in ["", "  ", "../\\:*?"]:
            self.assertEqual("task", sanitize_filename_stem(name))


if __name__ == "__main__":
    unittest.main()
