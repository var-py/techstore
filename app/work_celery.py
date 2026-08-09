import os

from celery import Celery
from dotenv import dotenv_values


from app.utils.sendmail import send_order

config = dotenv_values(".env")
celery_app = Celery(
    __name__,
    broker=os.getenv("CELERY_BROKER_URL") or config.get("CELERY_BROKER_URL"),
    backend=os.getenv("CELERY_RESULT_BACKEND") or config.get("CELERY_RESULT_BACKEND"),
)

def make_celery(app):
    celery_app.conf.update(
        broker_url=app.config["CELERY_BROKER_URL"],
        result_backend=app.config["CELERY_RESULT_BACKEND"],
    )

    celery_app.conf.update(app.config)

    class ContextTask(celery_app.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery_app.Task = ContextTask



@celery_app.task(name="test_task")
def test_task(text):
    print("Celery работает")
    print(text)
    return "OK"
@celery_app.task(name="send_massage")
def send_massage(email,name_product,status):
    print('celeryy')
    send_order(email, name_product, status=status)
