const fs = require('fs');
const path = require('path');
const { Telegraf, Markup, Input } = require('telegraf');

function loadEnvFile(filePath = path.join(__dirname, '.env')) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalIndex = line.indexOf('=');
    if (equalIndex < 1) continue;

    const key = line.slice(0, equalIndex).trim();
    let value = line.slice(equalIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const MAIN_BOT_TOKEN = process.env.MAIN_BOT_TOKEN || process.env.BOT_TOKEN;
const PROMOTION_BOT_TOKEN = process.env.PROMOTION_BOT_TOKEN;
const COUPON_BOT_TOKEN = process.env.COUPON_BOT_TOKEN;

const EVENTS_CHANNEL_URL =
  process.env.EVENTS_CHANNEL_URL || 'https://t.me/your_events_channel';

// ပင်မ Channel Link သီးသန့်ရှိရင် .env ထဲမှာ CHANNEL_URL ထည့်ပါ။
// မထည့်ရသေးရင် Events Channel ကို ယာယီအသုံးပြုမယ်။
const CHANNEL_URL =
  process.env.CHANNEL_URL || EVENTS_CHANNEL_URL;

const GAME_URL = process.env.GAME_URL || 'https://example.com';
const ADMIN_CONTACT_URL =
  process.env.ADMIN_CONTACT_URL || 'https://t.me/your_admin_username';
const BOT_TITLE = process.env.BOT_TITLE || 'Ngwe99';
const PHOTO_SETUP_PASSWORD = process.env.PHOTO_SETUP_PASSWORD || '';

const WELCOME_VIDEO_PATH = path.resolve(
  __dirname,
  process.env.WELCOME_VIDEO_PATH || './assets/welcome.mp4'
);

const PROMOTION_IMAGE_PATH = path.resolve(
  __dirname,
  process.env.PROMOTION_IMAGE_PATH || './assets/promotion.jpg'
);

const COUPON_IMAGE_PATH = path.resolve(
  __dirname,
  process.env.COUPON_IMAGE_PATH || './assets/coupon.jpg'
);

// Local မှာ Project Folder ကိုသုံးပြီး Render မှာ Persistent Disk path ကိုသုံးမယ်။
const DATA_DIR = path.resolve(process.env.DATA_DIR || __dirname);
const SEED_DATA_DIR = path.resolve(__dirname, './seed-data');

fs.mkdirSync(DATA_DIR, { recursive: true });

const PHOTO_CACHE_PATH = path.join(DATA_DIR, 'photo-cache.json');
const MESSAGE_STATE_PATH = path.join(DATA_DIR, 'message-state.json');
const COUPON_CODES_PATH = path.join(DATA_DIR, 'coupon-codes.json');

function seedPersistentFile(fileName, fallbackValue) {
  const targetPath = path.join(DATA_DIR, fileName);
  const seedPath = path.join(SEED_DATA_DIR, fileName);

  if (fs.existsSync(targetPath)) {
    return;
  }

  try {
    if (fs.existsSync(seedPath)) {
      fs.copyFileSync(seedPath, targetPath);
      console.log(`✅ ${fileName} ကို Persistent Disk ထဲ စတင်ကူးပြီးပါပြီ`);
      return;
    }

    fs.writeFileSync(
      targetPath,
      JSON.stringify(fallbackValue, null, 2),
      'utf8'
    );
  } catch (error) {
    console.error(`${fileName} စတင်တည်ဆောက်မရပါ:`, error.message);
    throw error;
  }
}

const COUPON_TIMEZONE = process.env.COUPON_TIMEZONE || 'Asia/Bangkok';
const COUPON_SETUP_PASSWORD =
  process.env.COUPON_SETUP_PASSWORD || PHOTO_SETUP_PASSWORD;

const requiredValues = {
  MAIN_BOT_TOKEN,
  PROMOTION_BOT_TOKEN,
  COUPON_BOT_TOKEN,
  EVENTS_CHANNEL_URL,
  GAME_URL,
  ADMIN_CONTACT_URL
};

const missingValues = Object.entries(requiredValues)
  .filter(([, value]) => {
    return (
      !value ||
      value.includes('PASTE_') ||
      value.includes('your_') ||
      value === 'https://example.com'
    );
  })
  .map(([key]) => key);

if (missingValues.length > 0) {
  console.error(
    `.env ထဲမှာ ဒီအချက်တွေ မပြည့်သေးပါ: ${missingValues.join(', ')}`
  );
  process.exit(1);
}

const mainBot = new Telegraf(MAIN_BOT_TOKEN);
const promotionBot = new Telegraf(PROMOTION_BOT_TOKEN);
const couponBot = new Telegraf(COUPON_BOT_TOKEN);

let botUsernames = {
  main: '',
  promotion: '',
  coupon: ''
};


const COUPON_LEVELS = {
  new: { button: '🌱 New', title: 'NEW' },
  silver: { button: '🥈 Silver', title: 'SILVER' },
  gold: { button: '🥇 Gold', title: 'GOLD' },
  platinum: { button: '💠 Platinum', title: 'PLATINUM' },
  titanium: { button: '⚙️ Titanium', title: 'TITANIUM' },
  diamond: { button: '💎 Diamond', title: 'DIAMOND' },
  vvip: { button: '👑 VVIP', title: 'VVIP' }
};

const EMPTY_COUPON_CODES = Object.fromEntries(
  Object.keys(COUPON_LEVELS).map((levelKey) => [levelKey, ''])
);

const ALLOWED_PHOTO_KEYS = [
  'promotion',
  'coupon',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
];

let telegramPhotoCache = {};
let couponCodes = { ...EMPTY_COUPON_CODES };
let messageState = {
  main: {},
  promotion: {},
  coupon: {},
  quickKeyboard: {
    main: {},
    promotion: {},
    coupon: {}
  },
  quickAction: {
    main: {},
    promotion: {},
    coupon: {}
  }
};

seedPersistentFile('photo-cache.json', {});
seedPersistentFile('coupon-codes.json', EMPTY_COUPON_CODES);
seedPersistentFile('message-state.json', messageState);

function readJsonFile(filePath, fallbackValue) {
  try {
    if (!fs.existsSync(filePath)) return fallbackValue;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.log(`${path.basename(filePath)} ဖတ်မရပါ:`, error.message);
    return fallbackValue;
  }
}

telegramPhotoCache = readJsonFile(PHOTO_CACHE_PATH, {});
couponCodes = {
  ...EMPTY_COUPON_CODES,
  ...readJsonFile(COUPON_CODES_PATH, EMPTY_COUPON_CODES)
};
messageState = readJsonFile(MESSAGE_STATE_PATH, messageState);

// message-state.json အဟောင်းမှာ key အသစ်တွေ မရှိသေးရင် အလိုအလျောက်ဖြည့်ပေးမယ်။
messageState.main = messageState.main || {};
messageState.promotion = messageState.promotion || {};
messageState.coupon = messageState.coupon || {};
messageState.quickKeyboard = messageState.quickKeyboard || {};
messageState.quickKeyboard.main = messageState.quickKeyboard.main || {};
messageState.quickKeyboard.promotion = messageState.quickKeyboard.promotion || {};
messageState.quickKeyboard.coupon = messageState.quickKeyboard.coupon || {};
messageState.quickAction = messageState.quickAction || {};
messageState.quickAction.main = messageState.quickAction.main || {};
messageState.quickAction.promotion = messageState.quickAction.promotion || {};
messageState.quickAction.coupon = messageState.quickAction.coupon || {};
function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function savePhotoCache() {
  writeJsonFile(PHOTO_CACHE_PATH, telegramPhotoCache);
}

function saveCouponCodes() {
  writeJsonFile(COUPON_CODES_PATH, couponCodes);
}

function saveMessageState() {
  writeJsonFile(MESSAGE_STATE_PATH, messageState);
}

function saveTelegramPhotoId(key, message) {
  const photoSizes = message?.photo;

  if (!Array.isArray(photoSizes) || photoSizes.length === 0) {
    return;
  }

  const largestPhoto = photoSizes[photoSizes.length - 1];
  if (!largestPhoto?.file_id) return;

  telegramPhotoCache[key] = largestPhoto.file_id;
  savePhotoCache();

  console.log(`✅ ${key} photo cache သိမ်းပြီးပါပြီ`);
}

function getTelegramPhoto(key, localImagePath) {
  if (telegramPhotoCache[key]) {
    return telegramPhotoCache[key];
  }

  return Input.fromLocalFile(localImagePath);
}

function saveTelegramVideoId(key, message) {
  const fileId = message?.video?.file_id;
  if (!fileId) return;

  telegramPhotoCache[key] = fileId;
  savePhotoCache();
  console.log(`✅ ${key} video cache သိမ်းပြီးပါပြီ`);
}

function getTelegramVideo(key, localVideoPath) {
  if (telegramPhotoCache[key]) {
    return telegramPhotoCache[key];
  }

  return Input.fromLocalFile(localVideoPath);
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function telegramRequestWithRetry(requestFunction) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await requestFunction();
    } catch (error) {
      lastError = error;

      const errorCode = error?.code || error?.errno;
      const canRetry = [
        'ECONNRESET',
        'ETIMEDOUT',
        'EAI_AGAIN',
        'ECONNREFUSED'
      ].includes(errorCode);

      if (!canRetry || attempt === 3) {
        throw error;
      }

      console.log(
        `Telegram connection ပြတ်သွားလို့ ပြန်ကြိုးစားနေပါတယ် (${attempt}/3)...`
      );

      await wait(attempt * 1000);
    }
  }

  throw lastError;
}

