/* ========= Mermaid 初始化 ========= */
mermaid.initialize({ startOnLoad: false });

/* ===== 使用者暱稱 ===== */
let username = sessionStorage.getItem("chat_username");
if (!username) {
  username = "使用者" + Math.floor(Math.random() * 1000);
  sessionStorage.setItem("chat_username", username);
}

/* ===== 初始化 Socket.IO 連線 ===== */
const socket = io(); // 連到同主機 :5000

/* ===== 連線狀態更新 ===== */
function updateStatus(ok, msg = "已連線") {
  const el = $("#connection-status");
  if (ok) {
    el.text(msg).css("background-color", "#d4edda").show();
    setTimeout(() => el.fadeOut(), 3000);
  } else {
    el.stop().show().text(msg).css("background-color", "#f8d7da");
  }
}

/* ===== 滑到底部 ===== */
function scrollBottom() {
  const m = document.getElementById("chat-messages");
  if (m) {
    m.scrollTop = m.scrollHeight;
  }
}

/* ===== Markdown / Mermaid / Highlight 處理 ===== */
function format(txt) {
  txt = txt.trim();
  let html = marked.parse(txt);
  html = DOMPurify.sanitize(html);

  html = html.replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g, (m, c) => {
    const raw = c.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    return `<div class="mermaid-container"><button class="copy-btn" onclick="copyText(this,'${encodeURIComponent(
      raw
    )}')">複製</button><pre class="mermaid">${raw}</pre></div>`;
  });

  html = html.replace(/<pre><code class="language-([\w]+)">([\s\S]*?)<\/code><\/pre>/g, (m, l, c) => {
    if (l === "mermaid") return m;
    return `<div class="code-block"><button class="copy-btn" onclick="copyText(this,'${encodeURIComponent(
      c
    )}')">複製</button><pre><code class="language-${l} hljs">${c}</code></pre></div>`;
  });

  return html;
}

function renderCode() {
  requestAnimationFrame(() => {
    document.querySelectorAll("pre code").forEach((b) => hljs.highlightElement(b));
    mermaid.init(undefined, ".mermaid");
  });
}

function copyText(btn, encoded) {
  const text = decodeURIComponent(encoded);
  navigator.clipboard
    .writeText(text)
    .then(() => {
      btn.innerText = "已複製！";
      setTimeout(() => (btn.innerText = "複製"), 1500);
    })
    .catch(() => alert("複製失敗"));
}

/* ===== 畫面訊息渲染 ===== */
function addMessage(content, isMe, sender) {
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const html = `
    <div class="message ${isMe ? "user-message" : "other-message"} clearfix">
      ${!isMe ? `<div class="user-info"><span class="user-name">${sender}</span></div>` : ""}
      <div class="message-content">${format(content)}</div>
      <div class="message-time">${time}</div>
    </div>`;
  $("#chat-messages").append(html);
  renderCode();
  scrollBottom();
}

function addSystem(text) {
  $("#chat-messages").append(`<div class="connection-status text-center my-2 text-muted">${text}</div>`);
  scrollBottom();
}

/* ===== 顯示對方輸入狀態 ===== */
function showTyping(user) {
  if (user === username) return;
  const cls = "typing-" + user.replace(/\s+/g, "-");
  if ($("." + cls).length) {
    clearTimeout($("." + cls).data("timer"));
  } else {
    $("#chat-messages").append(
      `<div class="${cls} typing-indicator text-muted small my-1 font-italic">${user} 正在輸入 ...</div>`
    );
  }
  const timer = setTimeout(() => {
    $("." + cls).fadeOut(() => $("." + cls).remove());
  }, 3000);

  $("." + cls).data("timer", timer);
  scrollBottom();
}

/* ===== 發送訊息 ===== */
function send() {
  const inputEl = $("#message-input");
  const txt = inputEl.val().trim();
  if (!txt) return;

  addMessage(txt, true, username);

  socket.emit("send_message", {
    username: username,
    content: txt,
  });

  inputEl.val("").height("auto");
  scrollBottom();
}

/* ===== 輸入狀態監聽（打字時觸發） ===== */
let typingTimer;
$("#message-input").on("input", function () {
  this.style.height = "auto";
  this.style.height = this.scrollHeight + "px";

  if (!typingTimer) {
    socket.emit("typing", { username: username });
    typingTimer = setTimeout(() => (typingTimer = null), 1000);
  }
});

/* ===== 改暱稱功能 ===== */
$("#change-name-btn").on("click", () => {
  // 當使用者按下「改名稱」按鈕時觸發，彈出輸入框預設為目前名稱
  const v = prompt("輸入新名稱：", username);
  // 檢查：新名稱不能是空的或與舊名稱相同
  if (v && v.trim() && v !== username) {
    // 將舊名稱與新名稱發送給伺服器
    socket.emit("change_username", {
      oldUsername: username,
      newUsername: v.trim(),
    });
    // 更新本地端的使用者名稱變數並寫入 sessionStorage
    username = v.trim();
    sessionStorage.setItem("chat_username", username);
  }
});

/* ===== 按鍵與按鈕綁定 ===== */
$("#send-button").on("click", send);

$("#message-input").on("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

$("#clear-btn").on("click", () => {
  if (confirm("確定要清空聊天？")) $("#chat-messages").empty();
});

// 表情符號選單
$(".emoji-btn").on("click", function () {
  const emojis = ["😊", "😂", "😍", "👍", "❤️", "😉", "🎉", "👋"];
  if ($(".emoji-menu").length) {
    $(".emoji-menu").remove();
    return;
  }
  let menu = '<div class="emoji-menu p-2 bg-white rounded shadow position-absolute">';
  emojis.forEach((e) => (menu += `<span class="emoji-item p-1" style="cursor:pointer;font-size:1.5rem;">${e}</span>`));
  menu += "</div>";
  $(this).after(menu);

  $(".emoji-item").on("click", function () {
    $("#message-input").val($("#message-input").val() + $(this).text());
    $(".emoji-menu").remove();
  });

  $(document).one("click", (e) => {
    if (!$(e.target).closest(".emoji-btn, .emoji-menu").length) {
      $(".emoji-menu").remove();
    }
  });
});

/* ===== Socket.IO 事件接收 ===== */
socket.on("connect", () => {
  updateStatus(true);
  socket.emit("join", { username });
});

socket.on("disconnect", () => updateStatus(false, "連線中斷"));
socket.on("connect_error", () => updateStatus(false, "連線錯誤"));
socket.on("user_count", (d) => $("#online-count").text(d.count));
socket.on("user_joined", (d) => addSystem(`${d.username} 加入了聊天`));
socket.on("user_left", (d) => addSystem(`${d.username} 離開了聊天`));

/* ===== 接收改名事件 ===== */
socket.on("user_changed_name", (d) => {
  addSystem(`${d.oldUsername} 更名為 ${d.newUsername}`);
});

/* ===== 接收打字與聊天事件 ===== */
socket.on("typing", (d) => showTyping(d.username));

socket.on("chat_message", (d) => {
  const cls = "typing-" + d.username.replace(/\s+/g, "-");
  $("." + cls).remove();

  if (d.username !== username) {
    addMessage(d.content, false, d.username);
  }
});