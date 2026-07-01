import httpx

from app.core.encryption import decrypt_secret


class TelegramSendError(Exception):
    pass


def send_message(encrypted_bot_token: str, chat_id: str, text: str) -> None:
    token = decrypt_secret(encrypted_bot_token)
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    resp = httpx.post(
        url,
        json={"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True},
        timeout=10,
    )
    if resp.status_code != 200:
        raise TelegramSendError(f"Telegram API error {resp.status_code}: {resp.text}")
