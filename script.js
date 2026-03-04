// H2GO - 수소거래 플랫폼 스크립트

const USER_LABELS = {
    supplier: '공급자',
    transporter: '운송자',
    consumer: '수요자'
};

// 모달 요소
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginUserLabel = document.getElementById('loginUserLabel');
const registerUserLabel = document.getElementById('registerUserLabel');
const loginUserType = document.getElementById('loginUserType');
const registerUserType = document.getElementById('registerUserType');

// 로그인/회원가입 버튼 이벤트
document.querySelectorAll('[data-action="login"]').forEach(btn => {
    btn.addEventListener('click', () => openModal('login', btn.dataset.user));
});

document.querySelectorAll('[data-action="register"]').forEach(btn => {
    btn.addEventListener('click', () => openModal('register', btn.dataset.user));
});

// 모달 열기
function openModal(type, userType) {
    const label = USER_LABELS[userType] || '사용자';
    
    if (type === 'login') {
        loginUserLabel.textContent = label;
        loginUserType.value = userType;
        loginModal.classList.add('active');
    } else {
        registerUserLabel.textContent = label;
        registerUserType.value = userType;
        registerModal.classList.add('active');
    }
}

// 모달 닫기
function closeModal(modal) {
    modal.classList.remove('active');
}

// 모달 닫기 버튼
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
        const modal = btn.closest('.modal');
        closeModal(modal);
    });
});

// 모달 배경 클릭 시 닫기
[loginModal, registerModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
    });
});

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal(loginModal);
        closeModal(registerModal);
    }
});

// 폼 제출
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const userType = loginUserType.value;
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    // 실제 구현 시 API 호출
    console.log(`${USER_LABELS[userType]} 로그인:`, { email, userType });
    closeModal(loginModal);
    // 대시보드로 이동 (역할별 화면)
    window.location.href = `dashboard.html?role=${userType}`;
});

registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
    
    if (password !== passwordConfirm) {
        alert('비밀번호가 일치하지 않습니다.');
        return;
    }
    
    const userType = registerUserType.value;
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    
    // 실제 구현 시 API 호출
    console.log(`${USER_LABELS[userType]} 회원가입:`, { name, email, userType });
    closeModal(registerModal);
    // 대시보드로 이동
    window.location.href = `dashboard.html?role=${userType}`;
});

// 모바일 메뉴
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navLinks = document.querySelector('.nav-links');

mobileMenuBtn?.addEventListener('click', () => {
    const isOpen = navLinks.classList.contains('nav-open');
    navLinks.classList.toggle('nav-open');
});

// 스무스 스크롤
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
});

// AI 챗봇 (OpenAI는 서버(server.py)에서 호출)
const chatbotFab = document.getElementById("chatbotFab");
const chatbotPanel = document.getElementById("chatbotPanel");
const chatbotClose = document.getElementById("chatbotClose");
const chatbotMessages = document.getElementById("chatbotMessages");
const chatbotForm = document.getElementById("chatbotForm");
const chatbotInput = document.getElementById("chatbotInput");
const chatbotSend = document.getElementById("chatbotSend");
const chatbotStatus = document.getElementById("chatbotStatus");

let apiConfig = {
    base: "",
    mode: "chat", // "chat" | "respond"
};

function getPreferredBase() {
    // 1) 같은 서버가 index.html을 서빙 중이면 상대경로로 먼저 시도
    // 2) index.html을 file:// 로 열거나, 다른 포트(Live Server 등)에서 열면 localhost로 fallback
    try {
        if (window.H2GO_CHAT_API_BASE) return String(window.H2GO_CHAT_API_BASE);
    } catch (_) {}

    const isFile = window.location?.protocol === "file:";
    const isLikelyNotBackend = window.location?.port && window.location.port !== "3000";
    if (isFile || isLikelyNotBackend) return "http://127.0.0.1:3000";
    return "";
}

const chatState = {
    messages: [],
    busy: false,
    openedOnce: false,
};

async function checkChatHealth(base) {
    const url = `${base}/api/health`;
    try {
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) throw new Error(`헬스체크 실패 (HTTP ${res.status})`);
        return true;
    } catch (_) {
        return false;
    }
}

async function detectApi() {
    const preferred = getPreferredBase();

    // 1) 같은 오리진(상대경로) 시도
    if (await checkChatHealth("")) {
        apiConfig = { base: "", mode: "chat" };
        return apiConfig;
    }

    // 2) 파이썬 테스트 서버(기본 3000) 시도
    if (await checkChatHealth(preferred)) {
        apiConfig = { base: preferred, mode: "chat" };
        return apiConfig;
    }

    apiConfig = { base: preferred || "http://127.0.0.1:3000", mode: "chat" };
    return apiConfig;
}

