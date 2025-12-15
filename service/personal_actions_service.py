from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Set
import logging
from zoneinfo import ZoneInfo
from sqlalchemy.ext.asyncio import AsyncSession

from database.actions_flow_repo import ActionsFlowRepository
from database.models import PersonalPromo
from service.api_client_service import SecureAPIClient, logger
from service.backoffice_utils import has_bad_statuses, has_score_and_bh_status, is_vip, has_ident_needed
from service.exceptions import ExternalAPIError, UserNotFoundError

logger = logging.getLogger(__name__)

# ====== доменная модель и статусы персональных акций ======

class PersonalActionStatus(str, Enum):
    AVAILABLE = "available"   # есть в БД, но не активирована в БО
    ACTIVE = "active"         # активна в БО
    FINISHED = "finished"     # завершена, но не старше N дней


@dataclass
class PersonalAction:
    """
    Доменная модель персональной акции.
    Потом поверх неё можно сделать Pydantic-схему для ответа API.
    """
    action_id: int

    # отображаемые данные
    name: Optional[str] = None
    description: Optional[str] = None
    link: Optional[str] = None

    # статус и даты
    status: PersonalActionStatus = PersonalActionStatus.AVAILABLE
    start_time: Optional[datetime] = None
    finish_time: Optional[datetime] = None

    # инфа по обороту
    bet_needed: Optional[bool] = None
    turnover_remaining: Optional[float] = None


@dataclass
class PersonalActionsPage:
    items: List[PersonalAction]
    total: int
    offset: int
    limit: int


# ======================== основной сервис ========================

