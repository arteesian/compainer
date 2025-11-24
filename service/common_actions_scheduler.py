import asyncio
import logging
from datetime import datetime, time, timedelta

from sqlalchemy import update

from database.db_setup import AsyncSessionLocal
from database.models import CommonAction, ActionState

logger = logging.getLogger(__name__)

def _seconds_until_next_run(run_time: time) -> float:
    """
    Сколько секунд осталось до следующего запуска в указанное время суток.
    Например, run_time = time(0, 5) -> ближайшие 00:05.
    """
    now = datetime.now()
    target = datetime.combine(now.date(), run_time)
    if target <= now:
        target += timedelta(days=1)
    return (target - now).total_seconds()

async def _run_once() -> int:
    """
    Один проход задачи:
    все ACTIVE-акции, у которых end_time уже в прошлом,
    переводим в FINISHED.
    """
    async with AsyncSessionLocal() as session:
        now = datetime.now()

        stmt = (
            update(CommonAction)
            .where(
                CommonAction.state == ActionState.ACTIVE,
                CommonAction.end_time.is_not(None),
                CommonAction.end_time < now,
            )
            .values(state=ActionState.FINISHED)
        )

        result = await session.execute(stmt)
        await session.commit()

        # rowcount может быть None в разных диалектах, подстрахуемся
        return result.rowcount or 0

async def start_common_actions_scheduler(
    # устанавливаем время обновления 03:05 МСК (UTC+3)
    run_time: time = time(hour=0, minute=5),
) -> None:
    logger.info("loop started, run_time=%s", run_time)

    while True:
        delay = _seconds_until_next_run(run_time)
        next_run = datetime.now() + timedelta(seconds=delay)
        logger.info(
            "next run at %s (sleep %.0f seconds)",
            next_run,
            delay,
        )

        await asyncio.sleep(delay)

        try:
            updated = await _run_once()
            logger.info(
                "finished %d expired common actions",
                updated,
            )
        except Exception:
            logger.exception(
                "unexpected error while updating actions"
            )
