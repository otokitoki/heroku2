//自分自身の情報を入れる箱
const IAM = {
  token: null, // トークン
  name: null, // 名前
  is_join: false, // 入室中？
};

// メンバー一覧を入れる箱
const MEMBER = {
  0: "マスター",
};

// Socket.ioのクライアント用オブジェクトをセット
const socket = io();

//-------------------------------------
// STEP1. Socket.ioサーバへ接続
//-------------------------------------
/**
 * [イベント] トークンが発行されたら
 */
socket.on("token", (data) => {
  // トークンを保存
  IAM.token = data.token;

  // 表示を切り替える
  if (!IAM.is_join) {
    $("#nowconnecting").style.display = "none"; // 「接続中」を非表示
    $("#inputmyname").style.display = "block"; // 名前入力を表示
    $("#txt-myname").focus();
  }
});

//-------------------------------------
// STEP2. 名前の入力
//-------------------------------------
/**
 * [イベント] 名前入力フォームが送信された
 */
$("#frm-myname").addEventListener("submit", (e) => {
  // 規定の送信処理をキャンセル(画面遷移しないなど)
  e.preventDefault();

  // 入力内容を取得する
  const myname = $("#txt-myname");
  if (myname.value === "") {
    return false;
  }

  // 名前をセット
  IAM.name = myname.value;

  // Socket.ioサーバへ送信
  socket.emit("join", { token: IAM.token, name: IAM.name });

  // ボタンを無効にする
  $("#frm-myname button").setAttribute("disabled", "disabled");
});

/**
 * [イベント] 入室結果が返ってきた
 */
socket.on("join-result", (data) => {
  //------------------------
  // 正常に入室できた
  //------------------------
  if (data.status) {
    // 入室フラグを立てる
    IAM.is_join = true;

    // すでにログイン中のメンバー一覧を反映
    for (let i = 0; i < data.list.length; i++) {
      const cur = data.list[i];
      if (!(cur.token in MEMBER)) {
        addMemberList(cur.token, cur.name);
      }
    }
    //プッシュ通知の許可
    Push.Permission.request();

    // 表示を切り替える
    $("#inputmyname").style.display = "none"; // 名前入力を非表示
    $("#chat").style.display = "block"; // チャットを表示
    //$("#msg").focus();
  }
  //------------------------
  // できなかった
  //------------------------
  else {
    alert("入室できませんでした");
  }

  // ボタンを有効に戻す
  $("#frm-myname button").removeAttribute("disabled");
});

//-------------------------------------
// STEP3. チャット開始
//-------------------------------------
/**
 * [イベント] 発言フォームが送信された
 */
document
  .getElementById("post_img")
  .addEventListener("click", postMessage, false);

document.addEventListener("keydown", (event) => {
  const keyName = event.key;

  if (event.ctrlKey && keyName === "Enter") {
    postMessage();
  }
});

function postMessage() {
  // 入力内容を取得する
  const message = document.getElementById("message");

  if (message.value === "") {
    return false;
  }

  // Socket.ioサーバへ送信
  socket.emit("post", { text: message.value, token: IAM.token });

  //textareaの値を削除
  message.value = "";
}

/**
 * [イベント] 退室ボタンが押された
 */
$("#frm-quit").addEventListener("click", (e) => {
  // 規定の送信処理をキャンセル(画面遷移しないなど)
  e.preventDefault();

  if (confirm("本当に退室しますか？")) {
    // Socket.ioサーバへ送信
    socket.emit("quit", { token: IAM.token });

    // ボタンを無効にする
    $("#frm-quit").setAttribute("disabled", "disabled");
  }
});

/**
 * [イベント] 退室処理の結果が返ってきた
 */
socket.on("quit-result", (data) => {
  if (data.status) {
    gotoSTEP1();
  } else {
    alert("退室できませんでした");
  }

  // ボタンを有効に戻す 二度目の入室時に見えるようにするため
  $("#frm-quit").removeAttribute("disabled");
});

/**
 * [イベント] 誰かが入室した
 */
socket.on("member-join", (data) => {
  if (IAM.is_join) {
    addMessageFromMaster(`${data.name}さんが入室しました`);
    addMemberList(data.token, data.name);
    // 現在の人数を増やす
    memberCountChange();
  }
});

/**
 * [イベント] 誰かが退室した
 */
socket.on("member-quit", (data) => {
  if (IAM.is_join) {
    const name = MEMBER[data.token];
    addMessageFromMaster(`${name}さんが退室しました`);
    removeMemberList(data.token);
    // 現在の人数を減らす
    memberCountChange();
  }
});

/**
 * [イベント] 誰かが発言した
 */
socket.on("member-post", (msg) => {
  if (IAM.is_join) {
    const is_me = msg.token === IAM.token;
    addMessage(msg, is_me);
    // 誰かが発言したら一番下へ
    windowScrollBottom();
  }
});

/**
 * 最初の状態にもどす
 *
 * @return {void}
 */
function gotoSTEP1() {
  // NowLoadingから開始
  $("#nowconnecting").style.display = "block"; // NowLoadingを表示
  $("#inputmyname").style.display = "none"; // 名前入力を非表示
  $("#chat").style.display = "none"; // チャットを非表示

  // 自分の情報を初期化
  IAM.token = null;
  IAM.name = null;
  IAM.is_join = false;

  // メンバー一覧を初期化
  for (let key in MEMBER) {
    if (key !== "0") {
      delete MEMBER[key];
    }
  }

  // チャット内容を全て消す
  $("#txt-myname").value = ""; // 名前入力欄 STEP2
  //$("#myname").innerHTML = "";     // 名前表示欄 STEP3  ときが消しました。
  $("#message").value = ""; // 発言入力欄 STEP3
  $("#body").innerHTML = ""; // 発言リスト STEP3
  $("#memberlist").innerHTML = ""; // メンバーリスト STEP3

  // Socket.ioサーバへ再接続
  socket.close().open();
}

