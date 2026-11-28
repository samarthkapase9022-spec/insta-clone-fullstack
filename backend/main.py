from fastapi import FastAPI, HTTPException, status, UploadFile, File, Form, Depends, Request, Body
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from bson import ObjectId
import cloudinary
import cloudinary.uploader
import re
from datetime import datetime, timedelta
from database import (
    users_collection, posts_collection, stories_collection,
    messages_collection, notifications_collection, reports_collection,
    calls_collection
)
from auth import hash_password, verify_password, create_access_token, get_current_user
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

app = FastAPI(title="Pixagram Full Production API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://pixagram-social.vercel.app",
        "http://localhost:5173",
        "*"
    ],
    allow_credentials=False,
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
        "created_at": datetime.utcnow().isoformat() + "Z"
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
        "login_activity": [],
        "last_seen": datetime.utcnow().isoformat() + "Z"
    }
    await users_collection.insert_one(new_user)
    return {"message": "Account created successfully!"}

@app.post("/login")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    db_user = await users_collection.find_one({"email": form_data.username})
    if not db_user or not verify_password(form_data.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password!")

    now_iso = datetime.utcnow().isoformat() + "Z"
    activity = {
        "ip": request.client.host if request.client else "Unknown",
        "device": request.headers.get("user-agent", "Unknown Browser")[:60],
        "time": now_iso
    }
    await users_collection.update_one(
        {"_id": db_user["_id"]},
        {
            "$push": {"login_activity": {"$each": [activity], "$slice": -10}},
            "$set": {"last_seen": now_iso}
        }
    )

    token = create_access_token({"sub": db_user["email"], "username": db_user["username"]})
    return {"access_token": token, "token_type": "bearer", "username": db_user["username"]}

@app.post("/users/ping")
async def ping_active_status(current_user: str = Depends(get_current_user)):
    now_iso = datetime.utcnow().isoformat() + "Z"
    await users_collection.update_one({"username": current_user}, {"$set": {"last_seen": now_iso}})
    return {"status": "online", "last_seen": now_iso}

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
        res_type = "video" if file.content_type.startswith("video/") else "image"
        upload_res = cloudinary.uploader.upload(file.file, folder="insta_media", resource_type=res_type)
        media_items.append({"url": upload_res.get("secure_url"), "type": res_type})

    hashtags = re.findall(r"#(\w+)", caption)
    mentions = re.findall(r"@(\w+)", caption)

    new_post = {
        "username": current_user,
        "media": media_items,
        "caption": caption,
        "location": location,
        "hashtags": [h.lower() for h in hashtags],
        "mentions": [m.lower() for m in mentions],
        "is_reel": is_reel,
        "views": 0,
        "likes": [],
        "comments": [],
        "created_at": datetime.utcnow().isoformat() + "Z"
    }
    result = await posts_collection.insert_one(new_post)

    for mentioned_user in mentions:
        await create_notification(mentioned_user.lower(), current_user, "mention", "mentioned you in a post.", str(result.inserted_id))

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
        if author and author.get("is_private") and post["username"] != current_user:
            if current_user not in author.get("followers", []):
                continue

        post["_id"] = post_id_str
        post["user_pic"] = author.get("profile_pic", "") if author else ""
        post["author_last_seen"] = author.get("last_seen", "") if author else ""
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

    new_comment = {"username": current_user, "text": comment.text, "created_at": datetime.utcnow().isoformat() + "Z"}
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
    clean_q = q.strip()

    users = []
    if clean_q:
        # Show public accounts matching regex OR private accounts ONLY if exact username matches (or already connected)
        privacy_filter = {
            "$and": [
                {"username": {"$nin": blocked}},
                {
                    "$or": [
                        {"username": current_user},
                        {"is_private": {"$ne": True}, "username": {"$regex": re.escape(clean_q), "$options": "i"}},
                        {"following": current_user, "username": {"$regex": re.escape(clean_q), "$options": "i"}},
                        {"followers": current_user, "username": {"$regex": re.escape(clean_q), "$options": "i"}},
                        {"username": {"$regex": f"^{re.escape(clean_q)}$", "$options": "i"}},
                    ]
                }
            ]
        }
    else:
        # When q is empty (Inbox & Suggested users), show ONLY public accounts or already connected private accounts
        privacy_filter = {
            "$and": [
                {"username": {"$nin": blocked}},
                {
                    "$or": [
                        {"username": current_user},
                        {"is_private": {"$ne": True}},
                        {"following": current_user},
                        {"followers": current_user},
                    ]
                }
            ]
        }

    async for u in users_collection.find(privacy_filter, {"password": 0}).limit(30):
        u["_id"] = str(u["_id"])
        last_msg = await messages_collection.find_one(
            {"$or": [{"sender": current_user, "receiver": u["username"]}, {"sender": u["username"], "receiver": current_user}]},
            sort=[("_id", -1)]
        )
        u["last_msg_text"] = (last_msg.get("text") or "📷 Photo") if last_msg else ""
        u["last_msg_time"] = last_msg.get("created_at", "") if last_msg else ""
        users.append(u)

    matching_posts = []
    if clean_q:
        tag_q = clean_q.lstrip("#").lower()
        p_query = {"$or": [{"hashtags": tag_q}, {"caption": {"$regex": re.escape(clean_q), "$options": "i"}}]}
        async for p in posts_collection.find(p_query).limit(20):
            author = await users_collection.find_one({"username": p["username"]})
            if author and author.get("is_private") and p["username"] != current_user:
                if current_user not in author.get("followers", []) and current_user not in author.get("following", []):
                    continue
            p["_id"] = str(p["_id"])
            matching_posts.append(p)

    return {"users": users, "posts": matching_posts}

@app.get("/users/{username}")
async def get_profile(username: str, current_user: str = Depends(get_current_user)):
    clean_username = username.strip()
    target = await users_collection.find_one(
        {"username": {"$regex": f"^\\s*{re.escape(clean_username)}\\s*$", "$options": "i"}},
        {"password": 0}
    )
    if not target:
        raise HTTPException(status_code=404, detail=f"User '{clean_username}' not found!")
    if current_user in target.get("blocked_users", []):
        raise HTTPException(status_code=403, detail="You are blocked by this user.")

    target["_id"] = str(target["_id"])
    can_view = (
        (not target.get("is_private"))
        or (username == current_user)
        or (current_user in target.get("followers", []))
        or (current_user in target.get("following", []))
    )

    # Hide followers/following lists if viewer is not approved
    if not can_view:
        target["followers"] = []
        target["following"] = []

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

    if current_user in target.get("followers", []):
        await users_collection.update_one({"username": target_username}, {"$pull": {"followers": current_user}})
        await users_collection.update_one({"username": current_user}, {"$pull": {"following": target_username}})
        return {"status": "unfollowed"}

    if current_user in target.get("follow_requests", []):
        await users_collection.update_one({"username": target_username}, {"$pull": {"follow_requests": current_user}})
        return {"status": "request_cancelled"}

    if target.get("is_private"):
        await users_collection.update_one({"username": target_username}, {"$push": {"follow_requests": current_user}})
        await create_notification(target_username, current_user, "follow_request", "requested to follow you.")
        return {"status": "requested"}

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
        "created_at": datetime.utcnow().isoformat() + "Z"
    })
    return {"message": "Thank you. Your report has been submitted."}

