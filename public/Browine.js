document.getElementById("post_img").addEventListener("click",postMessage
,false)


document.addEventListener('keydown', (event) => {
  const keyName = event.key;

  if (event.ctrlKey && keyName === "Enter") {
    postMessage();
  }
});


function postMessage(){
  const message = document.getElementById("message");
  
  if(message.value === ""){
    return
  }
  //要素を作成しクラスを追加  
  const li = document.createElement("li");
  li.classList.add("li-me");
  
  //子要素を作成しクラスを追加
  const span = document.createElement("span");
  span.innerHTML = message.value;
  span.classList.add("span-me");
  
  //作成した要素を合体させる
  li.appendChild(span)
  document.getElementById("body").appendChild(li);
  
  //textareaの値を削除
  message.value = '';
  
  //ページ最下部へ移動
  var element = document.documentElement;
  var bottom = element.scrollHeight - element.clientHeight;
  window.scroll(0, bottom);
};