/**
 * 発言を表示する
 *
 * @param {object}  msg - {token:"abcd", text:"foo",time:"12:34"}
 * @param {boolean} [is_me=false]
 * @return {void}
 */
function addMessage(msg, is_me = false) {
  const li = document.createElement("li");
  const name = MEMBER[msg.token];

  // マスターの発言
  if (msg.token === 0) {
    li.classList.add("li-master");
    const span = document.createElement("span");
    span.innerText = msg.text;
    span.classList.add("span-master");
    li.appendChild(span);
  }
  // 自分の発言
  else if (is_me) {
    li.classList.add("li-me");
    // 仮想ツリー作成
    const docFrag = document.createDocumentFragment();
    // 時間を入れるspan要素を作成し仮想ツリーに追加
    const timeSpan = document.createElement("span");
    timeSpan.innerText = msg.time;
    timeSpan.classList.add("time");
    docFrag.appendChild(timeSpan);

    // メッセージを入れるspan要素作成し仮想ツリーに追加
    const span = document.createElement("span");
    span.innerText = msg.text;
    span.classList.add("span-me");
    docFrag.appendChild(span);

    // 仮想ツリーを実ツリーに追加しレンダリング
    li.appendChild(docFrag);
  }
  // それ以外の発言
  else {
    li.classList.add("li-member");
    // 仮想ツリー作成
    const docFrag = document.createDocumentFragment();
    // メンバーの名前を入れるspan作成し .member-name を追加し仮想ツリーに追加
    const memberNameSpan = document.createElement("span");
    memberNameSpan.classList.add("member-name");
    memberNameSpan.innerText = name;
    docFrag.appendChild(memberNameSpan);

    // brを作成し仮想ツリーに追加
    const br = document.createElement("br");
    docFrag.appendChild(br);

    // メッセージを入れるspanを作成し .span-member を追加し仮想ツリーに追加
    const span = document.createElement("span");
    span.classList.add("span-member");
    span.innerText = msg.text;
    docFrag.appendChild(span);

    // 時間を入れるspan要素を作成し仮想ツリーに追加
    const timeSpan = document.createElement("span");
    timeSpan.innerText = msg.time;
    timeSpan.classList.add("time");
    docFrag.appendChild(timeSpan);

    // 仮想ツリーを実ツリーに追加しレンダリング
    li.appendChild(docFrag);
    //通知
    if (Push.Permission.has()) {
      console.log(name);
      Push.create(name || "不明なメンバー", {
        icon: "Browine_icon.png",
        body: msg.text,
        timeout: 8000, // 通知が消えるタイミング
        onClick: function () {
          // 通知がクリックされた場合の設定
          console.log(this);
        },
      });
    }
  }

  // リストの最初に追加
  document.getElementById("body").appendChild(li);
}
//   //要素を作成しクラスを追加
//   const li = document.createElement("li");
//   li.classList.add("li-me");

//   //子要素を作成しクラスを追加
//   const span = document.createElement("span");
//   span.innerHTML = message.value;
//   span.classList.add("span-me");

//   //作成した要素を合体させる
//   li.appendChild(span)
//   document.getElementById("body").appendChild(li);

/**
 * チャットマスターの発言
 *
 * @param {string} msg
 * @return {void}
 */
function addMessageFromMaster(msg) {
  addMessage({ token: 0, text: msg });
}

/**
 * メンバーリストに追加
 *
 * @param {string} token
 * @param {string} name
 * @return {void}
 */
function addMemberList(token, name) {
  const list = $("#memberlist");
  const li = document.createElement("li");
  li.setAttribute("id", `member-${token}`);
  const span = document.createElement("span");
  if (token == IAM.token) {
    span.innerText = name;
    li.appendChild(span);
  } else {
    li.innerText = name;
  }

  // リストの最後に追加
  list.appendChild(li);

  // 内部変数に保存
  MEMBER[token] = name;
}

/**
 * メンバーリストから削除
 *
 * @param {string} token
 * @return {void}
 */
function removeMemberList(token) {
  const id = `#member-${token}`;
  if ($(id) !== null) {
    $(id).parentNode.removeChild($(id));
  }

  // 内部変数から削除
  delete MEMBER[token];
}

//メンバーのスライドメニューについてのjs
const btn = document.querySelector(".btn-menu");
const nav = document.querySelector("nav");

btn.addEventListener("click", () => {
  nav.classList.toggle("open-menu");

  if (btn.innerText === "参加者一覧") {
    btn.innerText = "閉じる";
  } else {
    btn.innerText = "参加者一覧";
  }
});

//ページ最下部へ移動
function windowScrollBottom() {
  var element = document.documentElement;
  var bottom = element.scrollHeight - element.clientHeight;
  window.scroll(0, bottom);
}

// 現在の人数を変更する（画面右上）
const memberCountChange = () => {
  // MEMBERオブジェクトの長さを取得し埋め込む
  const memberCount = Object.keys(MEMBER).length - 1;
  $("#member-count").innerText = memberCount;
};

window.addEventListener(
  "beforeunload",
  function (eve) {
    socket.emit("quit", { token: IAM.token });
  },
  false
);
