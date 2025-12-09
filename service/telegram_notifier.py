import logging
from typing import Optional
import httpx
from config import settings
from database.models import CommonAction, QuestionAnswer

logger = logging.getLogger(__name__)

token = settings.TELEGRAM_BOT_TOKEN
chat_id = settings.TELEGRAM_COMMON_ACTIONS_CHAT_ID

topic_common_questions = settings.TELEGRAM_COMMON_ACTIONS_TOPIC_ID
topic_faq = settings.TELEGRAM_FAQ_TOPIC_ID

async def _send_telegram_message(text: str, parse_mode: str = "HTML", topic_id: int | None = None) -> None:
    """
        Базовая отправка сообщения в Telegram.
        Ничего не возвращает и не роняет приложение при ошибке.
    """

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
    if topic_id:
        payload["message_thread_id"] = topic_id

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
        Формирует сообщение о новой общей акции и отправляет его в Telegram.
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

    await _send_telegram_message(text, topic_id=topic_common_questions)

async def notify_qa_question_created(qa: QuestionAnswer) -> None:
    """
        Формирует сообщение о новом вопросе в FAQ и отправляет его в Telegram.
    """
    action = qa.action
    who = qa.who_sent or "не указано"

    lines: list[str] = [
        "❓ <b>Новый вопрос в FAQ по акции</b>",
        "",
        f"Акция: <b>{action.name}</b>",
        f"Название акции в BackOffice: {action.name_bo}",
        "",
        f"Вопрос:",
        f"{qa.question}",
        "",
        f"Отправитель: {who}",
    ]

    text = "\n".join(lines)
    await _send_telegram_message(text, topic_id=topic_faq)