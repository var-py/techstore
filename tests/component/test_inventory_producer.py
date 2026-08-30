import json

from inventory_service.app import producer as inventory_producer
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

def test_inventory_answer_is_sent(monkeypatch):
    producer = FakeProducer()
    monkeypatch.setattr(inventory_producer, "producer", producer)
    event = {
        "product_id": 10,
        "user_id": 20,
        "available": True,
    }
    inventory_producer.send_available_inventory(event)
    assert producer.topic == 'inventory_answer'
    assert json.loads(producer.value) == event
    assert producer.flushed == True