import json
from confluent_kafka import Consumer

from .producer import send_available_inventory

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
            event["available"]=True
            send_available_inventory(event)

            print("Отправляем письмо пользователю:", event["user_id"])
