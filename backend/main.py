from fastapi import FastAPI, HTTPException, status, UploadFile, File, Form, Depends, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from bson import ObjectId
import cloudinary
import cloudinary.uploader
import re
from datetime import datetime
from database import (
    users_collection, posts_collection, stories_collection,
    messages_collection, notifications_collection, reports_collection
)
from models import UserSignup, CommentCreate, ProfileUpdate, PasswordChange, PostUpdate, ReportCreate
from auth import hash_password, verify_password, create_access_token, get_current_user
from datetime import datetime, timedelta
from models import (
    UserSignup, CommentCreate, ProfileUpdate, PasswordChange,
    PostUpdate, ReportCreate, StoryReply, PollVote, HighlightCreate,
    MessageSend, MessageReaction
)
cloudinary.config(
    cloud_name="rqlhcxj0",
    api_key="968642176593367",
    api_secret="JACg4N4X7TFdjuN_aSl7MJY0SOA"
)

app = FastAPI(title="Instagram Full Production API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper to create notifications automatically
async def create_notification(recipient: str, actor: str, notif_type: str, text: str, post_id: str = ""):
    if recipient == actor:
        return
    await notifications_collection.insert_one({
        "recipient": recipient,
        "actor": actor,
        "type": notif_type,
        "text": text,
        "post_id": post_id,
        "is_read": False,
        "created_at": datetime.utcnow().isoformat()
    })

# --- MODULE 1 & 10: AUTH, PRIVACY & SECURITY ---

@app.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(user: UserSignup):
    if await users_collection.find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="Email already registered!")
    if await users_collection.find_one({"username": user.username.lower()}):
        raise HTTPException(status_code=400, detail="Username already taken!")

    new_user = {
        "username": user.username.lower(),
        "email": user.email,
        "full_name": user.full_name,
        "bio": "",
        "password": hash_password(user.password),
        "profile_pic": "",
        "is_private": False,
        "followers": [],
        "following": [],
        "follow_requests": [],
        "blocked_users": [],
        "restricted_users": [],
        "close_friends": [],
        "saved_posts": [],
        "not_interested": [],
        "login_activity": []
    }
    await users_collection.insert_one(new_user)
    return {"message": "Account created successfully!"}