function telegramBotUrl(username) {
  return `https://t.me/${username}`;
}

function safeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function safeDeleteMessage(botOrTelegram, chatId, messageId) {
  if (!chatId || !messageId) return;

  const telegram = botOrTelegram.telegram || botOrTelegram;

  try {
    await telegram.deleteMessage(chatId, messageId);
  } catch (error) {
    const description = String(error?.description || error?.message || '');

    if (
      !description.includes('message to delete not found') &&
      !description.includes("message can't be deleted")
    ) {
      console.log('Message ဖျက်မရပါ:', description);
    }
  }
}

async function removeCommandMessage(ctx) {
  const chatId = ctx.chat?.id;
  const messageId = ctx.message?.message_id;

  if (!chatId || !messageId) return;
  await safeDeleteMessage(ctx.telegram, chatId, messageId);
}

async function removePreviousHome(botKey, bot, chatId) {
  const previousMessageId = messageState?.[botKey]?.[String(chatId)];
  if (!previousMessageId) return;

  await safeDeleteMessage(bot, chatId, previousMessageId);
  delete messageState[botKey][String(chatId)];
  saveMessageState();
}

function rememberHomeMessage(botKey, chatId, messageId) {
  if (!messageState[botKey]) {
    messageState[botKey] = {};
  }

  messageState[botKey][String(chatId)] = messageId;
  saveMessageState();
}

function quickReplyKeyboard(botKey) {
  const layouts = {
    main: [
      ['📢 Channel', '🎁 Daily Bonus'],
      ['🎉 Events', '🎟 Coupon']
    ],
    promotion: [
      ['📢 Channel', '🎟 Coupon'],
      ['🎉 Events']
    ],
    coupon: [
      ['📢 Channel', '🎁 Daily Bonus'],
      ['🎉 Events']
    ]
  };

  const rows = layouts[botKey] || layouts.main;

  return {
    reply_markup: {
      keyboard: rows.map((row) => row.map((text) => ({ text }))),
      resize_keyboard: true,
      is_persistent: true,
      input_field_placeholder: 'Menu ရွေးပါ'
    }
  };
}

async function removeStoredMessage(groupKey, botKey, bot, chatId) {
  const group = messageState?.[groupKey]?.[botKey];
  const previousMessageId = group?.[String(chatId)];

  if (!previousMessageId) return;

  await safeDeleteMessage(bot, chatId, previousMessageId);
  delete group[String(chatId)];
  saveMessageState();
}

function rememberStoredMessage(groupKey, botKey, chatId, messageId) {
  if (!messageState[groupKey]) messageState[groupKey] = {};
  if (!messageState[groupKey][botKey]) messageState[groupKey][botKey] = {};

  messageState[groupKey][botKey][String(chatId)] = messageId;
  saveMessageState();
}

