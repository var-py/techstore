import json
from confluent_kafka import Producer

producer = Producer({"bootstrap.servers": "localhost:9092"})

def send_available_inventory(event):
    producer.produce("inventory_answer", value=json.dumps(event))
    producer.flush()

    print("ответ отправлен")