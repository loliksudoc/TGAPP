const $chat = document.getElementById('chat');
const $input = document.getElementById('user_input');
const $model = document.getElementById('model_select');
const $style = document.getElementById('style_select');
const $sendBtn = document.getElementById('send_button');
const $genImgBtn = document.getElementById('generate_image_button');

const TIMEOUT_API = 30000;

function loadUserAvatar() {
    if (window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url) {
        document.getElementById('user_avatar').src = Telegram.WebApp.initDataUnsafe.user.photo_url;
    }
}

function appendMessage(content, sender = "bot") {
    const msg = document.createElement('div');
    msg.classList.add('message', sender);
    msg.innerHTML = sender === "user"
        ? `<img src="${Telegram.WebApp.initDataUnsafe?.user?.photo_url || 'assets/user_default.png'}" alt="User Avatar"> ${content}`
        : content;
    $chat.appendChild(msg);
    $chat.scrollTop = $chat.scrollHeight;
    return msg;
}

function loadChatHistory() {
    const history = JSON.parse(localStorage.getItem('chatHistory')) || [];
    history.forEach(msg => appendMessage(msg.content, msg.sender));
}

function saveChatHistory(content, sender) {
    const history = JSON.parse(localStorage.getItem('chatHistory')) || [];
    history.push({ content, sender });
    localStorage.setItem('chatHistory', JSON.stringify(history));
}

function createTyping() {
    const el = document.createElement('div');
    el.classList.add('message', 'bot', 'typing-indicator');
    el.innerHTML = `
        <div class="typing-content">
            <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        </div>`;
    $chat.appendChild(el);
    $chat.scrollTop = $chat.scrollHeight;
    return el;
}

function removeTyping(el) {
    if (el && el.parentNode) el.remove();
}

async function withTimeout(promise, timeout, errMsg) {
    let id;
    const timeoutPromise = new Promise((_, reject) => {
        id = setTimeout(() => reject(new Error(errMsg)), timeout);
    });
    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        clearTimeout(id);
    }
}

async function sendMessage() {
    const text = $input.value.trim();
    if (!text) return;

    appendMessage(text, "user");
    $input.value = '';
    $input.disabled = true;
    $sendBtn.disabled = true;

    const typing = createTyping();

    try {
        const payload = {
            model: $model.value,
            messages: [{ role: "user", content: text }],
            max_tokens: 512,
            temperature: 0.7
        };

        const res = await withTimeout(fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": config.API_KEY_CHAT,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        }), TIMEOUT_API, 'Timeout API');

        if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);

        const data = await res.json();
        if (data?.choices?.[0]?.message?.content) {
            removeTyping(typing);
            appendMessage(data.choices[0].message.content, "bot");
            saveChatHistory(data.choices[0].message.content, "bot");
        } else {
            throw new Error("No content from API.");
        }
    } catch (e) {
        console.error("Send error:", e);
        removeTyping(typing);
        appendMessage(`Ошибка: ${e.message}`, "bot");
    } finally {
        $input.disabled = false;
        $sendBtn.disabled = false;
        $input.focus();
    }
}

async function generateImage() {
    const text = $input.value.trim();
    if (!text) return;

    appendMessage(text, "user");
    $input.value = '';
    $input.disabled = true;
    $genImgBtn.disabled = true;

    const typing = createTyping();

    try {
        const stylePrompt = `${$style.value}, ${text}`;

        const res = await withTimeout(fetch("https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0", {
            method: "POST",
            headers: {
                "Authorization": config.API_KEY_IMAGE,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                inputs: stylePrompt,
                parameters: { width: 1024, height: 1024 }
            })
        }), TIMEOUT_API, 'Timeout generation');

        if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        removeTyping(typing);
        const imgHtml = `
            <div style="text-align: center;">
                <img src="${url}" style="max-width: 90%; max-height: 70vh; border-radius: 10px; margin: 10px 0;">
                <div style="margin-top: 5px; font-size: 0.9em; color: #666;">${stylePrompt}</div>
            </div>
        `;
        appendMessage(imgHtml, "bot");
        saveChatHistory(imgHtml, "bot");
    } catch (e) {
        console.error("Image generation error:", e);
        removeTyping(typing);
        appendMessage(`Ошибка генерации: ${e.message}`, "bot");
    } finally {
        $input.disabled = false;
        $genImgBtn.disabled = false;
        $input.focus();
    }
}

window.onload = () => {
    loadUserAvatar();
    loadChatHistory();
};

$input.addEventListener('keydown', e => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
$sendBtn.addEventListener('click', sendMessage);
$genImgBtn.addEventListener('click', generateImage);
