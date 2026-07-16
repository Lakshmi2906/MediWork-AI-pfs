from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

client = MongoClient(
    os.getenv("MONGO_URI"),
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000,
    socketTimeoutMS=5000,
)

db = client["healthcare_db"]

try:
    client.admin.command("ping")
    print("MongoDB connected.")
except Exception as e:
    print(f"MongoDB connection failed: {e}")
