const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_PATH = path.join(__dirname, 'data', 'database.json');

function readDB() {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Hàm tự động ghi lại nhật ký làm việc để Super Admin giám sát
function writeLog(username, action) {
    const db = readDB();
    db.logs.unshift({
        username,
        action,
        time: new Date().toLocaleString('vi-VN')
    });
    writeDB(db);
}

// 🔐 API: Đăng nhập hệ thống (Kiểm tra từng tài khoản trong DB)
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username === username && u.password === password);
    if (user) {
        return res.json({ success: true, user: { username: user.username, name: user.name, role: user.role, department: user.department } });
    }
    return res.status(401).json({ success: false, message: "Tài khoản hoặc mật khẩu không chính xác!" });
});

// 👑 API SUPER ADMIN: Cấp tài khoản mới cho cán bộ
app.post('/api/superadmin/users', (req, res) => {
    const { adminUser, username, password, name, department } = req.body;
    const db = readDB();
    
    const checkAdmin = db.users.find(u => u.username === adminUser && u.role === 'superadmin');
    if (!checkAdmin) return res.status(403).json({ success: false, message: "Từ chối truy cập!" });

    if (db.users.some(u => u.username === username)) {
        return res.json({ success: false, message: "Tên tài khoản này đã tồn tại!" });
    }

    db.users.push({ username, password, role: 'canbo', name, department });
    writeDB(db);
    writeLog(adminUser, `Đã cấp tài khoản cán bộ mới cho: ${name} (${department})`);
    res.json({ success: true });
});

// 👑 API SUPER ADMIN: Lấy danh sách tài khoản và Logs giám sát
app.get('/api/superadmin/monitoring', (req, res) => {
    const { adminUser } = req.query;
    const db = readDB();
    const checkAdmin = db.users.find(u => u.username === adminUser && u.role === 'superadmin');
    if (!checkAdmin) return res.status(403).json({ success: false });
    res.json({ users: db.users, logs: db.logs });
});

// 📊 API CHUNG: Lấy dữ liệu thống kê làm biểu đồ
app.get('/api/admin/stats', (req, res) => {
    const db = readDB();
    const citizens = Object.values(db.citizens);
    
    // Thống kê tài chính ngân hàng
    const totalCash = citizens.reduce((sum, c) => sum + (Number(c.bank_balance) || 0), 0);
    
    // Thống kê trạng thái pháp lý công an
    const naxin = citizens.filter(c => c.trangthai === "Đang bị truy nã").length;
    const hop_phap = citizens.filter(c => c.trangthai === "Hợp pháp").length;

    // Thống kê đơn thư
    const pendingDocs = db.hoso.filter(h => h.status === "Chờ duyệt").length;
    const approvedDocs = db.hoso.filter(h => h.status === "Đã Phê Duyệt").length;

    res.json({
        totalCitizens: citizens.length,
        totalCash,
        pendingDocs,
        approvedDocs,
        chartData: {
            lawStatus: [hop_phap, naxin],
            docsStatus: [pendingDocs, approvedDocs]
        }
    });
});

// Các API xử lý Tin tức, Công dân, Đơn thư (Đều tích hợp ghi nhận Logs cán bộ)
app.get('/api/news', (req, res) => res.json(readDB().news || []));
app.post('/api/admin/news', (req, res) => {
    const { username, tag, title, content } = req.body;
    const db = readDB();
    db.news.unshift({ id: 'NEWS-' + Date.now(), tag, title, content, time: new Date().toLocaleString('vi-VN') });
    writeDB(db);
    writeLog(username, `Đã phát hành văn bản thông báo: ${title}`);
    res.json({ success: true });
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
    writeLog(username, `Đã cập nhật thông tin gốc toàn diện của công dân: ${name}`);
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
    if (doc) { 
        doc.status = status; 
        writeDB(db); 
        writeLog(username, `Đã thay đổi trạng thái hồ sơ ${id} thành: ${status}`);
        return res.json({ success: true }); 
    }
    res.status(404).json({ success: false });
});

app.post('/api/hoso/feedback', (req, res) => {
    const { id, username, sender, text } = req.body;
    const db = readDB();
    const doc = db.hoso.find(h => h.id === id);
    if (!doc) return res.status(404).json({ success: false });

    let finalSender = sender;
    if (username) {
        const user = db.users.find(u => u.username === username);
        if (user) finalSender = `🏛️ Cán bộ: ${user.name} (${user.department})`;
    }

    doc.feedbacks.push({ sender: finalSender, text, time: new Date().toLocaleTimeString('vi-VN') });
    writeDB(db);
    if(username) writeLog(username, `Đã gửi lời nhắn phản hồi vào hồ sơ ${id}`);
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`🏛️ HỆ THỐNG UBND PHÂN QUYỀN ONLINE PORT: ${PORT}`));
