const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_PATH = path.join(__dirname, 'data', 'database.json');

function readDB() { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
function writeDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

function writeLog(username, action) {
    const db = readDB();
    db.logs.unshift({ username, action, time: new Date().toLocaleString('vi-VN') });
    writeDB(db);
}

// 🔐 API Auth
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username === username && u.password === password);
    if (user) return res.json({ success: true, user });
    return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu!" });
});

// 👑 API Super Admin: Tạo User (Phân quyền rõ ràng: lanhdao hoặc canbo)
app.post('/api/superadmin/users', (req, res) => {
    const { adminUser, username, password, name, department, role } = req.body;
    const db = readDB();
    if (!db.users.some(u => u.username === adminUser && u.role === 'superadmin')) return res.status(403).json({ success: false });
    if (db.users.some(u => u.username === username)) return res.json({ success: false, message: "Tài khoản đã tồn tại!" });

    db.users.push({ username, password, role, name, department });
    writeDB(db);
    writeLog(adminUser, `Đã cấp tài khoản cấp [${role.toUpperCase()}] cho: ${name} (${department})`);
    res.json({ success: true });
});

app.get('/api/superadmin/monitoring', (req, res) => {
    const { adminUser } = req.query;
    const db = readDB();
    if (!db.users.some(u => u.username === adminUser && u.role === 'superadmin')) return res.status(403).json({ success: false });
    res.json({ users: db.users, logs: db.logs });
});

// 📰 API Tin Tức (Xử lý chữ chạy + Xóa bài đăng theo cấp bậc)
app.get('/api/news', (req, res) => res.json(readDB().news || []));
app.post('/api/admin/news', (req, res) => {
    const { username, tag, title, content, important } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username === username);
    if (!user || (user.role !== 'superadmin' && user.role !== 'lanhdao')) return res.status(403).json({ success: false });

    db.news.unshift({ id: 'NEWS-' + Date.now(), tag, title, content, important: !!important, time: new Date().toLocaleString('vi-VN') });
    writeDB(db);
    writeLog(username, `Đã phát hành bản tin${important ? ' QUAN TRỌNG' : ''}: ${title}`);
    res.json({ success: true });
});

app.post('/api/admin/news/delete', (req, res) => {
    const { username, newsId } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username === username);
    if (!user || (user.role !== 'superadmin' && user.role !== 'lanhdao')) {
        return res.status(403).json({ success: false, message: "Bạn không có quyền xóa bài đăng!" });
    }
    db.news = db.news.filter(n => n.id !== newsId);
    writeDB(db);
    writeLog(username, `Đã xóa bài đăng thông báo mã số: ${newsId}`);
    res.json({ success: true });
});

// 🚨 API Roleplay: Cảnh báo an ninh & Truy nã
app.get('/api/system/config', (req, res) => res.json(readDB().system_config || { "security_level": "BÌNH THƯỜNG" }));
app.post('/api/admin/system/alert', (req, res) => {
    const { username, level } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username === username);
    if (!user || (user.role !== 'superadmin' && user.role !== 'lanhdao')) return res.status(403).json({ success: false });
    
    db.system_config = { security_level: level };
    writeDB(db);
    writeLog(username, `THAY ĐỔI TRẠNG THÁI AN NINH THÀNH PHỐ THÀNH: ${level}`);
    res.json({ success: true });
});

app.get('/api/warrants', (req, res) => res.json(readDB().warrants || []));
app.post('/api/admin/warrants', (req, res) => {
    const { username, name, crime, bounty } = req.body;
    const db = readDB();
    db.warrants.unshift({ id: 'W-' + Math.floor(100 + Math.random() * 900), name, crime, bounty, time: new Date().toLocaleDateString('vi-VN') });
    writeDB(db);
    writeLog(username, `Đã phát lệnh TRUY NÃ đối tượng: ${name}`);
    res.json({ success: true });
});
app.post('/api/admin/warrants/delete', (req, res) => {
    const { username, id } = req.body;
    const db = readDB();
    db.warrants = db.warrants.filter(w => w.id !== id);
    writeDB(db);
    writeLog(username, `Đã gỡ lệnh truy nã mã số: ${id}`);
    res.json({ success: true });
});

// 📊 API Thống kê & Công dân cũ giữ nguyên
app.get('/api/admin/stats', (req, res) => {
    const db = readDB();
    const citizens = Object.values(db.citizens);
    const totalCash = citizens.reduce((sum, c) => sum + (Number(c.bank_balance) || 0), 0);
    const naxin = citizens.filter(c => c.trangthai === "Đang bị truy nã").length;
    const hop_phap = citizens.filter(c => c.trangthai === "Hợp pháp").length;
    res.json({
        totalCitizens: citizens.length, totalCash,
        pendingDocs: db.hoso.filter(h => h.status === "Chờ duyệt").length,
        approvedDocs: db.hoso.filter(h => h.status === "Đã Phê Duyệt").length,
        chartData: { lawStatus: [hop_phap, naxin], docsStatus: [db.hoso.filter(h => h.status === "Chờ duyệt").length, db.hoso.filter(h => h.status === "Đã Phê Duyệt").length] }
    });
});
app.get('/api/citizens', (req, res) => {
    const db = readDB();
    const { search } = req.query;
    if (search) return res.json(db.citizens[search] ? { [search]: db.citizens[search] } : {});
    res.json(db.citizens);
});
app.post('/api/admin/citizens', (req, res) => {
    const { username, name, cccd, chucvu, trangthai, police_record, military_status, bank_account, bank_balance } = req.body;
    const db = readDB();
    db.citizens[name] = { cccd, chucvu, trangthai, police_record, military_status, bank_account, bank_balance: Number(bank_balance) };
    writeDB(db);
    writeLog(username, `Đã cập nhật hồ sơ định danh gốc của: ${name}`);
    res.json({ success: true });
});
app.get('/api/hoso', (req, res) => res.json(readDB().hoso));
app.post('/api/hoso', (req, res) => {
    const { name, type, content } = req.body;
    const db = readDB();
    const newDoc = { id: 'HS-' + Math.floor(1000 + Math.random() * 9000), name, type, content, status: "Chờ duyệt", time: new Date().toLocaleString('vi-VN'), feedbacks: [] };
    db.hoso.unshift(newDoc); writeDB(db);
    res.json({ success: true, data: newDoc });
});
app.post('/api/admin/hoso/approve', (req, res) => {
    const { username, id, status } = req.body;
    const db = readDB();
    const doc = db.hoso.find(h => h.id === id);
    if (doc) { doc.status = status; writeDB(db); writeLog(username, `Thẩm định hồ sơ ${id} thành: ${status}`); return res.json({ success: true }); }
    res.status(404).json({ success: false });
});
app.post('/api/hoso/feedback', (req, res) => {
    const { id, username, sender, text } = req.body;
    const db = readDB();
    const doc = db.hoso.find(h => h.id === id);
    if (!doc) return res.status(404).json({ success: false });
    let finalSender = sender;
    if (username) { const user = db.users.find(u => u.username === username); if (user) finalSender = `🏛️ ${user.name} (${user.department})`; }
    doc.feedbacks.push({ sender: finalSender, text, time: new Date().toLocaleTimeString('vi-VN') });
    writeDB(db); if (username) writeLog(username, `Gửi tin nhắn phản hồi đơn hồ sơ ${id}`);
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`🏛️ SERVER RUNNING ON PORT ${PORT}`));
