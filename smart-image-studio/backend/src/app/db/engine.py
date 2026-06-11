from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker


def make_session_factory(database_url: str) -> sessionmaker[Session]:
    engine = create_engine(database_url, pool_pre_ping=True)
    return sessionmaker(engine)


def _run_alembic_upgrade(url: str | None = None) -> None:
    from alembic.config import Config

    from alembic import command
    from app.core.config import get_settings

    alembic_ini = Path(__file__).resolve().parents[3] / "alembic.ini"
    cfg = Config(str(alembic_ini))
    cfg.set_main_option("sqlalchemy.url", url if url is not None else get_settings().database_url)
    command.upgrade(cfg, "head")
