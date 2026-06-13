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
    return res.status(401).json({ success: false, message: "Thông tin không chính xác!" });
});

app.get('/api/news', (req, res) => res.json(readDB().news || []));
app.get('/api/hoso', (req, res) => res.json(readDB().hoso || []));
app.get('/api/logs', (req, res) => res.json(readDB().logs || []));
app.get('/api/users', (req, res) => res.json(readDB().users || []));

app.post('/api/hoso/submit', (req, res) => {
    const { citizen_name, type, content } = req.body;
    const db = readDB();
    const newHoso = {
        id: 'HS-' + Math.floor(1000 + Math.random() * 9000),
        citizen_name, type, content,
        status: "Chờ duyệt",
        time: new Date().toLocaleString('vi-VN'),
        submit_timestamp: Date.now(), // Lưu mốc thời gian nộp đơn đơn vị ms
        feedback: ""
    };
    db.hoso.unshift(newHoso);
    writeDB(db);
    res.json({ success: true });
});

// PHÊ DUYỆT ĐƠN - TÍNH TOÁN VÀ ĐO LƯỜNG TỐC ĐỘ PHẢN HỒI THỰC TẾ
app.post('/api/hoso/review', (req, res) => {
    const { id, status, feedback, officer_name } = req.body;
    const db = readDB();
    const item = db.hoso.find(h => h.id === id);
    if (!item) return res.status(404).json({ success: false });

    item.status = status;
    item.feedback = feedback;

    // Tính thời gian phản hồi thực tế (Giây)
    const timeDiffSeconds = Math.max(1, Math.floor((Date.now() - item.submit_timestamp) / 1000));
    let timeDiffString = timeDiffSeconds + " giây";
    if (timeDiffSeconds >= 60) {
        timeDiffString = Math.floor(timeDiffSeconds / 60) + " phút " + (timeDiffSeconds % 60) + " giây";
    }

    db.logs.unshift({
        id: 'LOG-' + Date.now(),
        officer: officer_name,
        hoso_id: id,
        action: status === 'Đã Phê Duyệt' ? 'Phê Duyệt' : 'Bác Đơn Thư',
        time: new Date().toLocaleString('vi-VN'),
        duration: timeDiffString,
        details: feedback
    });

    const staff = db.users.find(u => u.name === officer_name);
    if (staff) {
        staff.processed_count = (staff.processed_count || 0) + 1;
        // Cập nhật thời gian xử lý trung bình của cán bộ
staff.avg_time_sec = staff.avg_time_sec ? Math.floor((staff.avg_time_sec + timeDiffSeconds) / 2) : timeDiffSeconds;
    }

    writeDB(db);
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`🏛️ Trung tâm điều hành liên thông hoạt động tại: http://localhost:${PORT}`));