async function showQuickKeyboard(ctx, botKey, bot) {
  const chatId = ctx.chat?.id;
  if (!chatId) return null;

  const previousMessageId =
    messageState?.quickKeyboard?.[botKey]?.[String(chatId)];

  // Keyboard အသစ်ကို အရင်ပို့ပြီးမှ အဟောင်းကိုဖျက်မယ်။
  // ဒီနည်းနဲ့ ဖုန်းမှာ Chat/Keyboard ခဏပျောက်သွားတာ မဖြစ်တော့ဘူး။
  const keyboardMessage = await ctx.reply(
    '👇 Menu',
    quickReplyKeyboard(botKey)
  );

  rememberStoredMessage(
    'quickKeyboard',
    botKey,
    chatId,
    keyboardMessage.message_id
  );

  if (
    previousMessageId &&
    previousMessageId !== keyboardMessage.message_id
  ) {
    await safeDeleteMessage(bot, chatId, previousMessageId);
  }

  return keyboardMessage;
}

async function sendQuickLink(ctx, botKey, bot, title, buttonText, url) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  await removeCommandMessage(ctx);
  await removeStoredMessage('quickAction', botKey, bot, chatId);

  const sentMessage = await ctx.replyWithHTML(
    title,
    Markup.inlineKeyboard([
      [Markup.button.url(buttonText, url)]
    ])
  );

  rememberStoredMessage(
    'quickAction',
    botKey,
    chatId,
    sentMessage.message_id
  );
}

function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.url(
        '🎁 Daily Bonus',
        telegramBotUrl(botUsernames.promotion)
      )
    ],
    [
      Markup.button.url('🎉 Events', EVENTS_CHANNEL_URL),
      Markup.button.url('🎟 Coupon', telegramBotUrl(botUsernames.coupon))
    ],
    [Markup.button.url('🎮 Game Link', GAME_URL)]
  ]);
}

function mainBotBackKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.url(
        '🏠 Main Menu Bot သို့ပြန်ရန်',
        telegramBotUrl(botUsernames.main)
      )
    ]
  ]);
}

function promotionDayKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🌙 တနင်္လာ', 'promo_monday'),
      Markup.button.callback('🔥 အင်္ဂါ', 'promo_tuesday')
    ],
    [
      Markup.button.callback('💎 ဗုဒ္ဓဟူး', 'promo_wednesday'),
      Markup.button.callback('🍀 ကြာသပတေး', 'promo_thursday')
    ],
    [
      Markup.button.callback('🎉 သောကြာ', 'promo_friday'),
      Markup.button.callback('👑 စနေ', 'promo_saturday')
    ],
    [Markup.button.callback('☀️ တနင်္ဂနွေ', 'promo_sunday')],
    [Markup.button.url('🏠 Main', telegramBotUrl(botUsernames.main))]
  ]);
}

function promotionDetailKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.url('🎮 ကစားမယ်', GAME_URL),
      Markup.button.url('💬 Admin', ADMIN_CONTACT_URL)
    ],
    [
      Markup.button.callback('📅 ရက်ရွေး', 'promotion_home'),
      Markup.button.url('🏠 Main', telegramBotUrl(botUsernames.main))
    ]
  ]);
}

function welcomeCaption(userName = '') {
  const safeName = safeHtml(userName);
  const greeting = safeName
    ? `မင်္ဂလာပါ <b>${safeName}</b> 👋`
    : 'မင်္ဂလာပါ 👋';

  return [
    `🎁 <b>${BOT_TITLE} Menu</b>`,
    '',
    greeting,
    'လိုရာ Menu ကို အောက်က Button မှ ရွေးပါရှင့် 👇'
  ].join('\n');
}

function getPromotionHomeCaption() {
  return [
    `🎁 <b>${BOT_TITLE} Daily Bonus</b>`,
    '',
    'တစ်ရက်တစ်မျိုး ဘောနပ်များကို ရက်အလိုက် ရွေးကြည့်ပါရှင့် 👇'
  ].join('\n');
}

const promotionDayNames = {
  promo_monday: '🌙 Monday Bonus',
  promo_tuesday: '🔥 Tuesday Bonus',
  promo_wednesday: '💎 Wednesday Bonus',
  promo_thursday: '🍀 Thursday Bonus',
  promo_friday: '🎉 Friday Bonus',
  promo_saturday: '👑 Saturday Bonus',
  promo_sunday: '☀️ Sunday Bonus'
};

