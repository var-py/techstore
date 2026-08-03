import json
import os
from confluent_kafka import Producer

producer = Producer({
    "bootstrap.servers": os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
})

def send_ask_inventory(event):
    producer.produce("inventory", value=json.dumps(event))
    producer.flush()

    print("вопрос отправлен")
