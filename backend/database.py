from motor.motor_asyncio import AsyncIOMotorClient

# Cloud MongoDB Atlas URI
MONGO_URL = "mongodb+srv://samarthkapase:Samarth1234@cluster0.gg6b072.mongodb.net/?retryWrites=true&w=majority"

client = AsyncIOMotorClient(MONGO_URL)
db = client.insta_clone

users_collection = db.get_collection("users")
posts_collection = db.get_collection("posts")
stories_collection = db.get_collection("stories")
messages_collection = db.get_collection("messages")
notifications_collection = db.get_collection("notifications")
reports_collection = db.get_collection("reports")
calls_collection = db.get_collection("calls")