const PROMOTION_DAY_DETAILS = {
  promo_monday: {
    image: path.resolve(__dirname, './assets/monday.jpg'),
    caption: [
      '🌙 <b>MONDAY BONUS — 40 ဘတ်</b>',
      '',
      '📅 တနင်္လာနေ့တိုင်း',
      '💰 အကောင့်ထဲ <b>100 ဘတ်နှင့်အထက်</b> ရှိရမည်။',
      '📌 လက်ကျန်ငွေ + Bonus 40 ကို <b>6 ဆ</b> ကစားရမည်။',
      '✅ လောင်းကြေးပြည့်ပါက နိုင်သလောက်ထုတ်နိုင်သည်။'
    ].join('\n')
  },

  promo_tuesday: {
    image: path.resolve(__dirname, './assets/tuesday.jpg'),
    caption: [
      '🔥 <b>TUESDAY BONUS — FREE 99</b>',
      '',
      '📅 အင်္ဂါနေ့တိုင်း',
      '💰 ငွေသွင်း <b>7 ကြိမ်ပြည့်</b> ပါက 99 ဘတ်ရမည်။',
      '📌 Bonus ကို <b>2 ဆ</b> ကစားရမည်။',
      '✅ အများဆုံး <b>150 ဘတ်</b> ထုတ်နိုင်ပြီး ကျန်ယူနစ် Auto ဖြတ်မည်။'
    ].join('\n')
  },

  promo_wednesday: {
    image: path.resolve(__dirname, './assets/wednesday.jpg'),
    caption: [
      '💎 <b>WEDNESDAY — FREE 50 COUPON</b>',
      '',
      '📅 ဗုဒ္ဓဟူးနေ့တိုင်း',
      '💰 <b>100 ဘတ်</b> သွင်းကစားထားပါက Coupon ရမည်။',
      '📌 Bonus ကို <b>2 ဆ</b> ကစားရမည်။',
      '✅ အများဆုံး <b>100 ဘတ်</b> ထုတ်နိုင်ပြီး ကျန်ယူနစ် Auto ဖြတ်မည်။'
    ].join('\n')
  },

  promo_thursday: {
    image: path.resolve(__dirname, './assets/thursday.jpg'),
    caption: [
      '🍀 <b>THURSDAY — LEVEL UP BONUS</b>',
      '',
      '🥈 Silver 25%  |  🥇 Gold 50%',
      '💠 Platinum 75%  |  ⚙️ Titanium 100%',
      '💎 Diamond 150%  |  👑 VVIP 200%',
      '',
      '📌 ကြာသပတေးနေ့တိုင်း မိမိ Level အလိုက် ရယူနိုင်သည်။'
    ].join('\n')
  },

  promo_friday: {
    image: path.resolve(__dirname, './assets/friday.jpg'),
    caption: [
      '🎉 <b>FRIDAY BONUS — 10%</b>',
      '',
      '📅 သောကြာနေ့တိုင်း',
      '💰 တစ်ရက်တစ်ကြိမ်၊ အနည်းဆုံး <b>100 ဘတ်</b> သွင်းရမည်။',
      '📌 Bonus ကို <b>5 ဆ</b> ကစားရမည်။',
      '✅ လောင်းကြေးပြည့်ပါက နိုင်သလောက်ထုတ်နိုင်သည်။'
    ].join('\n')
  },

  promo_saturday: {
    image: path.resolve(__dirname, './assets/saturday.jpg'),
    caption: [
      '👑 <b>SATURDAY BONUS — 50%</b>',
      '',
      '📅 စနေနေ့တိုင်း',
      '💰 ထိုနေ့၏ ကြိုက်ရာသွင်းငွေ <b>တစ်ကြိမ်</b> တွင်',
      '🎁 <b>50% Bonus</b> ရယူကစားနိုင်သည်။'
    ].join('\n')
  },

  promo_sunday: {
    image: path.resolve(__dirname, './assets/sunday.jpg'),
    caption: [
      '☀️ <b>SUNDAY BONUS — FREE 49</b>',
      '',
      '📅 တနင်္ဂနွေနေ့တိုင်း',
      '💰 <b>100 ဘတ်</b> သွင်းပြီးပါက 49 ဘတ်ရမည်။',
      '📌 Bonus ကို <b>1 ဆ</b> ကစားရမည်။',
      '✅ <b>100 ဘတ်အတိ</b> ထုတ်နိုင်ပြီး ကျန်ယူနစ် Auto ဖြတ်မည်။'
    ].join('\n')
  }
};

async function sendMainHome(ctx) {
  const chatId = ctx.chat?.id;
  const name = ctx.from?.first_name || ctx.from?.username || '';
  const caption = welcomeCaption(name);
  const keyboard = mainMenuKeyboard();

  const previousHomeId = messageState?.main?.[String(chatId)];
  const previousQuickActionId =
    messageState?.quickAction?.main?.[String(chatId)];

  const welcomeVideoKey = 'welcome_video';
  const hasWelcomeVideo =
    Boolean(telegramPhotoCache[welcomeVideoKey]) ||
    fs.existsSync(WELCOME_VIDEO_PATH);

  let sentMessage;

  // /start စာကို အရင်မဖျက်တော့ပါ။
  // ဖုန်းမှာ Chat ကနောက်ဘက်ပြန်ထွက်သွားသလို ဖြစ်စေတဲ့အကြောင်းရင်းကို ဖယ်ထားပါတယ်။
  if (hasWelcomeVideo) {
    sentMessage = await telegramRequestWithRetry(() =>
      ctx.replyWithVideo(
        getTelegramVideo(welcomeVideoKey, WELCOME_VIDEO_PATH),
        {
          caption,
          parse_mode: 'HTML',
          ...keyboard
        }
      )
    );

    if (!telegramPhotoCache[welcomeVideoKey]) {
      saveTelegramVideoId(welcomeVideoKey, sentMessage);
    }
  } else {
    sentMessage = await ctx.replyWithHTML(
      `${caption}\n\n<i>⚠️ welcome.mp4 မတွေ့သေးလို့ စာနဲ့ Menu ကိုအရင်ပြထားပါတယ်။</i>`,
      keyboard
    );
  }

  // အသစ်ပေါ်ပြီးမှ အဟောင်းကိုဖျက်မယ်။
  rememberHomeMessage('main', chatId, sentMessage.message_id);
  await showQuickKeyboard(ctx, 'main', mainBot);

  if (previousHomeId && previousHomeId !== sentMessage.message_id) {
    await safeDeleteMessage(mainBot, chatId, previousHomeId);
  }

  if (previousQuickActionId) {
    await safeDeleteMessage(mainBot, chatId, previousQuickActionId);
    delete messageState.quickAction.main[String(chatId)];
    saveMessageState();
  }

  return sentMessage;
}

async function sendPromotionHome(ctx, editExisting = false) {
  const caption = getPromotionHomeCaption();
  const keyboard = promotionDayKeyboard();
  const hasPromotionPhoto =
    Boolean(telegramPhotoCache.promotion) ||
    fs.existsSync(PROMOTION_IMAGE_PATH);

  if (editExisting) {
    if (hasPromotionPhoto) {
      const editedMessage = await telegramRequestWithRetry(() =>
        ctx.editMessageMedia(
          {
            type: 'photo',
            media: getTelegramPhoto('promotion', PROMOTION_IMAGE_PATH),
            caption,
            parse_mode: 'HTML'
          },
          keyboard
        )
      );

      if (!telegramPhotoCache.promotion) {
        saveTelegramPhotoId('promotion', editedMessage);
      }

      return editedMessage;
    }

    return ctx.editMessageCaption(caption, {
      parse_mode: 'HTML',
      ...keyboard
    });
  }

  const chatId = ctx.chat?.id;
  const previousHomeId = messageState?.promotion?.[String(chatId)];
  const previousQuickActionId =
    messageState?.quickAction?.promotion?.[String(chatId)];

  let sentMessage;

  if (hasPromotionPhoto) {
    sentMessage = await telegramRequestWithRetry(() =>
      ctx.replyWithPhoto(
        getTelegramPhoto('promotion', PROMOTION_IMAGE_PATH),
        {
          caption,
          parse_mode: 'HTML',
          ...keyboard
        }
      )
    );

    if (!telegramPhotoCache.promotion) {
      saveTelegramPhotoId('promotion', sentMessage);
    }
  } else {
    sentMessage = await ctx.replyWithHTML(
      `${caption}\n\n<i>⚠️ Promotion ပုံ မသိမ်းရသေးပါရှင့်။</i>`,
      keyboard
    );
  }

  rememberHomeMessage('promotion', chatId, sentMessage.message_id);
  await showQuickKeyboard(ctx, 'promotion', promotionBot);

  if (previousHomeId && previousHomeId !== sentMessage.message_id) {
    await safeDeleteMessage(promotionBot, chatId, previousHomeId);
  }

  if (previousQuickActionId) {
    await safeDeleteMessage(promotionBot, chatId, previousQuickActionId);
    delete messageState.quickAction.promotion[String(chatId)];
    saveMessageState();
  }

  return sentMessage;
}


