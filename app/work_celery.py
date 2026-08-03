from celery import Celery

from app.main import app
from app.utils.sendmail import send_order


def make_celery(app):
    celery = Celery(
        app.import_name,
        broker=app.config["CELERY_BROKER_URL"],
        backend=app.config["CELERY_RESULT_BACKEND"]
    )

    celery.conf.update(app.config)

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask
    return celery


celery_app = make_celery(app)


@celery_app.task(name="test_task")
def test_task(text):
    print("Celery работает")
    print(text)
    return "OK"
@celery_app.task(name="send_massage")
def send_massage(email,name_product,status):
    send_order(email,name_product,status="success")