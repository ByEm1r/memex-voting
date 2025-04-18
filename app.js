let token = "";
let isAdmin = false;


// Admin cüzdan adresi
const ADMIN_WALLET = "xadminmemexgiris30T";
const ADMIN_PASS = "memexsifre123";

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("loginBtn").addEventListener("click", login);
    document.getElementById("createPollBtn").addEventListener("click", createPoll);
    document.getElementById("toggleThemeBtn").addEventListener("click", toggleTheme);
    const walletInput = document.getElementById("wallet");
    const pass = document.getElementById("admin-pass");

    // Sayfa ilk açıldığında şifre alanı gizli kalsın
    pass.style.display = "none";

    walletInput.addEventListener("input", () => {
        pass.style.display = walletInput.value.trim() === ADMIN_WALLET ? "block" : "none";
    });
});

// Tema değiştirme
function toggleTheme() {
    console.log("🎨 Tema değiştiriliyor");
    const current = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", current === "light" ? "dark" : "light");
}

// Toast mesajı gösterici
function showToast(msg, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: bold;
        background: ${type === "success" ? "#22c55e" : type === "error" ? "#ef4444" : "#3b82f6"};
        color: white;
        z-index: 10000;
        box-shadow: 0 0 10px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Giriş (Admin + Kullanıcı)
async function login() {
    console.log("🟢 login fonksiyonu çalıştı!");

    const wallet = document.getElementById("wallet").value.trim();
    const adminPass = document.getElementById("admin-pass").value;



    if (wallet === "xadminmemexgiris30T" && adminPass !== "memexsifre123") {
        return showToast("Wrong admin password", "error");
    }

    if (!/^x[a-zA-Z0-9]{20,60}$/.test(wallet) && wallet !== "xadminmemexgiris30T") {
        return showToast("Invalid Omni XEP wallet address", "error");
    }

    try {
        const res = await fetch("https://cdm.memextoken.org/login", { // ✅ DOMAIN GÜNCEL
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress: wallet, })
        });

        const data = await res.json();
        if (data.success) {
            token = data.token;
            isAdmin = wallet === "xadminmemexgiris30T";

            document.getElementById("login-area").style.display = "none";
            document.getElementById("main-title").style.display = "block";

            if (isAdmin) {
                document.getElementById("create-section").style.display = "block";
                renderOptionInputs();

            } else {
                document.getElementById("create-section").style.display = "none";
            }

            showToast(`Welcome ${wallet.slice(0, 6)}...${wallet.slice(-4)}`);
            loadPolls();
        } else {
            showToast("Login failed: " + (data.error || "Unknown error"), "error");
        }
    } catch (err) {
        console.error("Login fetch error:", err.message);
        showToast("Network error during login", "error");
    }
}

// Yeni anket oluştur
async function createPoll() {
    console.log("🟢 createPoll fonksiyonu çalıştı!");
    const question = document.getElementById("new-question").value;
    const description = document.getElementById("new-description").value;
    const image_url = document.getElementById("new-image").value;
    const start_time = document.getElementById("new-start").value;
    const end_time = document.getElementById("new-end").value;

    let options = [];
    if (isAdmin) {
        options = Array.from(document.getElementsByClassName("option-input"))
            .map(el => el.value.trim()).filter(opt => opt !== "");
    }

    if (!question || options.length < 2) {
        return showToast("Lütfen soru ve en az iki seçenek girin", "error");
    }

    const res = await fetch("/createPoll", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
        },
        body: JSON.stringify({ question, description, image_url, start_time, end_time, options })
    });

    const data = await res.json();
    if (data.pollId) {
        showToast("Anket başarıyla oluşturuldu");
        loadPolls();
    } else {
        showToast("Anket oluşturulamadı", "error");
    }
}