function getCouponWeekday() {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: COUPON_TIMEZONE
    }).format(new Date());
  } catch (error) {
    console.log('Coupon timezone စစ်မရပါ:', error.message);
    return '';
  }
}

function isCouponAvailableToday() {
  // Customer အတွက် Wednesday တစ်ရက်တည်းသာ ဖွင့်မယ်။
  // .env ထဲက COUPON_TEST_MODE=true ကို မသုံးတော့ပါ။
  return getCouponWeekday() === 'Wednesday';
}

function couponHomeCaption() {
  return [
    '🎟 <b>NGWE99 WEEKLY COUPON</b>',
    '',
    'မိမိဂိမ်းအကောင့် <b>Level</b> အလိုက် Coupon Code လေးတွေကို ရယူနိုင်ပါတယ်ရှင့်။',
    '',
    '👇 <b>COUPON CODE</b> ကိုနှိပ်ပြီး ရယူပါ။'
  ].join('\n');
}

function couponHomeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🎟  COUPON CODE  🎟', 'coupon_open')]
  ]);
}

function couponLevelCaption() {
  return [
    '🎟 <b>COUPON LEVEL</b>',
    '',
    'မိမိဂိမ်းအကောင့် Level အလိုက် အောက်တွင်ရွေးချယ်ပြီး Code ကို ရယူနိုင်ပါသည်ရှင့် 👇'
  ].join('\n');
}

function couponLevelKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🌱 New', 'coupon_level_new'),
      Markup.button.callback('🥈 Silver', 'coupon_level_silver')
    ],
    [
      Markup.button.callback('🥇 Gold', 'coupon_level_gold'),
      Markup.button.callback('💠 Platinum', 'coupon_level_platinum')
    ],
    [
      Markup.button.callback('⚙️ Titanium', 'coupon_level_titanium'),
      Markup.button.callback('💎 Diamond', 'coupon_level_diamond')
    ],
    [Markup.button.callback('👑 VVIP', 'coupon_level_vvip')],
    [
      Markup.button.callback('⬅️ Coupon', 'coupon_home'),
      Markup.button.url('🏠 Main', telegramBotUrl(botUsernames.main))
    ]
  ]);
}

function couponUnavailableCaption() {
  return [
    '⏳ <b>COUPON CODE မရရှိနိုင်သေးပါ</b>',
    '',
    'Coupon Code များကို <b>အပတ်စဉ် ဗုဒ္ဓဟူးနေ့တိုင်း</b> တွင်သာ ရယူနိုင်ပါသည်ရှင့်။',
    '',
    '📅 ဗုဒ္ဓဟူးနေ့တွင် ပြန်လာခဲ့နော် 💙'
  ].join('\n');
}

function couponUnavailableKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄 ပြန်စစ်မယ်', 'coupon_open')],
    [
      Markup.button.callback('⬅️ Coupon', 'coupon_home'),
      Markup.button.url('🏠 Main', telegramBotUrl(botUsernames.main))
    ]
  ]);
}

function couponCodeCaption(levelKey) {
  const level = COUPON_LEVELS[levelKey];
  const code = String(couponCodes[levelKey] || '').trim();

  if (!code) {
    return [
      `🎟 <b>${level.title} COUPON</b>`,
      '',
      '⏳ ဒီ Level အတွက် Coupon Code မထည့်ရသေးပါရှင့်။',
      'ခဏနေရင် ပြန်စစ်ပေးပါနော် 💙'
    ].join('\n');
  }

  return [
    `🎟 <b>${level.title} COUPON CODE</b>`,
    '',
    'ဂိမ်းအကောင့်ထဲရှိ <b>Coupon Code</b> နေရာတွင် ထည့်ပြီး Free Bonus ရယူနိုင်ပါသည်ရှင့်။',
    '',
    '━━━━━━━━━━━━━━━━',
    `<pre>${safeHtml(code)}</pre>`,
    '━━━━━━━━━━━━━━━━',
    '',
    '📋 Code ကိုဖိထားပြီး Copy လုပ်နိုင်ပါတယ်ရှင့်။'
  ].join('\n');
}

function couponCodeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Level ရွေးမယ်', 'coupon_levels')],
    [
      Markup.button.callback('🎟 Coupon Home', 'coupon_home'),
      Markup.button.url('🏠 Main', telegramBotUrl(botUsernames.main))
    ]
  ]);
}

async function editCouponCaption(ctx, caption, keyboard) {
  try {
    return await telegramRequestWithRetry(() =>
      ctx.editMessageCaption(caption, {
        parse_mode: 'HTML',
        ...keyboard
      })
    );
  } catch (error) {
    const description = String(error?.description || error?.message || '');

    if (description.includes('message is not modified')) {
      return null;
    }

    throw error;
  }
}

