from pydantic import BaseModel, EmailStr
from typing import Optional

class UserSignup(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: str = ""

class CommentCreate(BaseModel):
    text: str

class ProfileUpdate(BaseModel):
    full_name: str = ""
    bio: str = ""
    is_private: bool = False

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

class PostUpdate(BaseModel):
    caption: str
    location: str = ""

class ReportCreate(BaseModel):
    target_type: str  # "post" or "user"
    target_id: str
    reason: str    

class StoryReply(BaseModel):
    text: str

class PollVote(BaseModel):
    option_index: int  # 0 or 1

class HighlightCreate(BaseModel):
    title: str
    story_id: str

class MessageSend(BaseModel):
    receiver: str
    text: str = ""
    media_url: str = ""
    reply_to_text: str = ""

class MessageReaction(BaseModel):
    emoji: str