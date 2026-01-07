import smtplib

from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from random import randint
import random
from app.DB.session import engine, config
def send_code(TO):
    SMTP_HOST = "smtp.mail.ru"      # сервер
    SMTP_PORT = 587                     # порт
    SMTP_LOGIN = "zxcv6752@mail.ru"      # логин
    SMTP_PASSWORD = config["PASSWORD_MAIL"]          # пароль

    FROM = SMTP_LOGIN
    # TO = "varar666@mail.ru"

    # создаём письмо
    msg = MIMEMultipart()
    msg["Subject"] = "код авторизации"
    msg["From"] = FROM
    msg["To"] = TO
    code=randint(100000,999999)
    body = f"ваш временный код: {code}"
    msg.attach(MIMEText(body, "plain", "utf-8"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_LOGIN, SMTP_PASSWORD)
        server.send_message(msg)

    print("Письмо отправлено!")
    return code