async function sendCouponHome(ctx, editExisting = false) {
  const caption = couponHomeCaption();
  const keyboard = couponHomeKeyboard();
  const hasCouponPhoto =
    Boolean(telegramPhotoCache.coupon) || fs.existsSync(COUPON_IMAGE_PATH);

  if (editExisting) {
    if (hasCouponPhoto) {
      const editedMessage = await telegramRequestWithRetry(() =>
        ctx.editMessageMedia(
          {
            type: 'photo',
            media: getTelegramPhoto('coupon', COUPON_IMAGE_PATH),
            caption,
            parse_mode: 'HTML'
          },
          keyboard
        )
      );

      if (!telegramPhotoCache.coupon) {
        saveTelegramPhotoId('coupon', editedMessage);
      }

      return editedMessage;
    }

    return editCouponCaption(ctx, caption, keyboard);
  }

  const chatId = ctx.chat?.id;
  const previousHomeId = messageState?.coupon?.[String(chatId)];
  const previousQuickActionId =
    messageState?.quickAction?.coupon?.[String(chatId)];

  let sentMessage;

  if (hasCouponPhoto) {
    sentMessage = await telegramRequestWithRetry(() =>
      ctx.replyWithPhoto(getTelegramPhoto('coupon', COUPON_IMAGE_PATH), {
        caption,
        parse_mode: 'HTML',
        ...keyboard
      })
    );

    if (!telegramPhotoCache.coupon) {
      saveTelegramPhotoId('coupon', sentMessage);
    }
  } else {
    sentMessage = await ctx.replyWithHTML(
      `${caption}\n\n<i>⚠️ Coupon ပုံ မသိမ်းရသေးပါရှင့်။</i>`,
      keyboard
    );
  }

  rememberHomeMessage('coupon', chatId, sentMessage.message_id);
  await showQuickKeyboard(ctx, 'coupon', couponBot);

  if (previousHomeId && previousHomeId !== sentMessage.message_id) {
    await safeDeleteMessage(couponBot, chatId, previousHomeId);
  }

  if (previousQuickActionId) {
    await safeDeleteMessage(couponBot, chatId, previousQuickActionId);
    delete messageState.quickAction.coupon[String(chatId)];
    saveMessageState();
  }

  return sentMessage;
}


function normalizeCouponLevel(value = '') {
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'vip') return 'vvip';
  return normalized;
}

async function removeSensitiveCommand(ctx) {
  const chatId = ctx.chat?.id;
  const messageId = ctx.message?.message_id;
  if (!chatId || !messageId) return;
  await safeDeleteMessage(ctx.telegram, chatId, messageId);
}

async function handleSetCouponCode(ctx) {
  const parts = String(ctx.message?.text || '').trim().split(/\s+/);
  const password = parts[1] || '';
  const levelKey = normalizeCouponLevel(parts[2]);
  const code = parts.slice(3).join(' ').trim();

  await removeSensitiveCommand(ctx);

  if (!COUPON_SETUP_PASSWORD || password !== COUPON_SETUP_PASSWORD) {
    await ctx.reply('❌ Coupon ပြင်ရန် Password မမှန်ပါရှင့်။');
    return;
  }

  if (!COUPON_LEVELS[levelKey]) {
    await ctx.reply(
      '❌ Level မမှန်ပါ။ new / silver / gold / platinum / titanium / diamond / vvip ထဲမှ ရွေးပါရှင့်။'
    );
    return;
  }

  if (!code) {
    await ctx.reply(
      `❌ Code မပါသေးပါ။\nဥပမာ — /setcode PASSWORD ${levelKey} ABC123`
    );
    return;
  }

  couponCodes[levelKey] = code;
  saveCouponCodes();

  await ctx.reply(
    `✅ ${COUPON_LEVELS[levelKey].title} Coupon Code ကို ${code} ဖြင့် ပြောင်းပြီးပါပြီ။`
  );
}

async function handleClearCouponCode(ctx) {
  const parts = String(ctx.message?.text || '').trim().split(/\s+/);
  const password = parts[1] || '';
  const levelKey = normalizeCouponLevel(parts[2]);

  await removeSensitiveCommand(ctx);

  if (!COUPON_SETUP_PASSWORD || password !== COUPON_SETUP_PASSWORD) {
    await ctx.reply('❌ Coupon ပြင်ရန် Password မမှန်ပါရှင့်။');
    return;
  }

  if (!COUPON_LEVELS[levelKey]) {
    await ctx.reply('❌ Level မမှန်ပါရှင့်။');
    return;
  }

  couponCodes[levelKey] = '';
  saveCouponCodes();

  await ctx.reply(`✅ ${COUPON_LEVELS[levelKey].title} Coupon Code ကိုရှင်းပြီးပါပြီ။`);
}

async function handleCouponCodeList(ctx) {
  const parts = String(ctx.message?.text || '').trim().split(/\s+/);
  const password = parts[1] || '';

  await removeSensitiveCommand(ctx);

  if (!COUPON_SETUP_PASSWORD || password !== COUPON_SETUP_PASSWORD) {
    await ctx.reply('❌ Coupon ကြည့်ရန် Password မမှန်ပါရှင့်။');
    return;
  }

  const lines = Object.entries(COUPON_LEVELS).map(([key, level]) => {
    return `${level.button}: ${couponCodes[key] || 'မထည့်ရသေး'}`;
  });

  await ctx.reply(['🎟 လက်ရှိ Coupon Codes', '', ...lines].join('\n'));
}

mainBot.start(sendMainHome);
mainBot.command('menu', sendMainHome);


function registerPhotoSetupHandler(bot) {
  bot.on('photo', async (ctx) => {
    const caption = String(ctx.message.caption || '').trim();
    const parts = caption.split(/\s+/);

    const command = String(parts[0] || '')
      .split('@')[0]
      .toLowerCase();

    if (command !== '/setphoto') return;

    const providedPassword = parts[1];
    const photoKey = String(parts[2] || '').toLowerCase();

    if (
      !PHOTO_SETUP_PASSWORD ||
      providedPassword !== PHOTO_SETUP_PASSWORD
    ) {
      await ctx.reply('❌ ပုံသိမ်းရန် Password မမှန်ပါရှင့်။');
      return;
    }

    if (!ALLOWED_PHOTO_KEYS.includes(photoKey)) {
      await ctx.reply(
        [
          '❌ ပုံအမည်မမှန်ပါရှင့်။',
          '',
          'အသုံးပြုနိုင်သော အမည်များမှာ—',
          '',
          ALLOWED_PHOTO_KEYS.join(', ')
        ].join('\n')
      );
      return;
    }

    saveTelegramPhotoId(photoKey, ctx.message);

    await ctx.reply(
      [
        `✅ ${photoKey} ပုံကို Telegram မှာ သိမ်းပြီးပါပြီ။`,
        '',
        '⚡ အခုကစပြီး Bot က ဒီပုံကို အမြန်ပြန်သုံးပေးပါမယ်ရှင့်။'
      ].join('\n')
    );
  });
}

