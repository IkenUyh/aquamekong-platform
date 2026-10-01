from app.db import _with_driver


def test_plain_postgres_url_gets_psycopg2_driver():
    assert _with_driver("postgresql://u:p@h:5432/db") == "postgresql+psycopg2://u:p@h:5432/db"


def test_explicit_driver_is_kept():
    assert _with_driver("postgresql+psycopg://u:p@h/db") == "postgresql+psycopg://u:p@h/db"
