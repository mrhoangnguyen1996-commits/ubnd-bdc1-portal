const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_PATH = path.join(__dirname, 'data', 'database.json');

function readDB() { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
function writeDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username === username && u.password === password);
    if (user) return res.json({ success: true, user });
    return res.status(401).json({ success: false, message: "Thông tin chứng thư không chính xác!" });
});

app.get('/api/news', (req, res) => res.json(readDB().news || []));
app.get('/api/hoso', (req, res) => res.json(readDB().hoso || []));
app.get('/api/logs', (req, res) => res.json(readDB().logs || []));
app.get('/api/users', (req, res) => res.json(readDB().users || []));

app.post('/api/news/add', (req, res) => {
    const { title, content, author } = req.body;
    const db = readDB();
    const newArticle = { id: 'NEWS-' + Date.now(), title, content, author, time: new Date().toLocaleString('vi-VN') };
    db.news.unshift(newArticle);
    writeDB(db);
    res.json({ success: true });
});

app.post('/api/news/delete', (req, res) => {
    const { newsId, role } = req.body;
    if (role !== 'manager') return res.status(430).json({ success: false, message: "Từ chối! Quyền hạn không đủ." });
    const db = readDB();
    db.news = db.news.filter(n => n.id !== newsId);
    writeDB(db);
    res.json({ success: true });
});

app.post('/api/hoso/submit', (req, res) => {
    const { citizen_name, type, content } = req.body;
    const db = readDB();
    const newHoso = { id: 'HS-' + Math.floor(1000 + Math.random() * 9000), citizen_name, type, content, status: "Chờ duyệt", time: new Date().toLocaleString('vi-VN'), feedback: "" };
    db.hoso.unshift(newHoso);
    writeDB(db);
    res.json({ success: true });
});

// KÝ DUYỆT HỒ SƠ - ĐỒNG BỘ GHI NHẬT KÝ VÀ TĂNG THỐNG KÊ CÁN BỘ
app.post('/api/hoso/review', (req, res) => {
    const { id, status, feedback, officer_name } = req.body;
    const db = readDB();
    const item = db.hoso.find(h => h.id === id);
    if (!item) return res.status(404).json({ success: false });

    item.status = status;
    item.feedback = feedback;

    // 1. Thêm vào lịch sử xử lý hồ sơ công dân
    db.logs.unshift({
        id: 'LOG-' + Date.now(),
        officer: officer_name,
        hoso_id: id,
        action: status === 'Đã Phê Duyệt' ? 'Phê Duyệt' : 'Bác Đơn Thư',
        time: new Date().toLocaleString('vi-VN'),
        details: feedback
    });

    // 2. Tăng số lượng thống kê hiệu suất công tác của cán bộ đó
    const staff = db.users.find(u => u.name === officer_name);
    if (staff) {
        staff.processed_count = (staff.processed_count || 0) + 1;
    }

    writeDB(db);
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`🏛️ Cổng BDC hoạt động tại: http://localhost:${PORT}`));
