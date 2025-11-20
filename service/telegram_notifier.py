import logging
from typing import Optional
import httpx
from config import settings
from database.models import CommonAction

logger = logging.getLogger(__name__)

async def _send_telegram_message(text: str, parse_mode: str = "HTML") -> None:
    """
        Базовая отправка сообщения в Telegram.
        Ничего не возвращает и не роняет приложение при ошибке.
    """
    token = settings.TELEGRAM_BOT_TOKEN
    chat_id = settings.TELEGRAM_COMMON_ACTIONS_CHAT_ID

    if not token or not chat_id:
        logger.warning("Telegram is not configured, skip sending message")
        return

    url = f"https://api.telegram.org/bot{token}/sendMessage"

    payload: dict = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    }

    # если надо писать в конкретный топик внутри группы
    if settings.TELEGRAM_COMMON_ACTIONS_TOPIC_ID is not None:
        payload["message_thread_id"] = settings.TELEGRAM_COMMON_ACTIONS_TOPIC_ID

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Failed to send Telegram message: %s; response body: %s",
            exc,
            exc.response.text,
        )
    except httpx.HTTPError as exc:
        logger.error("Failed to send Telegram message: %s", exc)

def _bool_to_emoji(value: bool) -> str:
    return "✅" if value else "❌"

async def notify_common_action_created(action: CommonAction) -> None:
    """
        Формирует красивое сообщение о новой общей акции и отправляет его в Telegram.
    """
    from datetime import datetime

    def fmt_dt(dt: Optional[datetime]) -> str:
        if not dt:
            return "не задано"
        return dt.strftime("%d.%m.%Y %H:%M")

    lines: list[str] = [
        "🆕 <b>Новая общая акция</b>",
        f"<b>{action.name}</b>",
        f"Название акции в BackOffice: {action.name_bo}",
        "",
        f"Период: {fmt_dt(action.start_time)} — {fmt_dt(action.end_time)}",
        f"VIP-акция? {_bool_to_emoji(action.is_vip)}",
    ]

    if getattr(action, "state", None) is not None:
        # если ActionState — enum, можно взять .value или .name
        state_value = getattr(action.state, "value", str(action.state))
        lines.append(f"Статус: <b>{state_value}</b>")

    if action.short_rules:
        lines.extend([
            "",
            "<b>Краткие правила:</b>",
            action.short_rules,
        ])

    if action.link:
        lines.extend([
            "",
            f"🔗 <a href=\"{action.link}\">Ссылка на акцию</a>",
        ])

    text = "\n".join(lines)

    await _send_telegram_message(text)