@app.post("/login")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    db_user = await users_collection.find_one({"email": form_data.username})
    if not db_user or not verify_password(form_data.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password!")

    # Record Login Activity
    activity = {
        "ip": request.client.host if request.client else "Unknown",
        "device": request.headers.get("user-agent", "Unknown Browser")[:60],
        "time": datetime.utcnow().isoformat()
    }
    await users_collection.update_one(
        {"_id": db_user["_id"]},
        {"$push": {"login_activity": {"$each": [activity], "$slice": -10}}}
    )

    token = create_access_token({"sub": db_user["email"], "username": db_user["username"]})
    return {"access_token": token, "token_type": "bearer", "username": db_user["username"]}

@app.post("/auth/change-password")
async def change_password(data: PasswordChange, current_user: str = Depends(get_current_user)):
    user = await users_collection.find_one({"username": current_user})
    if not verify_password(data.old_password, user["password"]):
        raise HTTPException(status_code=400, detail="Incorrect old password!")
    await users_collection.update_one(
        {"username": current_user},
        {"$set": {"password": hash_password(data.new_password)}}
    )
    return {"message": "Password updated successfully!"}

# --- MODULE 2 & 3: POSTS (CAROUSEL, VIDEO, HASHTAGS, MENTIONS, LOCATION) ---

@app.post("/posts", status_code=status.HTTP_201_CREATED)
async def create_post(
    caption: str = Form(""),
    location: str = Form(""),
    is_reel: bool = Form(False),
    files: List[UploadFile] = File(...),
    current_user: str = Depends(get_current_user)
):
    media_items = []
    for file in files:
        # Support both Images and Videos
        res_type = "video" if file.content_type.startswith("video/") else "image"
        upload_res = cloudinary.uploader.upload(file.file, folder="insta_media", resource_type=res_type)
        media_items.append({"url": upload_res.get("secure_url"), "type": res_type})

    # Extract #hashtags and @mentions from caption
    hashtags = re.findall(r"#(\w+)", caption)
    mentions = re.findall(r"@(\w+)", caption)

    new_post = {
        "username": current_user,
        "media": media_items,  # Supports single image, carousel (multiple), or video/reel
        "caption": caption,
        "location": location,
        "hashtags": [h.lower() for h in hashtags],
        "mentions": [m.lower() for m in mentions],
        "is_reel": is_reel,
        "views": 0,
        "likes": [],
        "comments": [],
        "created_at": datetime.utcnow().isoformat()
    }
    result = await posts_collection.insert_one(new_post)

    # Notify mentioned users
    for mentioned_user in mentions:
        await create_notification(mentioned_user.lower(), current_user, "mention", f"mentioned you in a post.", str(result.inserted_id))

    return {"message": "Post shared!", "post_id": str(result.inserted_id)}

@app.get("/posts")
async def get_feed(current_user: str = Depends(get_current_user)):
    me = await users_collection.find_one({"username": current_user})
    blocked = me.get("blocked_users", [])
    not_interested = me.get("not_interested", [])

    posts = []
    cursor = posts_collection.find().sort("_id", -1)
    async for post in cursor:
        post_id_str = str(post["_id"])
        if post["username"] in blocked or post_id_str in not_interested:
            continue
        author = await users_collection.find_one({"username": post["username"]})
        # Respect Private Account privacy
        if author and author.get("is_private") and post["username"] != current_user:
            if current_user not in author.get("followers", []):
                continue

        post["_id"] = post_id_str
        post["user_pic"] = author.get("profile_pic", "") if author else ""
        posts.append(post)
    return posts

@app.put("/posts/{post_id}")
async def edit_post(post_id: str, data: PostUpdate, current_user: str = Depends(get_current_user)):
    post = await posts_collection.find_one({"_id": ObjectId(post_id)})
    if not post or post["username"] != current_user:
        raise HTTPException(status_code=403, detail="Not authorized to edit this post!")
    hashtags = [h.lower() for h in re.findall(r"#(\w+)", data.caption)]
    await posts_collection.update_one(
        {"_id": ObjectId(post_id)},
        {"$set": {"caption": data.caption, "location": data.location, "hashtags": hashtags}}
    )
    return {"message": "Post updated!"}

@app.delete("/posts/{post_id}")
async def delete_post(post_id: str, current_user: str = Depends(get_current_user)):
    post = await posts_collection.find_one({"_id": ObjectId(post_id)})
    if not post or post["username"] != current_user:
        raise HTTPException(status_code=403, detail="Not authorized to delete this post!")
    await posts_collection.delete_one({"_id": ObjectId(post_id)})
    return {"message": "Post deleted!"}

@app.post("/posts/{post_id}/like")
async def toggle_like(post_id: str, current_user: str = Depends(get_current_user)):
    post = await posts_collection.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found!")

    if current_user in post.get("likes", []):
        await posts_collection.update_one({"_id": ObjectId(post_id)}, {"$pull": {"likes": current_user}})
        return {"liked": False}
    else:
        await posts_collection.update_one({"_id": ObjectId(post_id)}, {"$push": {"likes": current_user}})
        await create_notification(post["username"], current_user, "like", "liked your post.", post_id)
        return {"liked": True}

@app.post("/posts/{post_id}/comment")
async def add_comment(post_id: str, comment: CommentCreate, current_user: str = Depends(get_current_user)):
    post = await posts_collection.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found!")

    new_comment = {"username": current_user, "text": comment.text, "created_at": datetime.utcnow().isoformat()}
    await posts_collection.update_one({"_id": ObjectId(post_id)}, {"$push": {"comments": new_comment}})
    await create_notification(post["username"], current_user, "comment", f"commented: {comment.text}", post_id)
    return {"message": "Comment added!"}

@app.post("/posts/{post_id}/save")
async def toggle_save_post(post_id: str, current_user: str = Depends(get_current_user)):
    me = await users_collection.find_one({"username": current_user})
    if post_id in me.get("saved_posts", []):
        await users_collection.update_one({"username": current_user}, {"$pull": {"saved_posts": post_id}})
        return {"saved": False}
    else:
        await users_collection.update_one({"username": current_user}, {"$push": {"saved_posts": post_id}})
        return {"saved": True}

@app.post("/posts/{post_id}/not-interested")
async def mark_not_interested(post_id: str, current_user: str = Depends(get_current_user)):
    await users_collection.update_one({"username": current_user}, {"$addToSet": {"not_interested": post_id}})
    return {"message": "Post hidden from your feed."}

# --- MODULE 9 & 10: PROFILE, FOLLOW REQUESTS, BLOCK, RESTRICT & REPORT ---

@app.get("/users/search")
async def search_all(q: str = "", current_user: str = Depends(get_current_user)):
    me = await users_collection.find_one({"username": current_user})
    blocked = me.get("blocked_users", [])

    users = []
    u_query = {"username": {"$regex": q, "$options": "i"}, "username": {"$nin": blocked}} if q else {"username": {"$nin": blocked}}
    async for u in users_collection.find(u_query, {"password": 0}).limit(20):
        u["_id"] = str(u["_id"])
        users.append(u)

    # Also search posts by hashtag or caption
    matching_posts = []
    if q:
        clean_q = q.lstrip("#").lower()
        p_query = {"$or": [{"hashtags": clean_q}, {"caption": {"$regex": q, "$options": "i"}}]}
        async for p in posts_collection.find(p_query).limit(20):
            p["_id"] = str(p["_id"])
            matching_posts.append(p)

    return {"users": users, "posts": matching_posts}

@app.get("/users/{username}")
async def get_profile(username: str, current_user: str = Depends(get_current_user)):
    target = await users_collection.find_one({"username": username}, {"password": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found!")
    if current_user in target.get("blocked_users", []):
        raise HTTPException(status_code=403, detail="You are blocked by this user.")

    target["_id"] = str(target["_id"])
    can_view = (not target.get("is_private")) or (username == current_user) or (current_user in target.get("followers", []))

    user_posts, saved_posts, tagged_posts = [], [], []
    if can_view:
        async for p in posts_collection.find({"username": username}).sort("_id", -1):
            p["_id"] = str(p["_id"])
            user_posts.append(p)
        async for p in posts_collection.find({"mentions": username}).sort("_id", -1):
            p["_id"] = str(p["_id"])
            tagged_posts.append(p)

    if username == current_user:
        for pid in target.get("saved_posts", []):
            if ObjectId.is_valid(pid):
                sp = await posts_collection.find_one({"_id": ObjectId(pid)})
                if sp:
                    sp["_id"] = str(sp["_id"])
                    saved_posts.append(sp)

    return {
        "user": target,
        "can_view": can_view,
        "posts": user_posts,
        "saved_posts": saved_posts,
        "tagged_posts": tagged_posts
    }

@app.put("/users/profile")
async def update_profile(profile: ProfileUpdate, current_user: str = Depends(get_current_user)):
    await users_collection.update_one(
        {"username": current_user},
        {"$set": {"full_name": profile.full_name, "bio": profile.bio, "is_private": profile.is_private}}
    )
    return {"message": "Profile updated!"}

@app.post("/users/profile-pic")
async def update_avatar(file: UploadFile = File(...), current_user: str = Depends(get_current_user)):
    res = cloudinary.uploader.upload(file.file, folder="insta_avatars")
    await users_collection.update_one({"username": current_user}, {"$set": {"profile_pic": res.get("secure_url")}})
    return {"profile_pic": res.get("secure_url")}

@app.post("/users/{target_username}/follow")
async def follow_user(target_username: str, current_user: str = Depends(get_current_user)):
    if target_username == current_user:
        raise HTTPException(status_code=400, detail="Cannot follow yourself!")
    target = await users_collection.find_one({"username": target_username})
    if not target:
        raise HTTPException(status_code=404, detail="User not found!")

    # Unfollow if already following
    if current_user in target.get("followers", []):
        await users_collection.update_one({"username": target_username}, {"$pull": {"followers": current_user}})
        await users_collection.update_one({"username": current_user}, {"$pull": {"following": target_username}})
        return {"status": "unfollowed"}

    # Cancel request if pending
    if current_user in target.get("follow_requests", []):
        await users_collection.update_one({"username": target_username}, {"$pull": {"follow_requests": current_user}})
        return {"status": "request_cancelled"}

    # If private account, send follow request
    if target.get("is_private"):
        await users_collection.update_one({"username": target_username}, {"$push": {"follow_requests": current_user}})
        await create_notification(target_username, current_user, "follow_request", "requested to follow you.")
        return {"status": "requested"}

    # Public account -> direct follow
    await users_collection.update_one({"username": target_username}, {"$push": {"followers": current_user}})
    await users_collection.update_one({"username": current_user}, {"$push": {"following": target_username}})
    await create_notification(target_username, current_user, "follow", "started following you.")
    return {"status": "following"}

@app.post("/users/follow-requests/{requester}/accept")
async def accept_follow_request(requester: str, current_user: str = Depends(get_current_user)):
    await users_collection.update_one(
        {"username": current_user},
        {"$pull": {"follow_requests": requester}, "$addToSet": {"followers": requester}}
    )
    await users_collection.update_one({"username": requester}, {"$addToSet": {"following": current_user}})
    await create_notification(requester, current_user, "follow", "accepted your follow request.")
    return {"message": "Request accepted!"}

@app.post("/users/{target_username}/block")
async def toggle_block(target_username: str, current_user: str = Depends(get_current_user)):
    me = await users_collection.find_one({"username": current_user})
    if target_username in me.get("blocked_users", []):
        await users_collection.update_one({"username": current_user}, {"$pull": {"blocked_users": target_username}})
        return {"blocked": False}
    else:
        await users_collection.update_one(
            {"username": current_user},
            {"$addToSet": {"blocked_users": target_username}, "$pull": {"followers": target_username, "following": target_username}}
        )
        await users_collection.update_one(
            {"username": target_username},
            {"$pull": {"followers": current_user, "following": current_user}}
        )
        return {"blocked": True}

@app.post("/report")
async def report_content(report: ReportCreate, current_user: str = Depends(get_current_user)):
    await reports_collection.insert_one({
        "reported_by": current_user,
        "target_type": report.target_type,
        "target_id": report.target_id,
        "reason": report.reason,
        "created_at": datetime.utcnow().isoformat()
    })
    return {"message": "Thank you. Your report has been submitted."}
# --- MODULE 4: REELS (VERTICAL SHORT VIDEOS & VIEW COUNT) ---

@app.get("/reels")
async def get_reels(current_user: str = Depends(get_current_user)):
    reels = []
    # Fetch posts marked as reel or containing video media
    cursor = posts_collection.find({"$or": [{"is_reel": True}, {"media.type": "video"}]}).sort("_id", -1)
    async for r in cursor:
        r["_id"] = str(r["_id"])
        author = await users_collection.find_one({"username": r["username"]})
        r["user_pic"] = author.get("profile_pic", "") if author else ""
        reels.append(r)
    return reels

@app.post("/reels/{reel_id}/view")
async def increment_reel_view(reel_id: str):
    if ObjectId.is_valid(reel_id):
        await posts_collection.update_one({"_id": ObjectId(reel_id)}, {"$inc": {"views": 1}})
    return {"status": "viewed"}

# --- MODULE 5: INTERACTIVE STORIES (POLLS, VIEWERS, REPLIES & HIGHLIGHTS) ---

@app.post("/stories", status_code=status.HTTP_201_CREATED)
async def create_story(
    caption: str = Form(""),
    music_name: str = Form(""),
    poll_question: str = Form(""),
    poll_opt1: str = Form("Yes"),
    poll_opt2: str = Form("No"),
    close_friends_only: bool = Form(False),
    file: UploadFile = File(...),
    current_user: str = Depends(get_current_user)
):
    res_type = "video" if file.content_type.startswith("video/") else "image"
    upload_res = cloudinary.uploader.upload(file.file, folder="insta_stories", resource_type=res_type)

    poll_data = None
    if poll_question.strip():
        poll_data = {
            "question": poll_question,
            "options": [
                {"text": poll_opt1, "votes": []},
                {"text": poll_opt2, "votes": []}
            ]
        }

    new_story = {
        "username": current_user,
        "media_url": upload_res.get("secure_url"),
        "media_type": res_type,
        "caption": caption,
        "music_name": music_name,
        "poll": poll_data,
        "close_friends_only": close_friends_only,
        "viewers": [],
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(hours=24)
    }
    res = await stories_collection.insert_one(new_story)
    return {"message": "Story shared!", "story_id": str(res.inserted_id)}

@app.get("/stories")
async def get_active_stories(current_user: str = Depends(get_current_user)):
    cutoff = datetime.utcnow() - timedelta(hours=24)
    stories = []
    async for s in stories_collection.find({"created_at": {"$gte": cutoff}}).sort("_id", -1):
        s["_id"] = str(s["_id"])
        s["created_at"] = s["created_at"].isoformat()
        s["expires_at"] = s["expires_at"].isoformat()
        stories.append(s)
    return stories

@app.post("/stories/{story_id}/view")
async def mark_story_viewed(story_id: str, current_user: str = Depends(get_current_user)):
    story = await stories_collection.find_one({"_id": ObjectId(story_id)})
    if story and story["username"] != current_user:
        await stories_collection.update_one({"_id": ObjectId(story_id)}, {"$addToSet": {"viewers": current_user}})
    return {"viewed": True}

@app.post("/stories/{story_id}/vote")
async def vote_story_poll(story_id: str, vote: PollVote, current_user: str = Depends(get_current_user)):
    story = await stories_collection.find_one({"_id": ObjectId(story_id)})
    if not story or not story.get("poll"):
        raise HTTPException(status_code=404, detail="Poll not found!")
    
    poll = story["poll"]
    # Remove previous vote if any, then add new vote
    for opt in poll["options"]:
        if current_user in opt["votes"]:
            opt["votes"].remove(current_user)
    poll["options"][vote.option_index]["votes"].append(current_user)

    await stories_collection.update_one({"_id": ObjectId(story_id)}, {"$set": {"poll": poll}})
    return {"poll": poll}

@app.post("/stories/{story_id}/reply")
async def reply_to_story(story_id: str, reply: StoryReply, current_user: str = Depends(get_current_user)):
    story = await stories_collection.find_one({"_id": ObjectId(story_id)})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found!")
    
    # Send story reply directly as a DM message
    await messages_collection.insert_one({
        "sender": current_user,
        "receiver": story["username"],
        "text": f"Replied to your story: {reply.text}",
        "media_url": story["media_url"],
        "reply_to_text": "",
        "reactions": [],
        "seen": False,
        "created_at": datetime.utcnow().isoformat()
    })
    await create_notification(story["username"], current_user, "story_reply", f"replied to your story: {reply.text}")
    return {"message": "Reply sent!"}

@app.post("/users/highlights")
async def add_story_highlight(data: HighlightCreate, current_user: str = Depends(get_current_user)):
    story = await stories_collection.find_one({"_id": ObjectId(data.story_id)})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found!")
    highlight = {"title": data.title, "cover_url": story["media_url"], "story_id": data.story_id}
    await users_collection.update_one({"username": current_user}, {"$push": {"highlights": highlight}})
    return {"message": "Added to Highlights!"}

# --- MODULE 7: ADVANCED DIRECT MESSAGING (REACTIONS, REPLY, DELETE, SEEN & MEDIA) ---

@app.post("/messages", status_code=status.HTTP_201_CREATED)
async def send_dm(msg: MessageSend, current_user: str = Depends(get_current_user)):
    new_msg = {
        "sender": current_user,
        "receiver": msg.receiver,
        "text": msg.text,
        "media_url": msg.media_url,
        "reply_to_text": msg.reply_to_text,
        "reactions": [],
        "seen": False,
        "created_at": datetime.utcnow().isoformat()
    }
    res = await messages_collection.insert_one(new_msg)
    new_msg["_id"] = str(res.inserted_id)
    await create_notification(msg.receiver, current_user, "message", "sent you a new message.")
    return new_msg

@app.post("/messages/upload-media")
async def upload_chat_media(file: UploadFile = File(...), current_user: str = Depends(get_current_user)):
    res_type = "video" if file.content_type.startswith("video/") else "image"
    upload_res = cloudinary.uploader.upload(file.file, folder="insta_chat_media", resource_type=res_type)
    return {"media_url": upload_res.get("secure_url")}

@app.get("/messages/{other_user}")
async def get_conversation(other_user: str, current_user: str = Depends(get_current_user)):
    # Mark incoming messages as Seen
    await messages_collection.update_many(
        {"sender": other_user, "receiver": current_user, "seen": False},
        {"$set": {"seen": True}}
    )
    query = {
        "$or": [
            {"sender": current_user, "receiver": other_user},
            {"sender": other_user, "receiver": current_user}
        ]
    }
    msgs = []
    async for m in messages_collection.find(query).sort("_id", 1):
        m["_id"] = str(m["_id"])
        msgs.append(m)
    return msgs

@app.post("/messages/{msg_id}/react")
async def react_to_message(msg_id: str, data: MessageReaction, current_user: str = Depends(get_current_user)):
    await messages_collection.update_one(
        {"_id": ObjectId(msg_id)},
        {"$push": {"reactions": {"username": current_user, "emoji": data.emoji}}}
    )
    return {"message": "Reaction added!"}

@app.delete("/messages/{msg_id}")
async def delete_message(msg_id: str, current_user: str = Depends(get_current_user)):
    msg = await messages_collection.find_one({"_id": ObjectId(msg_id)})
    if not msg or msg["sender"] != current_user:
        raise HTTPException(status_code=403, detail="Can only unsend your own messages!")
    await messages_collection.delete_one({"_id": ObjectId(msg_id)})
    return {"message": "Message unsent!"}

# --- MODULE 8: NOTIFICATIONS CENTER ---

@app.get("/notifications")
async def get_notifications(current_user: str = Depends(get_current_user)):
    notifs = []
    async for n in notifications_collection.find({"recipient": current_user}).sort("_id", -1).limit(30):
        n["_id"] = str(n["_id"])
        notifs.append(n)
    await notifications_collection.update_many({"recipient": current_user, "is_read": False}, {"$set": {"is_read": True}})
    return notifs