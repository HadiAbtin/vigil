from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_password_already_changed
from app.core.encryption import encrypt_secret
from app.models import AlertCategory, TelegramBot
from app.schemas.telegram_bot import TelegramBotCreate, TelegramBotOut, TelegramBotUpdate

router = APIRouter(
    prefix="/telegram-bots", tags=["telegram-bots"], dependencies=[Depends(require_password_already_changed)]
)


def _resolve_categories(db: Session, category_ids: list[int]) -> list[AlertCategory]:
    categories = db.query(AlertCategory).filter(AlertCategory.id.in_(category_ids)).all()
    if len(categories) != len(set(category_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="One or more category_ids not found")
    return categories


@router.get("", response_model=list[TelegramBotOut])
def list_telegram_bots(db: Session = Depends(get_db)) -> list[TelegramBot]:
    return db.query(TelegramBot).order_by(TelegramBot.name).all()


@router.post("", response_model=TelegramBotOut, status_code=status.HTTP_201_CREATED)
def create_telegram_bot(payload: TelegramBotCreate, db: Session = Depends(get_db)) -> TelegramBot:
    if db.query(TelegramBot).filter(TelegramBot.name == payload.name).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A bot with this name already exists")
    categories = _resolve_categories(db, payload.category_ids)
    bot = TelegramBot(
        name=payload.name,
        encrypted_bot_token=encrypt_secret(payload.bot_token),
        chat_id=payload.chat_id,
        enabled=payload.enabled,
        categories=categories,
    )
    db.add(bot)
    db.commit()
    db.refresh(bot)
    return bot


@router.patch("/{bot_id}", response_model=TelegramBotOut)
def update_telegram_bot(bot_id: int, payload: TelegramBotUpdate, db: Session = Depends(get_db)) -> TelegramBot:
    bot = db.get(TelegramBot, bot_id)
    if bot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Telegram bot not found")
    updates = payload.model_dump(exclude_unset=True, exclude={"bot_token", "category_ids"})
    for field, value in updates.items():
        setattr(bot, field, value)
    if payload.bot_token is not None:
        bot.encrypted_bot_token = encrypt_secret(payload.bot_token)
    if payload.category_ids is not None:
        bot.categories = _resolve_categories(db, payload.category_ids)
    db.commit()
    db.refresh(bot)
    return bot


@router.delete("/{bot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_telegram_bot(bot_id: int, db: Session = Depends(get_db)) -> None:
    bot = db.get(TelegramBot, bot_id)
    if bot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Telegram bot not found")
    db.delete(bot)
    db.commit()


@router.post("/{bot_id}/test", status_code=status.HTTP_204_NO_CONTENT)
def test_telegram_bot(bot_id: int, db: Session = Depends(get_db)) -> None:
    bot = db.get(TelegramBot, bot_id)
    if bot is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Telegram bot not found")

    from app.services import telegram

    try:
        telegram.send_message(bot.encrypted_bot_token, bot.chat_id, "🛡️ Vigil test alert — this bot is wired up correctly.")
    except telegram.TelegramSendError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