function setChatOpen(open) {
    if (!chatbotPanel) return;
    chatbotPanel.classList.toggle("open", !!open);
    chatbotPanel.setAttribute("aria-hidden", open ? "false" : "true");
    if (open) {
        chatbotInput?.focus();
        if (!chatState.openedOnce) {
            chatState.openedOnce = true;
            addBubble("assistant", "안녕하세요! H2GO AI입니다. 거래/이용방법/문의 등 무엇이든 물어보세요.");
            detectApi().then((cfg) => {
                addBubble("assistant", "현재 챗봇 서버는 로컬(기본 3000)로 연결됩니다.");
                checkChatHealth(cfg.base).then((ok) => {
                    if (!ok) {
                        addBubble(
                            "assistant",
                            "현재 챗봇 서버 연결이 안 돼요.\n" +
                                "- PowerShell에서 `python openai_test_server.py` 실행 (포트 3000)\n" +
                                "- 그리고 브라우저에서 `http://127.0.0.1:3000/` 로 접속해 주세요."
                        );
                    }
                });
            });
        }
    }
}

function setChatBusy(on, statusText = "") {
    chatState.busy = !!on;
    if (chatbotSend) chatbotSend.disabled = !!on;
    if (chatbotInput) chatbotInput.disabled = !!on;
    if (chatbotStatus) chatbotStatus.textContent = statusText || "";
}

function addBubble(role, text) {
    if (!chatbotMessages) return;
    const div = document.createElement("div");
    div.className = `chatbot-bubble ${role}`;
    div.textContent = text;
    chatbotMessages.appendChild(div);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

function normalizeText(s) {
    return String(s || "").replace(/\r\n/g, "\n").trim();
}

async function sendChat(text) {
    const content = normalizeText(text);
    if (!content || chatState.busy) return;

    addBubble("user", content);
    chatState.messages.push({ role: "user", content });

    setChatBusy(true, "답변 생성 중...");
    const typingId = `typing-${Date.now()}`;
    addBubble("assistant", "...");
    const typingEl = chatbotMessages?.lastElementChild;
    if (typingEl) typingEl.dataset.typing = typingId;

    try {
        const cfg = await detectApi();

        const url = cfg.mode === "respond" ? `${cfg.base}/api/respond` : `${cfg.base}/api/chat`;
        const body =
            cfg.mode === "respond"
                ? { input: content, model: "gpt-4.1-mini", temperature: 0.7 }
                : { messages: chatState.messages, model: "gpt-4.1-mini", temperature: 0.7 };

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data?.detail || data?.error || `요청 실패 (HTTP ${res.status})`);
        }

        const reply = normalizeText(data?.text || "");
        const finalText = reply || "답변을 생성하지 못했습니다. 다시 시도해 주세요.";

        if (typingEl && typingEl.dataset.typing === typingId) typingEl.textContent = finalText;
        else addBubble("assistant", finalText);

        chatState.messages.push({ role: "assistant", content: finalText });
        setChatBusy(false, "");
    } catch (e) {
        const msg = (e?.message || "").trim();
        let friendly = msg || "오류가 발생했습니다.";
        if (/failed to fetch|networkerror|fetch/i.test(msg)) {
            friendly =
                "서버 연결에 실패했습니다.\n" +
                "- PowerShell에서 `python openai_test_server.py` 실행 (포트 3000)\n" +
                "- 브라우저에서 `http://127.0.0.1:3000/` 로 접속해 주세요.\n" +
                "- (파일을 더블클릭해 `file://` 로 열면 브라우저가 서버 호출을 막을 수 있어요)";
        }
        if (typingEl && typingEl.dataset.typing === typingId) typingEl.textContent = friendly;
        setChatBusy(false, friendly);
    }
}

chatbotFab?.addEventListener("click", () => setChatOpen(!chatbotPanel?.classList.contains("open")));
chatbotClose?.addEventListener("click", () => setChatOpen(false));

chatbotPanel?.addEventListener("click", (e) => {
    if (e.target === chatbotPanel) setChatOpen(false);
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setChatOpen(false);
});

chatbotInput?.addEventListener("input", () => {
    chatbotInput.style.height = "auto";
    chatbotInput.style.height = `${Math.min(chatbotInput.scrollHeight, 120)}px`;
});

chatbotInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        chatbotForm?.requestSubmit?.();
    }
});

chatbotForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatbotInput?.value ?? "";
    if (chatbotInput) {
        chatbotInput.value = "";
        chatbotInput.style.height = "auto";
    }
    await sendChat(text);
});
