// server.js (Geliştirilmiş ve Güvenli Backend)

require("dotenv").config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");

const app = express();
const port = process.env.PORT || 3001;
app.set("trust proxy", true);

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https://i.imgur.com", "https://r.resimlink.com"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
            },
        },
    })
);

// Middleware
app.use(cors());
app.use(bodyParser.json());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests, try again later."
});
app.use(limiter);

// PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Bu satır Render için gerekli
});


// Token kontrolü
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Token missing" });

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.walletAddress = decoded.walletAddress;
        next();
    } catch (err) {
        return res.status(403).json({ error: "Invalid token" });
    }
}

// Admin kontrolü fonksiyonu
function isAdmin(wallet) {
    return wallet === "xadminmemexgiris30T";
}

// Login
app.post("/login", async (req, res) => {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ error: "Wallet required" });

    // CAPTCHA kontrolü yapılmadan işlem devam ediyor
    console.log("Skipping CAPTCHA verification");

    try {
        // Kullanıcıyı veritabanına ekliyoruz (önceden var ise eklemiyoruz)
        await pool.query(
            "INSERT INTO users (wallet_address) VALUES ($1) ON CONFLICT DO NOTHING",
            [walletAddress]
        );

        // JWT token oluşturuyoruz
        const token = jwt.sign({ walletAddress }, process.env.JWT_SECRET, { expiresIn: "7d" });
        res.json({ success: true, token });
    } catch (err) {
        console.error("Login error:", err.message);
        res.status(500).json({ error: "Login failed" });
    }
});

// Poll listesi
app.get("/polls", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM polls ORDER BY id DESC");
        res.json(result.rows);
    } catch (err) {
        console.error("Poll list error:", err.message);
        res.status(500).json({ error: "Failed to fetch polls" });
    }
});

// Vote
app.post("/vote", verifyToken, async (req, res) => {
    const { pollId, answer } = req.body;
    const wallet = req.walletAddress;

    if (!pollId || !answer) return res.status(400).json({ error: "Poll ID and answer required" });

    try {
        const pollCheck = await pool.query("SELECT * FROM polls WHERE id = $1", [pollId]);
        if (pollCheck.rowCount === 0) return res.status(404).json({ error: "Poll not found" });

        const poll = pollCheck.rows[0];
        const now = new Date();

        if (now < new Date(poll.start_time) || now > new Date(poll.end_time)) {
            return res.status(400).json({ error: "Poll is not active" });
        }

        // ✅ Seçenek geçerli mi kontrolü
        const pollOptions = poll.options || [];
        if (!pollOptions.includes(answer)) {
            return res.status(400).json({ error: "Invalid answer option" });
        }

        // ✅ Aynı cüzdan daha önce oy kullandı mı kontrolü
        const check = await pool.query(
            "SELECT * FROM votes WHERE poll_id = $1 AND wallet_address = $2",
            [pollId, wallet]
        );
        if (check.rowCount > 0) return res.status(400).json({ error: "You have already voted." });

        // ✅ Oy kaydı
        await pool.query(
            "INSERT INTO votes (poll_id, wallet_address, answer) VALUES ($1, $2, $3)",
            [pollId, wallet, answer]
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Vote error:", err.message);
        res.status(500).json({ error: "Vote failed" });
    }
});

// Sonuçlar
app.get("/results/:pollId", async (req, res) => {
    const pollId = req.params.pollId;
    try {
        const result = await pool.query(
            "SELECT answer, COUNT(*) as count FROM votes WHERE poll_id = $1 GROUP BY answer",
            [pollId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Result error:", err.message);
        res.status(500).json({ error: "Failed to fetch results" });
    }
});

app.post(
    "/createPoll",
    verifyToken,
    body("question").notEmpty().withMessage("Question is required"),
    async (req, res) => {
        if (!isAdmin(req.walletAddress)) {
            return res.status(403).json({ error: "Only admin can create polls" });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array()[0].msg });
        }

        // ✅ GÖNDERİLEN GÖRSEL LINKİNE BAKALIM
        const { question, description, image_url, start_time, end_time, options } = req.body;
        console.log("📷 image_url:", image_url);

        // ✅ Seçenekler kontrolü
        if (!Array.isArray(options) || options.length < 2) {
            return res.status(400).json({ error: "En az iki seçenek girilmeli." });
        }

        // ✅ PostgreSQL TEXT[] formatına uygun çeviri
        const formattedOptions = `{${options.map(opt => `"${opt}"`).join(",")}}`;

        try {
            const result = await pool.query(
                `INSERT INTO polls
                     (question, description, image_url, start_time, end_time, options)
                 VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING id`,
                [
                    question,
                    description,
                    image_url || null,
                    start_time || new Date(),
                    end_time || null,
                    formattedOptions
                ]
            );

            res.json({ pollId: result.rows[0].id });
        } catch (err) {
            console.error("Poll creation error:", err.message);
            res.status(500).json({ error: "Poll creation failed" });
        }
    }
);


// Anket silme
app.delete("/deletePoll/:id", verifyToken, async (req, res) => {
    if (!isAdmin(req.walletAddress)) return res.status(403).json({ error: "Only admin" });
    const pollId = req.params.id;
    try {
        await pool.query("DELETE FROM polls WHERE id = $1", [pollId]);
        await pool.query("DELETE FROM votes WHERE poll_id = $1", [pollId]);
        res.json({ success: true });
    } catch (err) {
        console.error("Poll delete error:", err.message);
        res.status(500).json({ error: "Poll deletion failed" });
    }
});

// Anket düzenleme
app.put("/editPoll/:id", verifyToken, async (req, res) => {
    if (!isAdmin(req.walletAddress)) return res.status(403).json({ error: "Only admin can edit" });
    const pollId = req.params.id;
    const { question, description, image_url, start_time, end_time } = req.body;
    try {
        await pool.query(
            "UPDATE polls SET question = $1, description = $2, image_url = $3, start_time = $4, end_time = $5 WHERE id = $6",
            [question, description, image_url, start_time, end_time, pollId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Poll edit error:", err.message);
        res.status(500).json({ error: "Poll edit failed" });
    }
});

// Admin istatistikleri
app.get("/admin/stats", verifyToken, async (req, res) => {
    if (!isAdmin(req.walletAddress)) return res.status(403).json({ error: "Only admin" });
    try {
        const totalVotes = await pool.query("SELECT COUNT(*) FROM votes");
        const totalUsers = await pool.query("SELECT COUNT(*) FROM users");
        const totalPolls = await pool.query("SELECT COUNT(*) FROM polls");

        res.json({
            success: true,
            stats: {
                totalVotes: parseInt(totalVotes.rows[0].count),
                totalUsers: parseInt(totalUsers.rows[0].count),
                totalPolls: parseInt(totalPolls.rows[0].count)
            }
        });
    } catch (err) {
        console.error("Stats error:", err.message);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

const path = require("path");

// Statik dosyaları sun
app.use(express.static(path.join(__dirname)));

// Ana sayfa isteği geldiğinde index.html gönder
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Sunucuyu başlat
app.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
});








