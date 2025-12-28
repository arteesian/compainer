# database/action_logs_repo.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update
from database.models import ActionLog
from datetime import datetime
from fastapi.encoders import jsonable_encoder

class ActionLogsRepository:
    @staticmethod
    async def create(
        db: AsyncSession,
        *,
        employee_email: str,
        employee_name: str | None,
        client_id: str,
        request_type: str,
        http_status: int,
        backend_payload: dict | None = None,
        error_text: str | None = None,
    ) -> ActionLog:
        if backend_payload is not None:
            backend_payload = jsonable_encoder(backend_payload)

        row = ActionLog(
            employee_email=employee_email,
            employee_name=employee_name,
            client_id=client_id,
            request_type=request_type,
            http_status=http_status,
            backend_payload=backend_payload,
            error_text=error_text,
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return row

    @staticmethod
    async def list(
            db: AsyncSession,
            *,
            limit: int = 50,
            offset: int = 0,
            request_type: str | None = None,
            employee_email: str | None = None,
            client_id: str | None = None,
            date_from: datetime | None = None,
            date_to: datetime | None = None,
    ) -> list[ActionLog]:

        q = select(ActionLog).order_by(desc(ActionLog.created_at))
        if request_type:
            q = q.where(ActionLog.request_type == request_type)
        if employee_email:
            q = q.where(ActionLog.employee_email == employee_email)
        if client_id:
            q = q.where(ActionLog.client_id == client_id)
        if date_from:
            q = q.where(ActionLog.created_at >= date_from)
        if date_to:
            q = q.where(ActionLog.created_at <= date_to)
        q = q.limit(limit).offset(offset)
        res = await db.execute(q)
        return list(res.scalars().all())

    @staticmethod
    async def update_final_text(
            db: AsyncSession,
            *,
            log_id: int,
            final_text: str,
            employee_email: str | None = None,
    ) -> bool:
        """
        Обновляет final_text.
        Если employee_email передан — обновляем только запись этого сотрудника (защита).
        Возвращает True если обновили, False если не нашли/нет прав.
        """
        stmt = update(ActionLog).where(ActionLog.id == log_id)

        if employee_email is not None:
            stmt = stmt.where(ActionLog.employee_email == employee_email)

        stmt = stmt.values(final_text=final_text)

        res = await db.execute(stmt)
        await db.commit()

        # rowcount: сколько строк реально обновилось
        return (res.rowcount or 0) > 0
