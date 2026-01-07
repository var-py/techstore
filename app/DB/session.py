from sqlalchemy import create_engine

from app.DB.models import Base
from dotenv import dotenv_values
config=dotenv_values(".env")
engine = create_engine(config["POSTGRESS_URL"], echo=True)
Base.metadata.create_all(bind=engine)
print(engine)