mainBot.on('video', async (ctx) => {
  const caption = String(ctx.message?.caption || '').trim();
  const parts = caption.split(/\s+/);
  const command = String(parts[0] || '').split('@')[0].toLowerCase();

  if (command !== '/setvideo') return;

  const providedPassword = parts[1] || '';
  const videoKey = String(parts[2] || '').toLowerCase();

  if (
    !PHOTO_SETUP_PASSWORD ||
    providedPassword !== PHOTO_SETUP_PASSWORD
  ) {
    await ctx.reply('❌ Video သိမ်းရန် Password မမှန်ပါရှင့်။');
    return;
  }

  if (videoKey !== 'welcome') {
    await ctx.reply('❌ Video အမည်ကို welcome လို့ရေးပါရှင့်။');
    return;
  }

  saveTelegramVideoId('welcome_video', ctx.message);
  await ctx.reply(
    '✅ Welcome Video ကို Telegram Cache မှာသိမ်းပြီးပါပြီ။ အခု /start နှိပ်တိုင်း ပိုမြန်ပါမယ်ရှင့်။'
  );
});

registerPhotoSetupHandler(promotionBot);
registerPhotoSetupHandler(couponBot);

promotionBot.start(async (ctx) => {
  await sendPromotionHome(ctx, false);
});

promotionBot.command('menu', async (ctx) => {
  await sendPromotionHome(ctx, false);
});

promotionBot.action(Object.keys(promotionDayNames), async (ctx) => {
  const selectedDay = ctx.callbackQuery?.data;
  const detail = PROMOTION_DAY_DETAILS[selectedDay];

  await ctx.answerCbQuery();

  if (!detail) return;

  const imageKey = selectedDay.replace('promo_', '');
  const hasDayPhoto =
    Boolean(telegramPhotoCache[imageKey]) || fs.existsSync(detail.image);

  try {
    if (hasDayPhoto) {
      const editedMessage = await telegramRequestWithRetry(() =>
        ctx.editMessageMedia(
          {
            type: 'photo',
            media: getTelegramPhoto(imageKey, detail.image),
            caption: detail.caption,
            parse_mode: 'HTML'
          },
          promotionDetailKeyboard()
        )
      );

      if (!telegramPhotoCache[imageKey]) {
        saveTelegramPhotoId(imageKey, editedMessage);
      }

      return;
    }

    await ctx.editMessageCaption(detail.caption, {
      parse_mode: 'HTML',
      ...promotionDetailKeyboard()
    });
  } catch (error) {
    console.error(`${promotionDayNames[selectedDay]} ဖွင့်မရပါ:`, error);
    await ctx.answerCbQuery('ခဏနေရင် ပြန်နှိပ်ပေးပါရှင့်။', {
      show_alert: true
    }).catch(() => {});
  }
});

promotionBot.action('promotion_home', async (ctx) => {
  await ctx.answerCbQuery();

  try {
    await sendPromotionHome(ctx, true);
  } catch (error) {
    console.error('Promotion Home ပြန်ဖွင့်မရပါ:', error);
    await ctx.answerCbQuery('ခဏနေရင် ပြန်နှိပ်ပေးပါရှင့်။', {
      show_alert: true
    }).catch(() => {});
  }
});

// အောက်ဘက် Reply Keyboard Button များ
// Reply Keyboard Button က URL ကိုတိုက်ရိုက်မဖွင့်နိုင်လို့
// နှိပ်တာနဲ့ Link Button တစ်ခု ချက်ချင်းပြပေးမယ်။

function registerQuickLinkHandler(bot, botKey, label, title, buttonText, urlGetter) {
  bot.hears(label, async (ctx) => {
    const url = typeof urlGetter === 'function' ? urlGetter() : urlGetter;

    await sendQuickLink(
      ctx,
      botKey,
      bot,
      title,
      buttonText,
      url
    );
  });
}

// Main Bot Keyboard: Channel / Daily / Events / Coupon
registerQuickLinkHandler(
  mainBot,
  'main',
  '📢 Channel',
  '📢 <b>Ngwe99 Channel</b>',
  '📢 Channel သို့သွားမည်',
  CHANNEL_URL
);

registerQuickLinkHandler(
  mainBot,
  'main',
  '🎁 Daily Bonus',
  '🎁 <b>Ngwe99 Daily Bonus</b>',
  '🎁 Daily Bonus Bot သို့သွားမည်',
  () => telegramBotUrl(botUsernames.promotion)
);

registerQuickLinkHandler(
  mainBot,
  'main',
  '🎉 Events',
  '🎉 <b>Ngwe99 Events</b>',
  '🎉 Events သို့သွားမည်',
  EVENTS_CHANNEL_URL
);

registerQuickLinkHandler(
  mainBot,
  'main',
  '🎟 Coupon',
  '🎟 <b>Ngwe99 Coupon Code</b>',
  '🎟 Coupon Bot သို့သွားမည်',
  () => telegramBotUrl(botUsernames.coupon)
);

// Daily Bonus Bot Keyboard: Channel / Coupon / Events
registerQuickLinkHandler(
  promotionBot,
  'promotion',
  '📢 Channel',
  '📢 <b>Ngwe99 Channel</b>',
  '📢 Channel သို့သွားမည်',
  CHANNEL_URL
);

registerQuickLinkHandler(
  promotionBot,
  'promotion',
  '🎟 Coupon',
  '🎟 <b>Ngwe99 Coupon Code</b>',
  '🎟 Coupon Bot သို့သွားမည်',
  () => telegramBotUrl(botUsernames.coupon)
);

registerQuickLinkHandler(
  promotionBot,
  'promotion',
  '🎉 Events',
  '🎉 <b>Ngwe99 Events</b>',
  '🎉 Events သို့သွားမည်',
  EVENTS_CHANNEL_URL
);

