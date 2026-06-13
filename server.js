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

// API 1: Đăng nhập & Xác thực phân quyền cán bộ
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username === username && u.password === password);
    if (user) return res.json({ success: true, user });
    return res.status(401).json({ success: false, message: "Thông tin chứng thư BDC không chính xác!" });
});

// API 2: Lấy danh sách bảng tin công cộng
app.get('/api/news', (req, res) => {
    res.json(readDB().news || []);
});

// API 3: Đăng tin mới (Dành cho Lãnh đạo & Cán bộ)
app.post('/api/news/add', (req, res) => {
    const { title, content, author } = req.body;
    const db = readDB();
    const newArticle = {
        id: 'NEWS-' + Date.now(),
        title, content, author,
        time: new Date().toLocaleString('vi-VN')
    };
    db.news.unshift(newArticle);
    writeDB(db);
    res.json({ success: true, article: newArticle });
});

// API 4: Xóa văn bản bảng tin (CHỈ DÀNH CHO CẤP QUẢN LÝ ĐƯỢC PHÂN QUYỀN)
app.post('/api/news/delete', (req, res) => {
    const { newsId, role } = req.body;
    if (role !== 'manager') {
        return res.status(430).json({ success: false, message: "Hành động bị từ chối! Bạn không có quyền cấp Quản lý." });
    }
    const db = readDB();
    db.news = db.news.filter(n => n.id !== newsId);
    writeDB(db);
    res.json({ success: true, message: "Đã xóa bản tin thành công." });
});

// API 5: Lấy danh sách toàn bộ hồ sơ hành chính
app.get('/api/hoso', (req, res) => res.json(readDB().hoso || []));

// API 6: Người dân nộp đơn thư mới trực tuyến
app.post('/api/hoso/submit', (req, res) => {
    const { citizen_name, type, content } = req.body;
    const db = readDB();
    const newHoso = {
        id: 'HS-' + Math.floor(1000 + Math.random() * 9000),
        citizen_name, type, content,
        status: "Chờ duyệt",
        time: new Date().toLocaleString('vi-VN'),
        feedback: ""
    };
    db.hoso.unshift(newHoso);
    writeDB(db);
    res.json({ success: true, data: newHoso });
});

// API 7: Cán bộ ký duyệt / Từ chối / Đóng dấu mộc hồ sơ
app.post('/api/hoso/review', (req, res) => {
    const { id, status, feedback } = req.body;
    const db = readDB();
    const item = db.hoso.find(h => h.id === id);
    if (!item) return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ." });
    
    item.status = status;
    item.feedback = feedback;
    writeDB(db);
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`🏛️ Hệ thống BDC hoạt động tại website: http://localhost:${PORT}`));
