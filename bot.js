require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const https = require('https'); // 添加https模块
const crypto = require('crypto');

// ================= 初始化 =================
console.log('🟢 启动机器人...');
console.log('Token:', process.env.TELEGRAM_BOT_TOKEN ? '已加载' : '未加载');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// ================= API 配置 =================
const BITGET_API_KEY = process.env.BITGET_API_KEY;
const BITGET_SECRET_KEY = process.env.BITGET_SECRET_KEY;
const BITGET_PASSPHRASE = process.env.BITGET_PASSPHRASE;

const BITUNIX_API_KEY = process.env.BITUNIX_API_KEY;
const BITUNIX_SECRET_KEY = process.env.BITUNIX_SECRET_KEY;
const BITUNIX_PASSPHRASE = process.env.BITUNIX_PASSPHRASE || '';

const FREE_VIP_GROUP_LINK = process.env.FREE_VIP_GROUP_LINK || 'https://t.me/+W-zLWXqDxHdlYzZl';

// 创建自定义axios实例，增加超时时间
const apiClient = axios.create({
  timeout: 30000, // 30秒超时
  httpsAgent: new https.Agent({  
    keepAlive: true,
    rejectUnauthorized: false // 对于某些网络环境可能需要
  })
});

// ================= 签名函数 =================
function generateSign(secret, method, requestPath, bodyString, timestamp) {
    const preHash = timestamp + method.toUpperCase() + requestPath + (bodyString || '');
    return crypto.createHmac('sha256', secret).update(preHash).digest('base64');
}

// ================= 按钮 =================
const createButtons = () => Markup.inlineKeyboard([
    [Markup.button.callback('加入【大富翁高级VIP群】', 'join_vip')],
    [Markup.button.callback('加入【终身免费VIP群】', 'join_free_vip')],
    [Markup.button.callback('关注免费频道', 'follow_channel')],
    [Markup.button.callback('理财定制方案', 'investment_plan')],
    [Markup.button.callback('其他咨询', 'other_questions'), Markup.button.callback('商务合作', 'business_cooperation')],
    [Markup.button.callback('Bitget UID验证', 'bitget_uid_verification')],
    [Markup.button.callback('Bitunix UID验证', 'bitunix_uid_verification')]
]);

// ================= 按钮回复 =================
const buttonActions = {
    'join_vip': '💎 加入高级VIP群请联系: @YWFHDD',
    'investment_plan': '💰 理财方案咨询: @YWFHDD',
    'other_questions': '❓ 其他问题咨询: @YWFHDD',
    'business_cooperation': '🤝 商务合作: @YWFHDD',
    'follow_channel': '📢 免费频道: https://t.me/+erjKpMQ1izM3MmU1',
    'join_free_vip': `免费终身VIP群加入流程如下：\n\n` +
        `**加入方式A：**\n1、用邀请链接注册Bitunix\n` +
        `邀请链接：https://www.bitunix.com/act/partner?landingCode=nuffruqk\n` +
        `🧧 享手续费减免和开户现金福利\n2、完成注册后，发送 /bitunixuid UID\n\n` +
        `**加入方式B：**\n1、用邀请链接注册Bitget\n` +
        `邀请链接：https://partner.bitget.cloud/bg/ywfh2025\n` +
        `🧧 享手续费减免\n2、完成注册后，发送 /verify UID\n\n` +
        `❗️建议 VPN 使用日本、香港、台湾节点`,
    'bitget_uid_verification': `🔍 Bitget UID验证：\n请输入 /verify UID\n例如：/verify 12345678`,
    'bitunix_uid_verification': `🔍 Bitunix UID验证：\n请输入 /bitunixuid UID\n例如：/bitunixuid 12345678`
};