// Coupon Bot Keyboard: Channel / Daily / Events
registerQuickLinkHandler(
  couponBot,
  'coupon',
  '📢 Channel',
  '📢 <b>Ngwe99 Channel</b>',
  '📢 Channel သို့သွားမည်',
  CHANNEL_URL
);

registerQuickLinkHandler(
  couponBot,
  'coupon',
  '🎁 Daily Bonus',
  '🎁 <b>Ngwe99 Daily Bonus</b>',
  '🎁 Daily Bonus Bot သို့သွားမည်',
  () => telegramBotUrl(botUsernames.promotion)
);

registerQuickLinkHandler(
  couponBot,
  'coupon',
  '🎉 Events',
  '🎉 <b>Ngwe99 Events</b>',
  '🎉 Events သို့သွားမည်',
  EVENTS_CHANNEL_URL
);

couponBot.start(async (ctx) => {
  await sendCouponHome(ctx, false);
});

couponBot.command('menu', async (ctx) => {
  await sendCouponHome(ctx, false);
});

couponBot.command('setcode', handleSetCouponCode);
couponBot.command('clearcode', handleClearCouponCode);
couponBot.command('codes', handleCouponCodeList);

couponBot.action('coupon_open', async (ctx) => {
  await ctx.answerCbQuery();

  if (!isCouponAvailableToday()) {
    await editCouponCaption(
      ctx,
      couponUnavailableCaption(),
      couponUnavailableKeyboard()
    );
    return;
  }

  await editCouponCaption(ctx, couponLevelCaption(), couponLevelKeyboard());
});

couponBot.action('coupon_levels', async (ctx) => {
  await ctx.answerCbQuery();

  if (!isCouponAvailableToday()) {
    await editCouponCaption(
      ctx,
      couponUnavailableCaption(),
      couponUnavailableKeyboard()
    );
    return;
  }

  await editCouponCaption(ctx, couponLevelCaption(), couponLevelKeyboard());
});

couponBot.action('coupon_home', async (ctx) => {
  await ctx.answerCbQuery();
  await sendCouponHome(ctx, true);
});

couponBot.action(
  Object.keys(COUPON_LEVELS).map((levelKey) => `coupon_level_${levelKey}`),
  async (ctx) => {
    await ctx.answerCbQuery();

    if (!isCouponAvailableToday()) {
      await editCouponCaption(
        ctx,
        couponUnavailableCaption(),
        couponUnavailableKeyboard()
      );
      return;
    }

    const levelKey = String(ctx.callbackQuery?.data || '').replace(
      'coupon_level_',
      ''
    );

    if (!COUPON_LEVELS[levelKey]) return;

    await editCouponCaption(
      ctx,
      couponCodeCaption(levelKey),
      couponCodeKeyboard()
    );
  }
);

const bots = [
  ['Main Menu Bot', mainBot],
  ['Promotion Bot', promotionBot],
  ['Coupon Bot', couponBot]
];

for (const [name, bot] of bots) {
  bot.catch((error, ctx) => {
    console.error(
      `${name} update ${ctx.update?.update_id || '-'} error:`,
      error
    );
  });
}

async function setBotCommands() {
  await Promise.all([
    mainBot.telegram.setMyCommands([
      { command: 'start', description: 'Main Menu Bot ကိုစတင်ရန်' },
      { command: 'menu', description: 'ပင်မ Menu ကိုဖွင့်ရန်' }
    ]),
    promotionBot.telegram.setMyCommands([
      { command: 'start', description: 'နေ့စဉ် Promotion များကြည့်ရန်' },
      { command: 'menu', description: 'Promotion Menu ကိုဖွင့်ရန်' }
    ]),
    couponBot.telegram.setMyCommands([
      { command: 'start', description: 'Coupon များကြည့်ရန်' },
      { command: 'menu', description: 'Coupon Menu ကိုဖွင့်ရန်' }
    ])
  ]);
}

async function loadBotUsernames() {
  const [mainInfo, promotionInfo, couponInfo] = await Promise.all([
    mainBot.telegram.getMe(),
    promotionBot.telegram.getMe(),
    couponBot.telegram.getMe()
  ]);

  botUsernames = {
    main: mainInfo.username,
    promotion: promotionInfo.username,
    coupon: couponInfo.username
  };
}

async function launch() {
  if (!fs.existsSync(COUPON_CODES_PATH)) {
    saveCouponCodes();
  }

  // v9 က Auto Reset အတွက် သိမ်းထားခဲ့သော state အဟောင်းကို ရှင်းမယ်။
  // v10 မှာ အချိန်ပြည့် Auto Reset လုံးဝမရှိတော့ပါ။
  if (messageState.lastActivity) {
    delete messageState.lastActivity;
    saveMessageState();
  }

  await loadBotUsernames();
  await setBotCommands();

  await Promise.all([
    mainBot.launch({ dropPendingUpdates: true }),
    promotionBot.launch({ dropPendingUpdates: true }),
    couponBot.launch({ dropPendingUpdates: true })
  ]);

  console.log('----------------------------------------------');
  console.log(`Main Menu Bot : @${botUsernames.main}`);
  console.log(`Promotion Bot : @${botUsernames.promotion}`);
  console.log(`Main Channel  : ${CHANNEL_URL}`);
  console.log(`Events Channel: ${EVENTS_CHANNEL_URL}`);
  console.log(`Coupon Bot    : @${botUsernames.coupon}`);
  console.log(`Coupon Day    : ${getCouponWeekday()} (${COUPON_TIMEZONE})`);
  console.log('Auto Reset    : OFF');
  console.log('Main Game Link: ON');
  console.log(`Data Folder   : ${DATA_DIR}`);
  console.log('Bot ၃ ခုနဲ့ Channel Link များ အလုပ်လုပ်နေပါပြီ...');
  console.log('----------------------------------------------');
}

launch().catch((error) => {
  console.error('Bots launch failed:', error);
  process.exit(1);
});

function stopAll(signal) {
  for (const [, bot] of bots) {
    bot.stop(signal);
  }
}

process.once('SIGINT', () => stopAll('SIGINT'));
process.once('SIGTERM', () => stopAll('SIGTERM'));
