import json

from app.kafka import producer as kafka_producer
class FakeProducer:
    def __init__(self):
        self.topic = None
        self.value = None
        self.flushed = False

    def produce(self, topic, value):
        self.topic = topic
        self.value = value

    def flush(self):
        self.flushed = True


def test_inventory_request_is_sent(monkeypatch):
    fake_producer = FakeProducer()

    monkeypatch.setattr(kafka_producer, "producer", fake_producer)

    event = {
        "user_id": 2,
        "product_id": 1
    }
    kafka_producer.send_ask_inventory(event)

    assert fake_producer.topic == 'inventory'
    assert json.loads(fake_producer.value) == event
    assert fake_producer.flushed is True