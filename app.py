from flask import Flask, render_template, request  # 匯入 flask 相關套件
from flask_socketio import SocketIO, emit  # 匯入 flask SocketIO 相關套件

app = Flask(__name__)

# 初始化 SocketIO ，允許跨域連線，並指定使用 eventlet 非同步模式
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

# 紀錄線上使用者 { sid: {"username": str} }
clients = {}

@app.route("/")
def index():
    return render_template("index.html")

# ===== SocketIO 📡 事件處理區 =====

# 計算目前線上已設定使用者名稱的數量，並廣播更新給所有人
def broadcast_user_count():
    count = len([c for c in clients.values() if c.get("username")])
    socketio.emit("user_count", {"count": count})

# ✅ 用戶連線時觸發
@socketio.on("connect")
def on_connect():
    clients[request.sid] = {"username": None}
    print("Client connect:", request.sid)

# 👤 使用者剛進入聊天室時觸發，會發送他的使用者名稱
@socketio.on("join")
def on_join(data):
    username = data.get("username", "匿名")
    if request.sid in clients:
        clients[request.sid]["username"] = username
    socketio.emit("user_joined", {"username": username})
    broadcast_user_count()
    print(username, "joined")

# 💬 使用者傳送訊息時觸發
@socketio.on("send_message")
def on_message(data):
    """
    將訊息廣播給所有人（不包含自己，因為自己會先在畫面立即顯示）
    """
    emit("chat_message", data, broadcast=True, include_self=False)

# ✍️ 使用者正在輸入時觸發
@socketio.on("typing")
def on_typing(data):
    # 廣播「某人正在輸入」的狀態給其他人（不含自己）
    emit("typing", data, broadcast=True, include_self=False)

# 🔄 使用者更改名稱時觸發
@socketio.on("change_username")
def on_change(data):
    old = data.get("oldUsername")  # 原本的名稱
    new = data.get("newUsername")  # 新名稱

    # 如果這個 SID 還在 clients 裡，更新名稱
    if request.sid in clients:
        clients[request.sid]["username"] = new

    # 廣播名稱變更事件給所有人
    emit(
        "user_changed_name",
        {"oldUsername": old, "newUsername": new},
        broadcast=True,
    )

# ❌ 用戶離線時觸發
@socketio.on("disconnect")
def on_disconnect():
    info = clients.pop(request.sid, None)
    if info and info.get("username"):
        socketio.emit("user_left", {"username": info["username"]})
    broadcast_user_count()
    print("Client disconnect:", request.sid)

# 伺服器啟動入口（必須放在整份檔案最底部）
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)