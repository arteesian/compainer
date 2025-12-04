from __future__ import annotations

from typing import List, Sequence

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database.models import Account, DocumentEntry, PersonalPromo


class ActionsFlowRepository:
    """
    Репозиторий для цепочки:
    accounts -> document_entries -> personal_promos.

    Используется, чтобы по clientId (account_number) найти
    все персональные акции, которые «висят» на его сегментах.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    # --- Шаг 1: clientId -> document_id (segmentId) ---

    async def get_document_ids_by_client(self, client_id: int) -> List[int]:
        """
        Найти все document_id для заданного client_id.

        client_id хранится в accounts.account_number.
        """

        stmt = (
            select(Account.document_id)
            .where(Account.account_number == client_id)
            .distinct()
        )
        result = await self.session.execute(stmt)
        document_ids: List[int] = [
            doc_id for doc_id in result.scalars().all() if doc_id is not None
        ]
        return document_ids

    # --- Шаг 2: document_id -> action_id (DocumentEntry.name) ---

    async def get_action_ids_by_document_ids(
        self,
        document_ids: Sequence[int],
    ) -> List[int]:
        """
        По списку document_id получить список action_id.

        actionId хранится в document_entries.name (varchar),
        а в personal_promos.action_id — int4,
        поэтому здесь приводим name к int в Python.
        """

        if not document_ids:
            return []

        stmt = (
            select(DocumentEntry.name)
            .where(DocumentEntry.id.in_(document_ids))
            .distinct()
        )
        result = await self.session.execute(stmt)
        raw_names: List[str] = list(result.scalars().all())

        action_ids: List[int] = []
        for value in raw_names:
            try:
                action_ids.append(int(value))
            except (TypeError, ValueError):
                # если вдруг там не число — просто пропускаем
                continue

        return action_ids

    # --- Шаг 3: action_id -> personal_promos ---

    async def get_personal_promos_by_action_ids(
        self,
        action_ids: Sequence[int],
    ) -> List[PersonalPromo]:
        """
        Вернуть ORM-объекты PersonalPromo по списку action_id.
        """

        if not action_ids:
            return []

        stmt = (
            select(PersonalPromo)
            .where(PersonalPromo.action_id.in_(action_ids))
        )
        result = await self.session.execute(stmt)
        promos: List[PersonalPromo] = list(result.scalars().all())
        return promos

    # --- Удобный фасад для сервиса персональных акций ---

    async def get_personal_promos_by_client(
        self,
        client_id: int,
    ) -> List[PersonalPromo]:
        """
        Полный путь:

        1) В таблице accounts находим все совпадения по clientId (account_number),
           из совпавших строк берём segmentId (document_id) -> список document_ids.
        2) В document_entries ищем все совпадения по этим document_id,
           из совпавших строк берём actionId (name) -> список action_ids.
        3) В personal_promos по action_id находим все записи по акциям.

        Возвращаем список ORM-объектов PersonalPromo.
        """

        document_ids = await self.get_document_ids_by_client(client_id)
        if not document_ids:
            return []

        action_ids = await self.get_action_ids_by_document_ids(document_ids)
        if not action_ids:
            return []

        promos = await self.get_personal_promos_by_action_ids(action_ids)
        return promos
