const yen = n => Number(n || 0).toLocaleString("ja-JP") + "円";

function bindImage(inputId, imgId){
  const input = document.getElementById(inputId);
  const img = document.getElementById(imgId);
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if(!file) return;
    const url = URL.createObjectURL(file);
    img.src = url;
    img.style.display = "block";
  });
}

bindImage("dailyCamera", "dailyPreview");
bindImage("dailyFile", "dailyPreview");
bindImage("receiptCamera", "receiptPreview");
bindImage("receiptFile", "receiptPreview");

document.querySelectorAll("[data-clear]").forEach(btn=>{
  btn.addEventListener("click",()=>{ document.getElementById(btn.dataset.clear).value = ""; });
});

function normalizeText(s){
  return (s || "")
    .replace(/[，,]/g, "")
    .replace(/[￥¥]/g, "¥")
    .replace(/[ー−―]/g, "-")
    .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
}

function extractAmounts(text){
  const src = normalizeText(text);
  const lines = src.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const items = [];

  for(const line of lines){
    const nums = [...line.matchAll(/(?:¥\s*)?(\d{3,6})(?:\s*円)?/g)]
      .map(m=>Number(m[1]))
      .filter(n => n >= 300 && n <= 200000);

    if(!nums.length) continue;

    const amount = nums[nums.length - 1];
    const noMatch = line.match(/^\s*(\d{1,3})[.)、\s]/);
    items.push({
      no: noMatch ? Number(noMatch[1]) : null,
      amount,
      raw: line,
      all: nums.join(" / ")
    });
  }
  return items;
}

function classify(dailyItem, receiptAmounts){
  const idx = receiptAmounts.findIndex(x => x.amount === dailyItem.amount && !x.used);
  if(idx >= 0){
    receiptAmounts[idx].used = true;
    return "cash";
  }
  return "credit";
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function render(){
  const dailyText = document.getElementById("dailyText").value;
  const receiptText = document.getElementById("receiptText").value;

  const daily = extractAmounts(dailyText);
  const receipts = extractAmounts(receiptText);
  const receiptCopy = receipts.map(x=>({...x, used:false}));

  let cashTotal = 0;
  let creditTotal = 0;

  const rows = daily.map((d, i)=>{
    const type = classify(d, receiptCopy);
    if(type === "cash") cashTotal += d.amount;
    else creditTotal += d.amount;
    return {...d, index:i+1, type};
  });

  const unused = receiptCopy.filter(x=>!x.used);
  const total = cashTotal + creditTotal;

  const summary = document.getElementById("summary");
  summary.classList.remove("hidden");
  summary.innerHTML = `
    <div class="status">
      完成しました。<br>
      明細金額：${receipts.length}件<br>
      日報参考数字：${daily.length}件<br>
      現金判定：${rows.filter(r=>r.type==="cash").length}件<br>
      未収判定：${rows.filter(r=>r.type==="credit").length}件<br>
      不明/空欄：${unused.length}件
    </div>
  `;

  const result = document.getElementById("result");
  result.classList.remove("hidden");
  result.innerHTML = `
    <h2>集計</h2>
    <div class="summary-grid">
      <div class="box">現金合計<b>${yen(cashTotal)}</b></div>
      <div class="box">未収合計<b>${yen(creditTotal)}</b></div>
      <div class="box">総合計<b>${yen(total)}</b></div>
      <div class="box">件数<b>${rows.length}</b></div>
    </div>

    <h2 style="margin-top:22px">照合結果</h2>
    <table class="table">
      <thead><tr><th>#</th><th>区分</th><th>金額</th><th>OCR行</th></tr></thead>
      <tbody>
        ${rows.map(r=>`
          <tr class="${r.type}">
            <td>${r.index}</td>
            <td>${r.type === "cash" ? "現金候補" : "未収/日報由来"}</td>
            <td>${yen(r.amount)}</td>
            <td style="text-align:left">${escapeHtml(r.raw)}</td>
          </tr>`).join("")}
      </tbody>
    </table>

    ${unused.length ? `
      <h2 style="margin-top:22px">日報に使われなかった明細候補</h2>
      <table class="table">
        <tbody>${unused.map(u=>`<tr class="warn"><td style="text-align:left">${escapeHtml(u.raw)}</td><td>${yen(u.amount)}</td></tr>`).join("")}</tbody>
      </table>` : ""}
  `;
}

document.getElementById("analyzeBtn").addEventListener("click", render);

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