// Admin için anket seçeneklerini göster
function renderOptionInputs() {
    const wrapper = document.getElementById("option-wrapper");
    if (!wrapper) return;
    wrapper.innerHTML = "";
    const inputs = ["Seçenek 1", "Seçenek 2"];
    inputs.forEach(ph => {
        const input = document.createElement("input");
        input.className = "option-input";
        input.placeholder = ph;
        wrapper.appendChild(input);
    });
    const addBtn = document.createElement("button");
    addBtn.textContent = "+ Seçenek Ekle";
    addBtn.onclick = addOptionInput;
    wrapper.appendChild(addBtn);
}

// Yeni seçenek ekle
function addOptionInput() {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Yeni Seçenek";
    input.className = "option-input";
    document.getElementById("option-wrapper").appendChild(input);
}

// Sayfa yüklendiğinde admin ise seçenekleri göster
window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("create-section").style.display = "none";
    if (isAdmin) {
        renderOptionInputs();
    }
});

// 📥 Anketleri yükle
async function loadPolls() {
    const res = await fetch("/polls");
    const data = await res.json();
    const container = document.getElementById("polls");
    container.innerHTML = "";

    for (const poll of data) {
        console.log("Anket Verisi:", poll);
        const startDate = new Date(poll.start_time);
        const endDate = new Date(poll.end_time);
        const now = new Date();
        const isActive = now >= startDate && now <= endDate;

        const div = document.createElement("div");
        div.className = "poll";
        div.id = `poll-${poll.id}`;
        div.innerHTML = `
            <h3>${poll.question}</h3>
            ${poll.description ? `<p>${poll.description}</p>` : ""}
            ${poll.image_url ? `
                <img src="${poll.image_url}" alt="Anket Görseli"
                    onerror="this.style.display='none'"
                    style="
                        max-width: 100%;
                        max-height: 400px;
                        width: auto;
                        height: auto;
                        object-fit: contain;
                        border-radius: 10px;
                        margin-top: 10px;
                        display: block;
                        margin-left: auto;
                        margin-right: auto;
                    " />` : ""}
            <p class="poll-duration"><strong>Süre:</strong> ${startDate.toLocaleString()} - ${endDate.toLocaleString()}</p>
            ${!isActive
            ? `<p class="poll-ended">⏰ This poll has ended.</p>`
            : (poll.options || []).map(option => `
                    <button class="vote-btn" data-id="${poll.id}" data-option="${option}">
                        🗳️ ${option}
                    </button>`).join("")}
            <canvas id="chart-${poll.id}" height="100"></canvas>
            <button class="action-btn" data-action="share" data-id="${poll.id}">📤 Share</button>
            ${isAdmin ? `
                <div class="admin-controls">
                    <button class="action-btn" data-action="edit" data-id="${poll.id}">✏️ Düzenle</button>
                    <button class="action-btn" data-action="delete" data-id="${poll.id}">🗑️ Sil</button>
                    <button class="action-btn" data-action="stats" data-id="${poll.id}">📊 İstatistikler</button>
                </div>` : ""}
        `;

        container.appendChild(div);

        try {
            await loadResults(poll.id);
        } catch (err) {
            console.warn("📉 Grafik yüklenemedi:", err.message);
        }

        div.querySelectorAll(".vote-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const pollId = btn.getAttribute("data-id");
                const option = btn.getAttribute("data-option");
                vote(pollId, option, btn);
            });
        });

        div.querySelectorAll(".action-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const action = btn.getAttribute("data-action");
                const pollId = btn.getAttribute("data-id");

                if (action === "edit") editPoll(pollId);
                else if (action === "delete") deletePoll(pollId);
                else if (action === "stats") viewStats(pollId);
                else if (action === "share") sharePoll(pollId);
            });
        });
    }
}


// Anket sonuçlarını yükle
async function loadResults(pollId) {
    const res = await fetch(`/results/${pollId}`);
    const data = await res.json();
    const ctx = document.getElementById(`chart-${pollId}`);
    new Chart(ctx, {
        type: "bar",
        data: {
            labels: data.map(r => r.answer),
            datasets: [{
                label: "Oy Sayısı",
                data: data.map(r => r.count),
                backgroundColor: ["#4ade80", "#f87171", "#60a5fa", "#fbbf24", "#a78bfa", "#34d399"]
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}
async function vote(pollId, option, btn) {
    btn.disabled = true;

    // ✅ LOG EKLİYORUZ
    console.log("🟢 Oy gönderiliyor:", pollId, option);
    console.log("🟢 Token:", token);

    const res = await fetch(`/vote`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
        },
        body: JSON.stringify({ pollId, answer: option })
    });

    const data = await res.json();
    if (data.success) {
        showToast("Your vote has been recorded 🎉");
        playVoteEffect();
        await loadResults(pollId);
    } else {
        showToast(data.error || "Could not vote", "error");
    }
    btn.disabled = false;
}

// 🎉 Efekti
function playVoteEffect() {
    if (typeof confetti === "function") {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    }
}

// Modal oluşturucu
function createModal(content) {
    // Arka plan için overlay div
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.4);
        z-index: 9998;
    `;

    // Modal kutusu
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 9999;
        background: #1e293b;
        padding: 20px;
        border-radius: 12px;
        color: white;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    `;

    modal.innerHTML = `
        <button id="closeModalBtn" style="float:right;margin-bottom:10px;">❌ Kapat</button>
        ${content}
    `;

    // Kapat butonunu bağla
    modal.querySelector("#closeModalBtn").addEventListener("click", () => {
        overlay.remove();
        modal.remove();
    });

    document.body.appendChild(overlay);
    document.body.appendChild(modal);
}

// Anket düzenle
function editPoll(id) {
    const content = `
        <h3>Anket #${id} Düzenle</h3>
        <input type="text" id="edit-question" placeholder="Yeni Soru" />
        <textarea id="edit-description" placeholder="Yeni Açıklama"></textarea>
        <input type="text" id="edit-image" placeholder="Yeni Görsel URL" />
        <input type="datetime-local" id="edit-start" />
        <input type="datetime-local" id="edit-end" />
        <button id="submitEditBtn">💾 Kaydet</button>
    `;
    createModal(content);

    // ✅ Bu satırı mutlaka ekle
    setTimeout(() => {
        document.getElementById("submitEditBtn").addEventListener("click", () => submitEdit(id));
    }, 0);
}

// Güncellemeyi gönder
async function submitEdit(id) {
    const question = document.getElementById("edit-question").value;
    const description = document.getElementById("edit-description").value;
    const image_url = document.getElementById("edit-image").value;
    const start_time = document.getElementById("edit-start").value;
    const end_time = document.getElementById("edit-end").value;

    const res = await fetch(`/editPoll/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
        },
        body: JSON.stringify({ question, description, image_url, start_time, end_time })
    });

    const data = await res.json();
    if (data.success) {
        showToast("Anket güncellendi", "success");
        document.querySelector(".modal").remove();
        loadPolls();
    } else {
        showToast("Güncelleme başarısız", "error");
    }
}

// Anketi sil
async function deletePoll(id) {
    if (!confirm("Bu anketi silmek istediğinize emin misiniz?")) return;

    const res = await fetch(`/deletePoll/${id}`, {
        method: "DELETE",
        headers: {
            Authorization: "Bearer " + token
        }
    });

    const data = await res.json();
    if (data.success) {
        showToast("Anket silindi", "success");
        loadPolls();
    } else {
        showToast("Silme işlemi başarısız", "error");
    }
}

// İstatistikleri göster
async function viewStats(id) {
    const res = await fetch(`/results/${id}`);
    const data = await res.json();

    const content = `
        <h3>Anket #${id} İstatistikleri</h3>
        <ul>
            ${data.map(r => `<li>${r.answer}: ${r.count} oy</li>`).join("")}
        </ul>
    `;
    createModal(content);
}


// Twitter'da paylaşım
function sharePoll(id) {
    const url = `${window.location.origin}`;
    const text = `Vote for your favorite choice now at MemeX! 🗳️ @memexairdrop #MemexPoll\n${url}`;
    const shareURL = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(shareURL, "_blank", "width=550,height=450");
}