class PersonalActionsService:
    """
    Сервис персональных акций:

    1) Проверяет клиента в BO и валидирует его статусы (has_bad_statuses).
    2) Берёт активные и завершённые персональные акции из BackOffice.
    3) Берёт доступные, но ещё не активированные акции из БД (actions_flow).
    4) Склеивает, сортирует и делает пагинацию.
    """

    ALLOWED_ACTION_CLASSES = {
        "Fon.Loyalty.Promocode2.Action",
        "Fon.Loyalty.Action.Reg.ByPhone",
        "Fon.Loyalty.Action.Promocode",
        "Fon.Loyalty.EuroBonus.Action",
        "Fon.Loyalty.Rewarding.Action",
    }

    def __init__(
        self,
        session: AsyncSession,
        api_client: SecureAPIClient,
        days_after_finish: int = 7,
    ) -> None:
        self.session = session
        self.repo = ActionsFlowRepository(session)
        self.api_client = api_client
        self.days_after_finish = days_after_finish

    async def get_personal_actions(
        self,
        client_id: int,
        offset: int = 0,
        limit: int = 10,
        allow_vip_clients: bool = False,
    ) -> PersonalActionsPage:
        """
        Главный публичный метод. Его потом будет дёргать роутер.
        """

        # Проверяем, что клиент существует и не имеет негативных статусов
        await self._ensure_client_allowed(client_id, allow_vip_clients=allow_vip_clients)

        now = datetime.now(ZoneInfo("Europe/Moscow"))
        finished_cutoff = now - timedelta(days=self.days_after_finish)

        # Берём все акции из BackOffice
        all_actions_raw = await self._get_clients_actions(client_id)

        # Фильтруем активные акции:
        active_raw: List[Dict[str, Any]] = [
            item
            for item in all_actions_raw
            if item.get("status") == "participating" and not item.get("deleted", False)
               and item.get("actionClass") in self.ALLOWED_ACTION_CLASSES
        ]

        # Фильтруем завершённые акции (ещё без отсечения по дате):
        finished_raw_candidates: List[Dict[str, Any]] = [
            item
            for item in all_actions_raw
            if item.get("status") == "participated"
               and item.get("actionClass") in self.ALLOWED_ACTION_CLASSES
        ]

        # Маппим активные и завершённые в доменные модели
        active_actions: List[PersonalAction] = [
            self._map_bo_action(raw, PersonalActionStatus.ACTIVE)
            for raw in active_raw
        ]

        finished_actions_all: List[PersonalAction] = [
            self._map_bo_action(raw, PersonalActionStatus.FINISHED)
            for raw in finished_raw_candidates
        ]

        # Оставляем только завершённые не старше 7 дней
        finished_actions: List[PersonalAction] = [
            pa
            for pa in finished_actions_all
            if pa.finish_time and pa.finish_time >= finished_cutoff
        ]

        # Собираем action_id, которые уже есть в BO (активные/завершённые)
        used_action_ids: Set[int] = {
            a.action_id for a in (active_actions + finished_actions)
        }

        # Берём персональные промо из БД через actions_flow_repo
        db_promos: List[PersonalPromo] = await self.repo.get_personal_promos_by_client(client_id)

        # Оставляем только те, которые ещё не активированы в BO
        available_promos: List[PersonalPromo] = [
            promo for promo in db_promos if promo.action_id not in used_action_ids
        ]

        # Маппим промо в доменные модели "доступных" акций (client_segments)
        available_actions: List[PersonalAction] = [
            self._map_promo_to_available_action(promo) for promo in available_promos
        ]

        # Дотягиваем инфу по обороту для активных акций
        await self._enrich_with_turnover(client_id, active_actions + finished_actions)

        # Склеиваем и сортируем: AVAILABLE -> ACTIVE -> FINISHED
        all_actions: List[PersonalAction] = (
            available_actions + active_actions + finished_actions
        )

        # Дотягиваем описание/ссылку из всех промо-таблиц (personal + welcome)
        await self._enrich_actions_from_db(all_actions)

        status_order = {
            PersonalActionStatus.AVAILABLE: 1,
            PersonalActionStatus.ACTIVE: 2,
            PersonalActionStatus.FINISHED: 3,
        }

        def sort_key(a: PersonalAction):
            # внутри статуса сортируем, например, по дате окончания
            finish = a.finish_time or datetime.max
            return status_order[a.status], finish

        all_actions.sort(key=sort_key)

        # Пагинация
        total = len(all_actions)
        paged_items = all_actions[offset : offset + limit]

        return PersonalActionsPage(
            items=paged_items,
            total=total,
            offset=offset,
            limit=limit,
        )

    # ======================= внутренние хелперы =======================

    async def _ensure_client_allowed(
            self,
            client_id: int,
            allow_vip_clients: bool,
    ) -> None:
        """
        1) Проверяем, что client_id валиден по формату (ровно 8 цифр).
        2) Проверяем, что клиент существует в БО (get_client_information).
        3) Если счёт отсутствует — поднимаем UserNotFoundError.
        4) Если клиент VIP, а роль пользователя не позволяет — 400.
        5) Если у клиента негативные статусы — поднимаем ExternalAPIError 400.
        """

        client_id_str = str(client_id)
        if not (client_id_str.isdigit() and len(client_id_str) == 8):
            # ошибка ввода пользователя
            raise ExternalAPIError(
                message=f"Некорректный номер счёта: '{client_id_str}'. "
                        f"Номер должен состоять ровно из 8 цифр.",
                status_code=400,
            )

        try:
            client_info = await self.api_client.get_client_information(
                client_id=str(client_id)
            )
        except ExternalAPIError as exc:
            # если счёт отсутствует в БО
            if (
                exc.status_code == 400
                and "отсутствует в БО" in (exc.message or "")
            ):
                # Хотим явно сказать роутеру «клиент не найден»
                raise UserNotFoundError(f"Client {client_id} not found in BackOffice") from exc

            # Любая другая ошибка БО — прокидываем как есть
            raise

        if is_vip(client_info) and not allow_vip_clients:
            raise ExternalAPIError(
                message="Клиент относится к VIP-сегменту. Просмотр его персональных акций "
                        "недоступен для вашей роли.",
                status_code=400,
            )

        if has_ident_needed(client_info):
            # при П1 отправляем на 2 линию
            raise ExternalAPIError(
                message="Требуется идентификация СБ, переведите клиента на 2-ю линию",
                status_code=400,
            )
        elif has_bad_statuses(client_info):
            # при негативных статусах клиенту недоступны бонусы/акции
            raise ExternalAPIError(
                message="Клиент имеет ограничения, бонусы недоступны",
                status_code=400,
            )
        elif has_score_and_bh_status(client_info):
            # предупреждаем о СКОР БХ
            raise ExternalAPIError(
                message="У клиента СКОР + БХ",
                status_code=400,
            )

    async def _get_clients_actions(self, client_id: int) -> List[Dict[str, Any]]:
        try:
            raw = await self.api_client.get_client_actions(
                client_id=str(client_id)
            )
        except ExternalAPIError:
            # прокидываем наверх — роутер потом сам решит, что вернуть
            raise

        actions = raw.get("response", {}).get("participationHistoryList", [])

        # на всякий случай убеждаемся, что это действительно список
        if not isinstance(actions, list):
            return []

        # здесь actions: List[Dict[str, Any]]
        return actions

    def _map_bo_action(
            self,
            raw: Dict[str, Any],
            status: PersonalActionStatus,
    ) -> PersonalAction:
        """
        Маппинг одной акции из participationHistoryList в PersonalAction.
        """
        try:
            action_id = int(raw["actionId"])
        except (KeyError, TypeError, ValueError):
            # если actionId нет или он кривой — можно пропустить или кинуть исключение
            # для простоты вернём "пустую" акцию с action_id = 0
            action_id = 0

        start_time = self._from_unix_ms(raw.get("startTime"))
        finish_time = self._from_unix_ms(raw.get("finishTime"))

        return PersonalAction(
            action_id=action_id,
            name=raw.get("actionPromoId"),
            description=raw.get("caption"),
            link=None,  # здесь в ответе BO ссылки нет; можно будет дотянуть другим способом
            status=status,
            start_time=start_time,
            finish_time=finish_time,
        )

    def _map_promo_to_available_action(self, promo: PersonalPromo) -> PersonalAction:
        """
        Маппим запись из personal_promos (БД) в доступную, но ещё не активированную акцию.
        Здесь у нас уже есть:
        - promo.action_id
        - promo.link
        - promo.message
        - promo.start_time / promo.finish_time (int8 timestamp)
        """

        start_time = self._from_unix_ms(promo.start_time)
        finish_time = self._from_unix_ms(promo.finish_time)

        return PersonalAction(
            action_id=promo.action_id,
            name=promo.promo_id,
            description=None,
            link=None,
            status=PersonalActionStatus.AVAILABLE,
            start_time=start_time,
            finish_time=finish_time,
        )

    async def _enrich_with_turnover(
            self,
            client_id: int,
            actions: List[PersonalAction],
    ) -> None:
        """
        Для каждой активной акции тянем прогресс по /api/loyalty/getActionClientsProgresses
        и, если betNeeded = true, выставляем turnover_remaining = remainingBetsAmount / 100.
        """
        if not actions:
            return

        for action in actions:
            try:
                raw = await self.api_client.get_action_clients_progresses(
                    client_id=str(client_id),
                    action_id=action.action_id,
                )
            except ExternalAPIError as exc:
                logger.warning(
                    f"Не удалось получить прогресс для action_id={action.action_id}, "
                    f"client_id={client_id}: {exc}"
                )
                continue

            latest_obj = self._extract_latest_progress_object(
                raw,
                action_id=action.action_id,
            )

            if not latest_obj:
                logger.info(
                    f"Для client_id={client_id}, action_id={action.action_id} прогрессов не найдено"
                )
                continue

            bet_needed = latest_obj.get("betNeeded")
            if bet_needed is None:
                action.bet_needed = None
            else:
                action.bet_needed = bool(bet_needed)

            logger.info(f"Получили данные по акции {latest_obj.get('action')} для client_id={client_id}")

            if not latest_obj.get("betNeeded"):
                continue

            if action.status != PersonalActionStatus.ACTIVE:
                continue

            remaining_raw = latest_obj.get("remainingBetsAmount")

            try:
                remaining_int = int(remaining_raw)
            except (TypeError, ValueError):
                logger.warning(
                    f"Не удалось конвертировать remainingBetsAmount={remaining_raw} в int "
                    f"для client_id={client_id}, action_id={action.action_id}"
                )
                continue

            action.turnover_remaining = remaining_int / 100.0
            logger.info(
                f"Установлен turnover_remaining={action.turnover_remaining} "
                f"для client_id={client_id}, action_id={action.action_id}"
            )

    @staticmethod
    def _from_unix_ms(value: Optional[int]) -> Optional[datetime]:
        """
        Переводим unix timestamp в миллисекундах в datetime с таймзоной UTC.
        """
        if value is None:
            return None
        try:
            return datetime.fromtimestamp(value / 1000, tz=ZoneInfo("Europe/Moscow"))
        except (OSError, OverflowError, TypeError, ValueError):
            return None

    @staticmethod
    def _normalize_promo_id(promo_id: str | None) -> str:
        if not promo_id:
            return ""

        for marker in ("_AV_", "_DV_"):
            if marker in promo_id:
                return promo_id.split(marker, 1)[0]

        return promo_id

    @staticmethod
    def _extract_latest_progress_object(
            raw: Dict[str, Any],
            action_id: int,
    ) -> Optional[Dict[str, Any]]:
        """
        Из ответа getActionClientsProgresses достаём object
        последнего по времени прогресса.
        """
        response = raw.get("response") or {}
        progresses_list = response.get("progressesList") or []

        if not isinstance(progresses_list, list):
            logger.warning("progressesList не является списком: %r", progresses_list)
            return None

        logger.debug(
            "progressesList len=%s для action_id=%s",
            len(progresses_list),
            action_id,
        )

        objects: List[Dict[str, Any]] = []

        for row in progresses_list:
            # row ожидается списком, внутри один или несколько dict'ов
            if not isinstance(row, list):
                logger.debug("row в progressesList не список: %r", row)
                continue

            for entry in row:
                if not isinstance(entry, dict):
                    logger.debug("entry в row не dict: %r", entry)
                    continue

                obj = entry.get("object") or {}
                if not isinstance(obj, dict):
                    logger.debug("entry.object не dict: %r", obj)
                    continue

                # ⚠️ больше НЕ фильтруем по obj["action"]
                objects.append(obj)

        if not objects:
            logger.info(
                "Не нашли ни одного прогресса в progressesList для action_id=%s",
                action_id,
            )
            return None

        def get_ct(o: Dict[str, Any]) -> int:
            try:
                return int(o.get("createTime") or 0)
            except (TypeError, ValueError):
                return 0

        latest = max(objects, key=get_ct)
        logger.debug(
            "Выбрали latest progress для action_id=%s: createTime=%s, betNeeded=%s, remainingBetsAmount=%s",
            action_id,
            latest.get("createTime"),
            latest.get("betNeeded"),
            latest.get("remainingBetsAmount"),
        )
        return latest


    def _enrich_actions_from_promos(
            self,
            actions: List[PersonalAction],
            promos_by_action_id: Dict[int, PersonalPromo],
    ) -> None:
        """
        Для любых персональных акций (available / active / finished)
        подмешиваем описание и ссылку из таблицы personal_promos,
        если там есть запись с таким action_id.

        Логика:
          - description <- promo.message (если оно есть)
          - link        <- promo.link    (если оно есть)
        """
        if not actions:
            return

        for action in actions:
            promo = promos_by_action_id.get(action.action_id)
            if not promo:
                continue

            msg = getattr(promo, "message", None)
            if msg:
                action.description = msg

            link = getattr(promo, "link", None)
            if link:
                action.link = link

    async def _enrich_actions_from_db(
            self,
            actions: List[PersonalAction],
    ) -> None:
        """
        Для любых персональных акций (available / active / finished)
        подтягиваем описание/ссылку из БД:

        - personal_promos (по action_id + promo_id)
        - welcome_promos  (по “семейству” promo_id, нормализованному)
        - welcome_step_2...5 (по action_id, только message)

        Идея: для welcome-ШАГОВ берём message из step-таблицы,
        а link — из базового welcome_promos по “семейству” promo_id.
        """
        if not actions:
            return

        action_ids = {a.action_id for a in actions if a.action_id}
        promo_ids_raw = {a.name for a in actions if a.name}

        if not action_ids and not promo_ids_raw:
            return

        # Нормализованные promo_id (без _AV_2/_AV_3/... и _DV_)
        normalized_promo_ids = {
            self._normalize_promo_id(pid)
            for pid in promo_ids_raw
            if pid
        }

        # 1) обычные персональные промо
        personal_promos = await self.repo.get_personal_promos_by_action_ids(
            list(action_ids)
        )

        # 2) welcome первый шаг (базовые велкомы)
        welcome_promos = await self.repo.get_welcome_promos_by_promo_ids(
            list(normalized_promo_ids)
        )

        # 3) welcome шаги 2–5
        welcome_steps = await self.repo.get_welcome_steps_by_action_ids(
            list(action_ids)
        )

        # --- собираем данные в два словаря ---
        # по action_id: для персональных + welcome-ШАГОВ (сообщения + возможные ссылки)
        data_by_action_id: dict[int, dict[str, Optional[str]]] = {}

        # по нормализованному promo_id: для базовых welcome (ссылка + общий текст)
        data_by_norm_pid: dict[str, dict[str, Optional[str]]] = {}

        def put_action(aid: Optional[int], msg: Optional[str], link: Optional[str]):
            if aid is None:
                return
            current = data_by_action_id.setdefault(aid, {"message": None, "link": None})
            if msg:
                current["message"] = msg
            if link:
                current["link"] = link

        def put_norm_pid(promo_id: Optional[str], msg: Optional[str], link: Optional[str]):
            if not promo_id:
                return
            norm = self._normalize_promo_id(promo_id)
            if not norm:
                return
            current = data_by_norm_pid.setdefault(norm, {"message": None, "link": None})
            if msg:
                current["message"] = msg
            if link:
                current["link"] = link

        # personal_promos: обычно non-welcome; но пусть тоже попадут в оба словаря
        for p in personal_promos:
            put_action(p.action_id, getattr(p, "message", None), getattr(p, "link", None))
            put_norm_pid(getattr(p, "promo_id", None), getattr(p, "message", None), getattr(p, "link", None))

        # базовые welcome: именно тут обычно лежит ссылка
        for w in welcome_promos:
            put_action(w.action_id, getattr(w, "message", None), getattr(w, "link", None))
            put_norm_pid(w.promo_id, getattr(w, "message", None), getattr(w, "link", None))

        # welcome steps 2–5: только message, link нет
        for ws in welcome_steps:
            put_action(ws.action_id, getattr(ws, "message", None), None)
            put_norm_pid(ws.promo_id, getattr(ws, "message", None), None)

        # --- применяем к акциям ---
        for action in actions:
            aid = action.action_id
            promo_name = action.name
            norm_pid = self._normalize_promo_id(promo_name) if promo_name else None

            msg: Optional[str] = None
            link: Optional[str] = None

            by_aid = data_by_action_id.get(aid)
            if by_aid:
                msg = by_aid.get("message") or msg
                link = by_aid.get("link") or link

            if norm_pid:
                by_pid = data_by_norm_pid.get(norm_pid)
                if by_pid:
                    # message: не перетираем уже заполненный step-текст,
                    # но если его нет — берём из базового welcome
                    msg = msg or by_pid.get("message")
                    # link: если ещё нет — забираем из welcome_promos
                    link = link or by_pid.get("link")

            if msg:
                action.description = msg
            if link:
                action.link = link


