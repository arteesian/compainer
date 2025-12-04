from config import settings
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import create_engine
from database.models import Base

# sync_engine = create_engine(
#     url=settings.DATABASE_URL_psycopg
# )

engine = create_async_engine(
    url=settings.DATABASE_URL_asyncpg,
    echo=False,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=30,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

# === Вторая БД: actions_flow (accounts, document_entries, personal_promos) ===
actions_flow_engine = create_async_engine(
    url=settings.ACTIONSFLOW_DATABASE_URL_asyncpg,
    echo=False,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=30,
)

ActionsFlowSessionLocal = async_sessionmaker(
    bind=actions_flow_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

test_engine = create_async_engine(settings.TEST_BASE_URL, echo=False)
AsyncTestingSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)

# Base.metadata.create_all(sync_engine)