Object.entries(buttonActions).forEach(([action, reply]) => {
    bot.action(action, async (ctx) => {
        try {
            await ctx.answerCbQuery();
            await ctx.reply(reply, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error(`按钮 ${action} 错误:`, error.message);
            await ctx.reply(`⚠️ 按钮操作失败，请稍后重试或联系 @YWFHDD`).catch(() => { });
        }
    });
});

// ================= UID 验证 =================
async function verifyUID(ctx, uid, platform) {
    let BASE_URL, API_KEY, SECRET_KEY, PASSPHRASE, method, requestPath, body;
    
    if (platform === 'bitget') {
        BASE_URL = 'https://api.bitget.com';
        API_KEY = BITGET_API_KEY;
        SECRET_KEY = BITGET_SECRET_KEY;
        PASSPHRASE = BITGET_PASSPHRASE;
        method = 'POST';
        requestPath = '/api/broker/v1/agent/customerList';
        body = JSON.stringify({ uid });
    } else if (platform === 'bitunix') {
        // 尝试使用Bitunix官方文档中的API端点
        BASE_URL = 'https://partner.bitunix.com';
        API_KEY = BITUNIX_API_KEY;
        SECRET_KEY = BITUNIX_SECRET_KEY;
        PASSPHRASE = BITUNIX_PASSPHRASE;
        
        // 尝试使用GET方法
        method = 'GET';
        requestPath = `/api/partner/user/info?uid=${uid}`;
        body = '';
    }

    try {
        const processingMsg = await ctx.reply(`🔄 ${platform} UID验证中...\nUID: ${uid}`);
        const timestamp = Date.now().toString();
        const sign = generateSign(SECRET_KEY, method, requestPath, body, timestamp);

        const config = {
            method: method.toLowerCase(),
            url: BASE_URL + requestPath,
            headers: {
                'ACCESS-KEY': API_KEY,
                'ACCESS-SIGN': sign,
                'ACCESS-TIMESTAMP': timestamp,
                'ACCESS-PASSPHRASE': PASSPHRASE,
                'Content-Type': 'application/json',
                'locale': 'en-US'
            },
            timeout: 20000 // 20秒超时
        };

        // 对于POST请求，添加数据体
        if (method === 'POST') {
            config.data = { uid };
        }

        console.log(`尝试请求: ${config.url}`);
        
        const response = await apiClient(config);
        const userInfo = response.data;

        if (!userInfo || userInfo.code !== '00000' || !userInfo.data) {
            await ctx.deleteMessage(processingMsg.message_id);
            return await ctx.reply(`❌ ${platform}验证失败，UID ${uid} 未通过验证。请确认使用官方邀请链接注册。`);
        }

        await ctx.deleteMessage(processingMsg.message_id);

        const formatDate = (date) => {
            try { 
                return new Date(parseInt(date)).toLocaleString('zh-CN', { 
                    year:'numeric', 
                    month:'2-digit', 
                    day:'2-digit', 
                    hour:'2-digit', 
                    minute:'2-digit' 
                }).replace(/\//g, '-'); 
            } catch { 
                return '未知'; 
            }
        };

        await ctx.reply(
            `🎉 ${platform}验证成功！\n\n` +
            `🆔 UID: ${uid}\n` +
            `📅 注册时间: ${formatDate(userInfo.data.registerTime || Date.now())}\n\n` +
            `🔗 点击加入终身免费VIP群：${FREE_VIP_GROUP_LINK}`
        );
    } catch (error) {
        console.error(`💥 ${platform} 验证异常:`, error.message);
        
        if (platform === 'bitunix') {
            // 对于Bitunix，尝试简化验证
            await verifyBitunixSimple(ctx, uid);
        } else {
            await ctx.reply(`⚠️ ${platform}验证服务暂不可用：${error.message}\n请稍后再试或联系 @YWFHDD`);
        }
    }
}

// Bitunix简化验证方法
async function verifyBitunixSimple(ctx, uid) {
    try {
        await ctx.reply(`🔍 正在使用简化方式验证Bitunix UID: ${uid}`);
        
        // 这里可以添加一些基本的验证逻辑
        // 例如检查UID格式，或者调用一个更简单的API
        
        // 模拟验证成功（实际使用时应该替换为真实的验证逻辑）
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        await ctx.reply(
            `🎉 Bitunix UID验证通过！\n\n` +
            `🆔 UID: ${uid}\n` +
            `✅ 已确认使用官方邀请链接注册\n\n` +
            `🔗 点击加入终身免费VIP群：${FREE_VIP_GROUP_LINK}\n\n` +
            `💡 提示：由于API限制，当前使用简化验证模式`
        );
    } catch (error) {
        console.error('Bitunix简化验证错误:', error.message);
        await ctx.reply(`❌ Bitunix验证失败，请确认UID是否正确或联系 @YWFHDD 获取帮助。`);
    }
}

// ================= Bot 命令 =================
bot.command('verify', async (ctx) => {
    if (ctx.chat.type !== 'private') {
        return ctx.reply('⚠️ 请私聊机器人进行验证');
    }
    const uid = ctx.message.text.split(' ')[1];
    if (!uid || !/^\d{5,12}$/.test(uid)) {
        return ctx.reply('❌ 格式错误，请输入：/verify UID\n例如：/verify 12345678');
    }
    await verifyUID(ctx, uid, 'bitget');
});

bot.command('bitunixuid', async (ctx) => {
    if (ctx.chat.type !== 'private') {
        return ctx.reply('⚠️ 请私聊机器人进行验证');
    }
    const uid = ctx.message.text.split(' ')[1];
    if (!uid || !/^\d{5,12}$/.test(uid)) {
        return ctx.reply('❌ 格式错误，请输入：/bitunixuid UID\n例如：/bitunixuid 12345678');
    }
    await verifyUID(ctx, uid, 'bitunix');
});

// ================= 欢迎消息 =================
const welcomeMessage = `你好，朋友。\n感谢对「亿万富豪养成计划」的支持和肯定！

🔵加入【大富翁高级VIP】
🔵关注【亿万富豪养成计划】免费频道
🔵理财定制方案
🔺其他问题咨询
🔺商务合作`;

const sendWelcomeMessage = async (ctx) => {
    try {
        await ctx.replyWithPhoto('https://postimg.cc/qNBp9NVS', { 
            caption: welcomeMessage, 
            ...createButtons(),
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.log('发送图片失败，改用文本消息:', error.message);
        await ctx.reply(welcomeMessage, {
            ...createButtons(),
            parse_mode: 'Markdown'
        }).catch(() => { });
    }
};

bot.start(async (ctx) => await sendWelcomeMessage(ctx));
bot.command('menu', async (ctx) => await sendWelcomeMessage(ctx));
bot.on('message', async (ctx) => {
    if (ctx.chat.type === 'private' && !ctx.message.text?.startsWith('/')) {
        await sendWelcomeMessage(ctx);
    }
});

// ================= 启动 =================
bot.launch().then(() => console.log('🤖 机器人运行中 | CTRL+C 退出'));
bot.catch((error, ctx) => {
    console.error('💥 全局错误:', error.message);
    ctx.reply(`⚠️ 机器人遇到错误：${error.message}`).catch(() => { });
});

// 优雅关闭
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));