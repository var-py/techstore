from flask import Flask

from .consumer import run_consumer

app = Flask(__name__)
def main():
    run_consumer()
if __name__ == "__main__":
    main()
