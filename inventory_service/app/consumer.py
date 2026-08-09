import json
from confluent_kafka import Consumer
from sqlalchemy.orm import Session
from inventory_service.app.database import engine
from .models import Product
from .producer import send_available_inventory
from sqlalchemy import select

consumer = Consumer({
    "bootstrap.servers": "localhost:9092",
    "group.id": "email-service",
    "auto.offset.reset": "earliest"
})

consumer.subscribe(["inventory"])

def run_consumer():
    while True:
        message = consumer.poll(1)

        if message and not message.error():
            event = json.loads(message.value())
            #todo проверка бд
            with Session(engine) as session:
                stmt=select(Product).where(Product.id == event["product_id"])
                product=session.execute(stmt).scalar()
            event["available"]=product.available
            send_available_inventory(event)

            print("Отправляем письмо пользователю:", event["user_id"])
