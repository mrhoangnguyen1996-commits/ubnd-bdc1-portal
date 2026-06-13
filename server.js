const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_PATH = path.join(__dirname, 'data', 'database.json');
const ADMIN_PASSWORD = "BDC" + new Date().getFullYear(); // Mật khẩu mặc định: BDC2026

// Hàm đọc dữ liệu từ file JSON an toàn
function readDB() {
    if (!fs.existsSync(DB_PATH)) {
        const defaultData = { citizens: {}, hoso: [] };
        fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (e) {
        return { citizens: {}, hoso: [] };
    }
}

// Hàm ghi dữ liệu vào file JSON
function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// 🔐 API: Cán bộ đăng nhập
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        return res.json({ success: true, message: "Đăng nhập thành công!" });
    }
    return res.status(401).json({ success: false, message: "Sai mã mật khẩu cán bộ!" });
});

// 👥 API: Tìm kiếm hoặc lấy danh sách công dân
app.get('/api/citizens', (req, res) => {
    const db = readDB();
    const { search } = req.query;
    if (search) {
        const citizen = db.citizens[search];
        return res.json(citizen ? { [search]: citizen } : {});
    }
    res.json(db.citizens);
});

// ✍️ API: Cán bộ thêm hoặc sửa dữ liệu dân cư
app.post('/api/admin/citizens', (req, res) => {
    const { password, name, cccd, chucvu, tienan, trangthai } = req.body;
    if (password !== ADMIN_PASSWORD) return res.status(403).json({ success: false, message: "Không có quyền!" });

    const db = readDB();
    db.citizens[name] = { cccd, chucvu, tienan, trangthai };
    writeDB(db);
    res.json({ success: true, message: "Cập nhật thành công!" });
});

// 📋 API: Công dân nộp đơn trực tuyến
app.post('/api/hoso', (req, res) => {
    const { name, type, content } = req.body;
    const db = readDB();
    const newDoc = {
        id: 'HS-' + Math.floor(1000 + Math.random() * 9000),
        name, type, content,
        status: "Chờ duyệt",
        time: new Date().toLocaleString('vi-VN')
    };
    db.hoso.unshift(newDoc);
    writeDB(db);
    res.json({ success: true, data: newDoc });
});

// 📋 API: Lấy toàn bộ đơn thư
app.get('/api/hoso', (req, res) => {
    res.json(readDB().hoso);
});

// 🏛️ API: Cán bộ phê duyệt hoặc từ chối đơn thư
app.post('/api/admin/hoso/approve', (req, res) => {
    const { password, id, status } = req.body;
    if (password !== ADMIN_PASSWORD) return res.status(403).json({ success: false });

    const db = readDB();
    const doc = db.hoso.find(h => h.id === id);
    if (doc) {
        doc.status = status;
        writeDB(db);
        return res.json({ success: true });
    }
    res.status(404).json({ success: false });
});

app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🏛️  UBND PHƯỜNG BDC ONLINE TẠI PORT: ${PORT}`);
    console.log(`🔑 MẬT KHẨU CÁN BỘ NĂM NÀY: ${ADMIN_PASSWORD}`);
    console.log(`=========================================`);
});