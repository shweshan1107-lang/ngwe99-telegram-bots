# Ngwe99 Telegram Bot — Render Server v11

## GitHub မတင်ခင်

လက်ရှိ အလုပ်လုပ်နေသော Project Folder မှာရှိသည့် ဖိုင်များကို ဒီ Package ထဲ ကူးပါ။

1. `photo-cache.json` → `seed-data/photo-cache.json`
2. `coupon-codes.json` → `seed-data/coupon-codes.json`
3. `message-state.json` → `seed-data/message-state.json`
4. လက်ရှိ `assets` Folder ထဲက ဖိုင်အားလုံး → ဒီ Package ရဲ့ `assets` Folder

`.env` ဖိုင်နဲ့ Bot Token များကို GitHub မတင်ပါနှင့်။

## Render

ဒီ Repo မှာ `render.yaml` ပါပြီးဖြစ်သောကြောင့် Render မှာ New > Blueprint သုံးနိုင်ပါတယ်။

Render Environment မှာ ဖြည့်ရမည့် Secret Values:

- MAIN_BOT_TOKEN
- PROMOTION_BOT_TOKEN
- COUPON_BOT_TOKEN
- CHANNEL_URL
- EVENTS_CHANNEL_URL
- GAME_URL
- ADMIN_CONTACT_URL
- PHOTO_SETUP_PASSWORD
- COUPON_SETUP_PASSWORD

Default Settings:

- BOT_TITLE=Ngwe99
- COUPON_TIMEZONE=Asia/Bangkok
- DATA_DIR=/opt/render/project/src/storage

## အရေးကြီး

Render Deploy စပြီး Bot Live ဖြစ်သွားချိန်မှာ Local Computer မှာဖွင့်ထားသည့် `start.bat`
CMD Window ကို ပိတ်ထားရပါမယ်။ Token တူ Bot ကို Local နှင့် Render နှစ်နေရာတွင်
တစ်ပြိုင်နက် Long Polling Run မလုပ်ရပါ။
