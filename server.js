const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const app = express();

const BOT_TOKEN = '8352309229:AAHkONqYX2oaYQavJ7_aICjGmpACcivzjZE';
const CHANNEL_ID = '-1003353071744';
const bot = new TelegramBot(BOT_TOKEN);

const users = new Map();
const jobs = new Map();
const packages = {
    free: { jobsPerDay: 2, price: 0 },
    pro: { jobsPerDay: 6, price: 599 },
    premium: { jobsPerDay: 999, price: 999 }
};

class AIAgent {
    async process(userId, message) {
        const user = users.get(userId);
        if (message.includes('job') || message.includes('কাজ')) {
            return `Available jobs: ${Array.from(jobs.values()).filter(j => j.status === 'active').length}`;
        }
        if (message.includes('balance') || message.includes('ব্যালেন্স')) {
            return `Balance: ${user?.balance || 0}/-`;
        }
        if (message.includes('package') || message.includes('প্যাকেজ')) {
            return 'Packages: Free (2 jobs/day) | Pro (6 jobs/day - 599/-) | Premium (unlimited - 999/-)';
        }
        return 'Support: @simply_support';
    }
}

const ai = new AIAgent();
app.use(express.json());
app.use(express.static('public'));

app.post('/api/auth', (req, res) => {
    const { initData } = req.body;
    const urlParams = new URLSearchParams(initData);
    const user = {
        id: urlParams.get('id'),
        username: urlParams.get('username'),
        firstName: urlParams.get('first_name')
    };

    if (!users.has(user.id)) {
        users.set(user.id, {
            id: user.id,
            username: user.username,
            balance: 0,
            totalEarned: 0,
            package: 'free',
            jobsToday: 0
        });
        bot.sendMessage(CHANNEL_ID, `🆕 New user: @${user.username}`);
    }
    res.json(users.get(user.id));
});

app.get('/api/jobs', (req, res) => {
    res.json(Array.from(jobs.values()).filter(j => j.status === 'active'));
});

app.post('/api/job/complete', (req, res) => {
    const { userId, jobId } = req.body;
    const user = users.get(userId);
    const job = jobs.get(jobId);
    
    if (!user || !job) return res.status(400).json({ error: 'Invalid' });
    if (user.package === 'free' && user.jobsToday >= 2) return res.json({ error: 'Daily limit reached' });
    if (user.package === 'pro' && user.jobsToday >= 6) return res.json({ error: 'Daily limit reached' });
    
    user.balance += job.price;
    user.totalEarned += job.price;
    user.jobsToday += 1;
    job.status = 'completed';
    
    bot.sendMessage(CHANNEL_ID, `✅ ${user.username} earned ${job.price}/-`);
    res.json({ success: true, earnings: job.price, balance: user.balance });
});

app.post('/api/withdraw', (req, res) => {
    const { userId } = req.body;
    const user = users.get(userId);
    if (user.balance < 100) return res.json({ error: 'Minimum 100/- required' });
    
    const amount = user.balance;
    user.balance = 0;
    bot.sendMessage(CHANNEL_ID, `🔄 Withdrawal: ${user.username} - ${amount}/-`);
    res.json({ success: true, amount });
});

app.post('/api/ai/chat', async (req, res) => {
    const { userId, message } = req.body;
    const response = await ai.process(userId, message);
    res.json({ response });
});

bot.onText(/\/addjob (.+)/, (msg, match) => {
    const jobData = JSON.parse(match[1]);
    const jobId = Date.now().toString();
    jobs.set(jobId, { id: jobId, ...jobData, status: 'active' });
    bot.sendMessage(msg.from.id, `✅ Job added: ${jobData.title}`);
});

bot.onText(/\/payment (.+)/, (msg, match) => {
    const [userId, amount] = match[1].split(' ');
    const user = users.get(userId);
    if (user) {
        user.balance += parseInt(amount);
        bot.sendMessage(userId, `💰 ${amount}/- added!`);
    }
});

jobs.set('1', { id: '1', title: 'YouTube Video Watch', description: 'Watch 5min video', price: 5, type: 'video', status: 'active' });
jobs.set('2', { id: '2', title: 'Facebook Like & Share', description: 'Like and share post', price: 3, type: 'social', status: 'active' });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    bot.startPolling();
});
