import unittest

from src.utils.env import parse_int_setting


class EnvTest(unittest.TestCase):
    def test_parse_int_setting_accepts_plain_integer_text(self) -> None:
        self.assertEqual(12884901888, parse_int_setting("12884901888", "SETTING"))

    def test_parse_int_setting_accepts_scientific_integer_text(self) -> None:
        self.assertEqual(12884901888, parse_int_setting("1.2884901888e+10", "SETTING"))

    def test_parse_int_setting_rejects_fractional_value(self) -> None:
        with self.assertRaises(ValueError):
            parse_int_setting("1.25", "SETTING")

    def test_parse_int_setting_rejects_invalid_value(self) -> None:
        with self.assertRaises(ValueError):
            parse_int_setting("abc", "SETTING")


if __name__ == "__main__":
    unittest.main()