# --- MODULE 4: REELS ---

@app.get("/reels")
async def get_reels(current_user: str = Depends(get_current_user)):
    reels = []
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

# --- MODULE 5: STORIES ---

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
        s["created_at"] = s["created_at"].isoformat() + "Z"
        s["expires_at"] = s["expires_at"].isoformat() + "Z"
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
    
    await messages_collection.insert_one({
        "sender": current_user,
        "receiver": story["username"],
        "text": f"Replied to your story: {reply.text}",
        "media_url": story["media_url"],
        "reply_to_text": "",
        "reactions": [],
        "seen": False,
        "created_at": datetime.utcnow().isoformat() + "Z"
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

# --- MODULE 7: DIRECT MESSAGING ---

@app.post("/messages", status_code=status.HTTP_201_CREATED)
async def send_dm(msg: MessageSend, current_user: str = Depends(get_current_user)):
    recipient_user = await users_collection.find_one({"username": msg.receiver})
    if not recipient_user:
        raise HTTPException(status_code=404, detail="User not found!")
    if recipient_user.get("is_private"):
        if current_user not in recipient_user.get("following", []) and current_user not in recipient_user.get("followers", []):
            raise HTTPException(status_code=403, detail="This account is private. You cannot message them until they follow you or accept your request.")

    new_msg = {
        "sender": current_user,
        "receiver": msg.receiver,
        "text": msg.text,
        "media_url": msg.media_url,
        "reply_to_text": msg.reply_to_text,
        "reactions": [],
        "seen": False,
        "created_at": datetime.utcnow().isoformat() + "Z"
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

# --- LIVE AUDIO / VIDEO CALLING (WEBRTC SIGNALING) ---

@app.post("/calls/initiate")
async def initiate_call(payload: dict = Body(...), current_user: str = Depends(get_current_user)):
    callee = payload.get("callee")
    callee_user = await users_collection.find_one({"username": callee})
    if callee_user and callee_user.get("is_private"):
        if current_user not in callee_user.get("following", []) and current_user not in callee_user.get("followers", []):
            raise HTTPException(status_code=403, detail="Cannot call a private account unless connected.")

    call_type = payload.get("call_type", "video")
    offer = payload.get("offer")
    await calls_collection.delete_many({"$or": [{"caller": current_user}, {"callee": callee}]})
    res = await calls_collection.insert_one({
        "caller": current_user,
        "callee": callee,
        "call_type": call_type,
        "offer": offer,
        "answer": None,
        "status": "ringing",
        "created_at": datetime.utcnow().isoformat() + "Z"
    })
    return {"call_id": str(res.inserted_id)}

@app.get("/calls/incoming")
async def check_incoming_call(current_user: str = Depends(get_current_user)):
    call = await calls_collection.find_one({"callee": current_user, "status": "ringing"}, sort=[("_id", -1)])
    if not call:
        return None
    call["_id"] = str(call["_id"])
    return call

@app.post("/calls/{call_id}/answer")
async def answer_call(call_id: str, payload: dict = Body(...), current_user: str = Depends(get_current_user)):
    await calls_collection.update_one(
        {"_id": ObjectId(call_id)},
        {"$set": {"answer": payload.get("answer"), "status": "connected"}}
    )
    return {"status": "connected"}

@app.get("/calls/{call_id}")
async def get_call_status(call_id: str, current_user: str = Depends(get_current_user)):
    if not ObjectId.is_valid(call_id):
        return {"status": "ended"}
    call = await calls_collection.find_one({"_id": ObjectId(call_id)})
    if not call:
        return {"status": "ended"}
    call["_id"] = str(call["_id"])
    return call

@app.post("/calls/{call_id}/end")
async def end_call(call_id: str, current_user: str = Depends(get_current_user)):
    if ObjectId.is_valid(call_id):
        await calls_collection.update_one({"_id": ObjectId(call_id)}, {"$set": {"status": "ended"}})
    return {"status": "ended"}

# --- MODULE 8: NOTIFICATIONS CENTER ---

@app.get("/notifications")
async def get_notifications(current_user: str = Depends(get_current_user)):
    notifs = []
    async for n in notifications_collection.find({"recipient": current_user}).sort("_id", -1).limit(30):
        n["_id"] = str(n["_id"])
        notifs.append(n)
    await notifications_collection.update_many({"recipient": current_user, "is_read": False}, {"$set": {"is_read": True}})
    return notifs
@app.delete("/users/me")
async def delete_my_account(payload: dict = Body(...), current_user: str = Depends(get_current_user)):
    password = payload.get("password", "")
    user = await users_collection.find_one({"username": current_user})
    if not user or not verify_password(password, user["password"]):
        raise HTTPException(status_code=400, detail="Incorrect password! Cannot delete account.")

    # Delete user's posts, stories, messages, notifications, and calls
    await posts_collection.delete_many({"username": current_user})
    await stories_collection.delete_many({"username": current_user})
    await messages_collection.delete_many({"$or": [{"sender": current_user}, {"receiver": current_user}]})
    await notifications_collection.delete_many({"$or": [{"recipient": current_user}, {"actor": current_user}]})
    await calls_collection.delete_many({"$or": [{"caller": current_user}, {"callee": current_user}]})

    # Remove username from other users' followers, following, requests, and blocks
    await users_collection.update_many(
        {},
        {
            "$pull": {
                "followers": current_user,
                "following": current_user,
                "follow_requests": current_user,
                "blocked_users": current_user
            }
        }
    )

    # Finally delete the user account
    await users_collection.delete_one({"username": current_user})
    return {"message": "Your account and all associated data have been permanently deleted."}