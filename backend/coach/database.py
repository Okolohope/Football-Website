from collections.abc import Iterator
from contextlib import contextmanager

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import Settings


def create_pool(settings: Settings) -> ConnectionPool:
    pool = ConnectionPool(
        conninfo=settings.database_url.get_secret_value(),
        min_size=1,
        max_size=5,
        timeout=5,
        kwargs={"row_factory": dict_row},
        open=False,
    )
    pool.open(wait=False)
    return pool


@contextmanager
def transaction(pool: ConnectionPool) -> Iterator:
    with pool.connection() as connection:
        yield connection
