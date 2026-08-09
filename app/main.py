
from pathlib import Path

from flask import Flask

from app.DB.session import engine, config
from app.routes import routes_main
from app.socket import socketio
from app.work_celery import make_celery

app = Flask(__name__)

app.config['JSON_AS_ASCII'] = False
app.json.ensure_ascii = False
app.config['SECRET_KEY'] =config['SESSION_A']
app.config["CELERY_BROKER_URL"] = config["CELERY_BROKER_URL"]
app.config["CELERY_RESULT_BACKEND"] = config["CELERY_RESULT_BACKEND"]

socketio.init_app(app)
make_celery(app)

app.register_blueprint(routes_main)
certif="/etc/letsencrypt/live/varpy.ru/fullchain.pem"
keyser= "/etc/letsencrypt/live/varpy.ru/privkey.pem"


if __name__ == "__main__":
    if Path(certif).exists() and Path(keyser).exists():
        socketio.run(
            app,
            host="0.0.0.0",
            port=443,
            debug=False,
            allow_unsafe_werkzeug=True,
            ssl_context=(certif, keyser),
        )
    else:
        socketio.run(
            app,
            host="0.0.0.0",
            port=80,
            debug=False,
            use_reloader=False,
            allow_unsafe_werkzeug=True,
        )
