import json
from confluent_kafka import Consumer
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.work_celery import send_massage
from app.DB.models import Users
from app.DB.session import engine

consumer = Consumer({
    "bootstrap.servers": "localhost:9092",
    "group.id": "inventory-service",
    "auto.offset.reset": "earliest"
})

consumer.subscribe(["inventory_answer"])


def run_consumer():
    while True:
        message = consumer.poll(1)

        if message and not message.error():
            event = json.loads(message.value())
            with Session(engine) as session:
                stmt = select(Users).where(Users.id == event["user_id"])
                user = session.scalar(stmt)
                email = user.email
                if event["available"]==False:
                    send_massage.apply_async(countdown=5, args=(user.email, event["order_id"], "не в наличии."))
                if event["available"]==True:
                    send_massage.apply_async(countdown=5, args=(user.email, event["order_id"], "приехал!"))
            print("Отправляем ответ пользователю:", event["available"])


if __name__ == "__main__":
    run_consumer()
