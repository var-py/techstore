from celery import Celery


from app.utils.sendmail import send_order

celery_app = Celery(__name__)

def make_celery(app):
    celery_app.conf.update(
        app.import_name,
        broker=app.config["CELERY_BROKER_URL"],
        backend=app.config["CELERY_RESULT_BACKEND"]
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
    send_order(email,name_product,status="success")