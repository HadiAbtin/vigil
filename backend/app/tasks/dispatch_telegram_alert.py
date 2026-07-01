from app.celery_app import celery_app
from app.core.constants import AlertEventStatus
from app.db.session import SessionLocal
from app.models import AlertEvent
from app.services import telegram

_LEVEL_EMOJI = {"info": "ℹ️", "warning": "⚠️", "high": "🔴"}


@celery_app.task(
    name="app.tasks.dispatch_telegram_alert.dispatch_telegram_alert",
    autoretry_for=(telegram.TelegramSendError,),
    retry_backoff=5,
    retry_backoff_max=120,
    retry_jitter=True,
    max_retries=5,
)
def dispatch_telegram_alert(event_id: int) -> None:
    db = SessionLocal()
    try:
        event = db.get(AlertEvent, event_id)
        if event is None:
            return

        category = event.alert_rule.category
        bots = [b for b in category.telegram_bots if b.enabled]
        if not bots:
            return

        if event.status == AlertEventStatus.RESOLVED:
            prefix = "✅ RESOLVED"
        else:
            prefix = f"{_LEVEL_EMOJI.get(event.level, '🔔')} {event.level.upper()}"
        text = f"{prefix}\n{event.message}"

        for bot in bots:
            telegram.send_message(bot.encrypted_bot_token, bot.chat_id, text)
    finally:
        db.close()
