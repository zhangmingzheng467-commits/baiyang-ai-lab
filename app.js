(() => {
  "use strict";

  const STORAGE_KEY = "baiyang-ai-lab-works-v1";
  const LOCAL_ADMIN_PASSWORD = "baiyang2026";
  const ADMIN_TOKEN_KEY = "baiyang-supabase-admin-token";
  const ADMIN_EMAIL_KEY = "baiyang-supabase-admin-email";
  const types = ["全部", "网站/小程序", "视频内容", "设计图片", "AI工具/Prompt", "写作/文案", "其他"];
  const seedWorks = [
    {id:"court-zero",title:"COURT ZERO",type:"网站/小程序",summary:"把街头篮球、青年文化和线下连接装进一个持续生长的数字球场。",description:"一个围绕街头篮球文化展开的长期项目。\n\n它不是传统意义上的品牌官网，更像是一个青年文化的入口：记录球场、人物和真实发生的故事，也试着用 AI 提高内容生产和产品验证的速度。",tools:["Claude","Codex"],author:"白杨",city:"贵阳",bio:"青年自媒体创业者，喜欢把想法先做出来",url:"",images:[],status:"approved",joinGroup:"愿意",wechat:"站长本人",createdAt:"2026-06-12T10:00:00.000Z",accent:"#b93627",glyph:"场"},
    {id:"local-ai-service",title:"AI 本地服务实验",type:"AI工具/Prompt",summary:"研究 AI 怎样真正进入贵阳小生意，而不是停在一场热闹的演示里。",description:"从身边真实的小生意出发，寻找 AI 能立刻帮上忙的环节：内容、客服、资料整理和工作流。\n\n目前仍在持续访谈与验证。标准很简单——老板愿不愿意继续用，它有没有真的省下一点时间。",tools:["ChatGPT","Claude"],author:"白杨",city:"贵阳",bio:"青年自媒体创业者",url:"",images:[],status:"approved",joinGroup:"愿意",wechat:"站长本人",createdAt:"2026-06-08T10:00:00.000Z",accent:"#c79539",glyph:"用"},
    {id:"content-workflow",title:"一人内容工作流",type:"视频内容",summary:"把选题、脚本、画面和复盘串成一套一人也能跑起来的内容系统。",description:"这是我在做抖音内容时不断调整的一套工作流。AI 不替人表达，但可以帮人更快地找到结构、拆解反馈，把精力留给真正重要的判断。\n\n这个项目会继续公开迭代，记录好用的方法，也记录那些看起来聪明但实际没用的弯路。",tools:["Claude","即梦"],author:"白杨",city:"贵阳",bio:"内容创作者",url:"",images:[],status:"approved",joinGroup:"愿意",wechat:"站长本人",createdAt:"2026-06-03T10:00:00.000Z",accent:"#526f5d",glyph:"创"}
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const cloudConfig = window.BAIYANG_SUPABASE || {};
  const cloudEnabled = Boolean(cloudConfig.url && cloudConfig.anonKey);
  const bucketName = cloudConfig.bucket || "work-images";
  let activeType = "全部";
  let uploadedImages = [];
  let uploadedFiles = [];
  let adminStatus = "pending";
  let adminUnlocked = cloudEnabled ? Boolean(sessionStorage.getItem(ADMIN_TOKEN_KEY)) : sessionStorage.getItem("baiyang-admin") === "yes";
  let worksCache = null;
  let adminWorksCache = null;

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("zh-CN", {year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));
  }

  function showToast(message) {
    const toast = $("[data-toast]");
    toast.textContent = message;
    toast.classList.add("is-showing");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("is-showing"), 2600);
  }

  function toCamel(row) {
    return {
      id: row.id,
      title: row.title,
      type: row.type,
      url: row.url || "",
      summary: row.summary,
      description: row.description || "",
      tools: row.tools || [],
      images: row.images || [],
      author: row.author,
      wechat: row.wechat || "",
      city: row.city || "",
      bio: row.bio || "",
      joinGroup: row.join_group || row.joinGroup || "",
      status: row.status,
      createdAt: row.created_at || row.createdAt,
      accent: row.accent || "#b93627",
      glyph: row.glyph || (row.title || "").slice(0, 1)
    };
  }

  function toRow(work, includePrivate = true) {
    const row = {
      title: work.title,
      type: work.type,
      url: work.url || "",
      summary: work.summary,
      description: work.description || "",
      tools: work.tools || [],
      images: work.images || [],
      author: work.author,
      city: work.city || "",
      bio: work.bio || "",
      status: work.status || "pending",
      accent: work.accent || "#b93627",
      glyph: work.glyph || work.title.slice(0, 1)
    };
    if (work.id) row.id = work.id;
    if (work.createdAt) row.created_at = work.createdAt;
    if (includePrivate) {
      row.wechat = work.wechat || "";
      row.join_group = work.joinGroup || "";
    }
    return row;
  }

  function cloudHeaders(token = null) {
    const headers = {
      apikey: cloudConfig.anonKey,
      "Content-Type": "application/json"
    };
    headers.Authorization = `Bearer ${token || cloudConfig.anonKey}`;
    return headers;
  }

  function cloudAuthHeaders() {
    return {
      apikey: cloudConfig.anonKey,
      "Content-Type": "application/json"
    };
  }

  function fetchWithTimeout(url, options = {}, timeout = 30000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    return fetch(url, {...options, signal: controller.signal}).finally(() => clearTimeout(timer));
  }

  async function cloudRequest(path, options = {}) {
    const {timeout, ...fetchOptions} = options;
    const response = await fetchWithTimeout(`${cloudConfig.url.replace(/\/$/, "")}${path}`, fetchOptions, timeout || 30000);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || response.statusText);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  function getLocalWorks() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(saved) ? saved : seedWorks;
    } catch {
      return seedWorks;
    }
  }

  function saveLocalWorks(works) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(works));
  }

  if (!localStorage.getItem(STORAGE_KEY)) saveLocalWorks(seedWorks);

  async function loadWorks(force = false) {
    if (!cloudEnabled) return getLocalWorks();
    if (worksCache && !force) return worksCache;
    try {
      const rows = await cloudRequest("/rest/v1/works_public?select=*&status=eq.approved&order=created_at.desc", {
        headers: cloudHeaders()
      });
      worksCache = rows.map(toCamel);
    } catch (error) {
      console.warn("Cloud works unavailable, falling back to local works.", error);
      worksCache = getLocalWorks();
    }
    return worksCache;
  }

  async function loadAdminWorks(force = false) {
    if (!cloudEnabled) return getLocalWorks();
    if (adminWorksCache && !force) return adminWorksCache;
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    const rows = await cloudRequest("/rest/v1/work_submissions?select=*&order=created_at.desc", {
      headers: cloudHeaders(token)
    });
    adminWorksCache = rows.map(toCamel);
    return adminWorksCache;
  }

  function generatedCover(work) {
    return `<div class="generated-cover" style="--accent:${escapeHTML(work.accent || "#b93627")}"><span class="cover-glyph">${escapeHTML(work.glyph || work.title.slice(0,1))}</span></div>`;
  }

  function coverHTML(work) {
    return work.images?.[0] ? `<img src="${escapeHTML(work.images[0])}" alt="${escapeHTML(work.title)}封面">` : generatedCover(work);
  }

  function renderFilters() {
    $("[data-filters]").innerHTML = types.map(type => `<button type="button" class="${type === activeType ? "is-active" : ""}" data-filter="${type}">${type}</button>`).join("");
  }

  async function renderGallery() {
    renderFilters();
    const gallery = $("[data-gallery]");
    const empty = $("[data-gallery-empty]");
    gallery.innerHTML = `<div class="gallery-empty"><h3>正在读取作品...</h3></div>`;
    try {
      const works = (await loadWorks()).filter(w => w.status === "approved" && (activeType === "全部" || w.type === activeType));
      empty.hidden = works.length !== 0;
      gallery.innerHTML = works.map((work, index) => `<article class="work-card reveal is-visible" tabindex="0" role="link" data-work-id="${escapeHTML(work.id)}">
        <div class="work-card-cover">${coverHTML(work)}</div><div class="work-card-gradient"></div><span class="work-arrow">↗</span>
        <div class="work-card-content"><div class="work-card-meta"><span>${String(index + 1).padStart(2,"0")} / ${escapeHTML(work.type)}</span><span>${escapeHTML(work.city || "贵阳")}</span></div><h3>${escapeHTML(work.title)}</h3><p>${escapeHTML(work.summary)}</p><div class="work-tools">${(work.tools || []).map(t => `<span>${escapeHTML(t)}</span>`).join("")}</div></div>
      </article>`).join("");
    } catch (error) {
      gallery.innerHTML = `<div class="gallery-empty"><h3>作品读取失败</h3><p>${escapeHTML(error.message)}</p></div>`;
      empty.hidden = true;
    }
  }

  function setView(name, options = {}) {
    $$("[data-view]").forEach(v => v.classList.toggle("is-active", v.dataset.view === name));
    document.body.dataset.page = name;
    if (name === "home") { renderGallery().then(() => initReveal()); }
    if (name === "detail") renderDetail(options.id);
    if (name === "admin") renderAdmin();
    window.scrollTo({top:0,behavior: options.instant ? "auto" : "smooth"});
  }

  function routeFromHash() {
    const hash = location.hash.replace(/^#/, "");
    if (hash.startsWith("work/")) return setView("detail", {id:decodeURIComponent(hash.slice(5)),instant:true});
    if (["submit","success","admin"].includes(hash)) return setView(hash, {instant:true});
    setView("home", {instant:true});
    if (hash && !["home"].includes(hash)) setTimeout(() => document.getElementById(hash)?.scrollIntoView(), 40);
  }

  function go(route) {
    location.hash = route === "home" ? "home" : route;
  }

  async function renderDetail(id) {
    const container = $("[data-detail]");
    container.innerHTML = `<section class="success-page shell"><h1>读取中...</h1></section>`;
    const work = (await loadWorks()).find(w => w.id === id && w.status === "approved");
    if (!work) {
      container.innerHTML = `<section class="success-page shell"><h1>没找到。</h1><p>这个作品可能还在路上，或尚未通过审核。</p><button class="button button-dark" data-route="home">返回首页</button></section>`;
      return;
    }
    const images = (work.images || []).slice(1);
    container.innerHTML = `<section class="detail-hero"><div class="detail-cover">${coverHTML(work)}</div><div class="shell detail-head"><button class="back-link" data-route="home">← 返回作品墙</button><div class="detail-meta"><span>${escapeHTML(work.type)}</span><span>·</span><span>${formatDate(work.createdAt)}</span></div><h1>${escapeHTML(work.title)}</h1><p>${escapeHTML(work.summary)}</p></div></section>
      <section class="detail-body"><div class="shell detail-layout"><article class="detail-story"><h2>关于这个作品</h2><p>${escapeHTML(work.description || "作者还没有写下更多介绍。作品本身，先替他开口。")}</p>${images.length ? `<div class="detail-images">${images.map(src => `<img src="${escapeHTML(src)}" alt="${escapeHTML(work.title)}作品截图">`).join("")}</div>` : ""}</article><aside class="detail-aside"><div class="detail-fact"><span>CREATOR</span><b>${escapeHTML(work.author)}</b></div><div class="detail-fact"><span>FROM</span><b>${escapeHTML(work.city || "未填写")}</b></div><div class="detail-fact"><span>AI TOOLS</span><b>${escapeHTML((work.tools || []).join(" / ") || "未填写")}</b></div>${work.bio ? `<div class="detail-fact"><span>ABOUT</span><b>${escapeHTML(work.bio)}</b></div>` : ""}${work.url ? `<div class="detail-fact"><span>VISIT</span><a href="${escapeHTML(work.url)}" target="_blank" rel="noopener">打开作品 ↗</a></div>` : ""}</aside></div></section>
      <section class="detail-cta"><div class="shell"><h2>这个作品打动你了？</h2><p>站内还有更多贵阳本地 AI 玩家的实验作品。如果你也在做点什么，欢迎投稿一起玩。</p><button class="button button-dark" data-route="submit">去投稿 <span>↗</span></button><button class="button" data-open-qr>加入交流群</button></div></section>`;
  }

  function initUpload() {
    const input = $("input[name=images]");
    const zone = $("[data-upload-zone]");
    if (!input) return;
    input.addEventListener("change", () => processFiles([...input.files]));
    ["dragenter","dragover"].forEach(type => zone.addEventListener(type, event => {event.preventDefault();zone.classList.add("is-dragging");}));
    ["dragleave","drop"].forEach(type => zone.addEventListener(type, event => {event.preventDefault();zone.classList.remove("is-dragging");}));
    zone.addEventListener("drop", event => processFiles([...event.dataTransfer.files]));
  }

  async function processFiles(files) {
    const images = files.filter(f => f.type.startsWith("image/"));
    if (uploadedImages.length + images.length > 3) { showToast("最多上传 3 张图片"); return; }
    for (const file of images) {
      if (file.size > 15 * 1024 * 1024) { showToast(`${file.name} 超过 15MB`); continue; }
      try {
        const compressed = await compressImage(file);
        uploadedImages.push(compressed.dataUrl);
        uploadedFiles.push(compressed.blob);
      } catch {
        showToast(`${file.name} 读取失败`);
      }
    }
    renderPreviews();
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const max = 1400;
          const ratio = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => {
            if (!blob) return reject(new Error("图片压缩失败"));
            resolve({blob, dataUrl: canvas.toDataURL("image/jpeg", .78)});
          }, "image/jpeg", .78);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function renderPreviews() {
    $("[data-upload-previews]").innerHTML = uploadedImages.map((src,i) => `<div class="upload-preview"><img src="${src}" alt="预览图 ${i+1}"><button type="button" data-remove-image="${i}" aria-label="移除">×</button></div>`).join("");
  }

  function validateForm(form) {
    $$('[aria-invalid="true"]', form).forEach(el => el.removeAttribute("aria-invalid"));
    const required = $$('[required]', form);
    let firstInvalid = null;
    required.forEach(field => {
      const invalid = field.type === "radio" ? !form.querySelector(`[name="${field.name}"]:checked`) : field.type === "file" ? !uploadedImages.length : !field.value.trim();
      if (invalid) { field.setAttribute("aria-invalid","true"); firstInvalid ||= field; }
    });
    const url = form.elements.url;
    if (url.value && !url.validity.valid) { url.setAttribute("aria-invalid","true"); firstInvalid ||= url; }
    if (!uploadedImages.length) firstInvalid ||= form.elements.images;
    if (firstInvalid) { firstInvalid.closest(".field")?.scrollIntoView({behavior:"smooth",block:"center"}); return false; }
    return true;
  }

  async function uploadCloudImages() {
    const urls = [];
    for (let index = 0; index < uploadedFiles.length; index += 1) {
      const path = `works/${Date.now()}-${index}.jpg`;
      const response = await fetchWithTimeout(`${cloudConfig.url.replace(/\/$/, "")}/storage/v1/object/${bucketName}/${path}`, {
        method: "POST",
        headers: {
          apikey: cloudConfig.anonKey,
          Authorization: `Bearer ${cloudConfig.anonKey}`,
          "Content-Type": "image/jpeg",
          "x-upsert": "false"
        },
        body: uploadedFiles[index]
      });
      if (!response.ok) throw new Error(await response.text());
      urls.push(`${cloudConfig.url.replace(/\/$/, "")}/storage/v1/object/public/${bucketName}/${path}`);
    }
    return urls;
  }

  async function submitWork(form) {
    const error = $("[data-form-error]");
    if (!validateForm(form)) { error.textContent = "还有必填项没有完成，请看看标红的位置。"; return; }
    error.textContent = cloudEnabled ? "正在上传到云端，请稍等..." : "";
    const data = new FormData(form);
    const tools = $$("[data-tools] input:checked").map(x => x.value);
    if (data.get("customTool")?.trim()) tools.push(data.get("customTool").trim());
    const work = {title:data.get("title").trim(),type:data.get("type"),url:data.get("url").trim(),summary:data.get("summary").trim(),description:data.get("description").trim(),tools,images:uploadedImages,author:data.get("author").trim(),wechat:data.get("wechat").trim(),city:data.get("city").trim(),bio:data.get("bio").trim(),joinGroup:data.get("joinGroup"),status:"pending",createdAt:new Date().toISOString(),accent:"#b93627",glyph:data.get("title").trim().slice(0,1)};
    try {
      if (cloudEnabled) {
        work.images = await uploadCloudImages();
        await cloudRequest("/rest/v1/work_submissions", {
          method: "POST",
          headers: {...cloudHeaders(), Prefer: "return=minimal"},
          body: JSON.stringify(toRow(work, true))
        });
      } else {
        work.id = `work-${Date.now()}`;
        const works = getLocalWorks();
        works.unshift(work);
        saveLocalWorks(works);
      }
    } catch (submitError) {
      error.textContent = `提交失败：${submitError.message}`;
      return;
    }
    form.reset();
    form.elements.city.value = "贵阳";
    uploadedImages = [];
    uploadedFiles = [];
    renderPreviews();
    error.textContent = "";
    go("success");
  }

  async function cloudAdminLogin(email, password) {
    const result = await cloudRequest("/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: cloudAuthHeaders(),
      body: JSON.stringify({email, password}),
      timeout: 12000
    });
    sessionStorage.setItem(ADMIN_TOKEN_KEY, result.access_token);
    sessionStorage.setItem(ADMIN_EMAIL_KEY, email);
  }

  async function renderAdmin() {
    $("[data-admin-login]").hidden = adminUnlocked;
    $("[data-admin-dashboard]").hidden = !adminUnlocked;
    if (!adminUnlocked) return;
    try {
      const works = await loadAdminWorks(true);
      const counts = {all:works.length,pending:works.filter(w=>w.status==="pending").length,approved:works.filter(w=>w.status==="approved").length,rejected:works.filter(w=>w.status==="rejected").length};
      $("[data-admin-stats]").innerHTML = [["待审核",counts.pending],["已上墙",counts.approved],["未通过",counts.rejected],["全部作品",counts.all]].map(([k,v])=>`<div class="stat-card"><span>${k}</span><b>${v}</b></div>`).join("");
      $$("[data-admin-filters] button").forEach(b => b.classList.toggle("is-active", b.dataset.status === adminStatus));
      const join = $("[data-join-filter]").value;
      const filtered = works.filter(w => (adminStatus === "all" || w.status === adminStatus) && (join === "all" || w.joinGroup === join));
      $("[data-admin-list]").innerHTML = filtered.length ? filtered.map(work => `<article class="admin-card"><div class="admin-thumb">${coverHTML(work)}</div><div class="admin-main"><h3>${escapeHTML(work.title)}</h3><p>${escapeHTML(work.summary)}</p><div class="admin-meta"><span>${escapeHTML(work.type)}</span><span>投稿人：${escapeHTML(work.author)}</span><span>微信：${escapeHTML(work.wechat)}</span><span class="${work.joinGroup === "愿意" ? "join-yes" : ""}">入群：${escapeHTML(work.joinGroup)}</span><span>${formatDate(work.createdAt)}</span></div></div><div class="admin-actions">${work.status !== "approved" ? `<button class="approve" data-review="approved" data-id="${work.id}">通过上墙</button>` : ""}${work.status !== "rejected" ? `<button class="reject" data-review="rejected" data-id="${work.id}">拒绝</button>` : ""}${work.status !== "pending" ? `<button data-review="pending" data-id="${work.id}">退回待审</button>` : ""}</div></article>`).join("") : `<div class="admin-empty">这一栏目前是空的。</div>`;
    } catch (error) {
      $("[data-admin-list]").innerHTML = `<div class="admin-empty">云端审核台读取失败：${escapeHTML(error.message)}</div>`;
    }
  }

  async function reviewWork(id, status) {
    if (!cloudEnabled) {
      const works = getLocalWorks();
      const work = works.find(w => w.id === id);
      if (!work) return;
      work.status = status;
      saveLocalWorks(works);
      renderAdmin();
      showToast(status === "approved" ? "已通过，作品现在会出现在作品墙" : status === "rejected" ? "已标记为未通过" : "已退回待审核");
      return;
    }

    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    const works = await loadAdminWorks(true);
    const work = works.find(w => w.id === id);
    if (!work) return;
    await cloudRequest(`/rest/v1/work_submissions?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {...cloudHeaders(token), Prefer: "return=minimal"},
      body: JSON.stringify({status})
    });
    if (status === "approved") {
      await cloudRequest("/rest/v1/works_public?on_conflict=id", {
        method: "POST",
        headers: {...cloudHeaders(token), Prefer: "resolution=merge-duplicates,return=minimal"},
        body: JSON.stringify(toRow({...work, status:"approved"}, false))
      });
    } else {
      await cloudRequest(`/rest/v1/works_public?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: cloudHeaders(token)
      });
    }
    worksCache = null;
    adminWorksCache = null;
    renderAdmin();
    showToast(status === "approved" ? "已通过，作品现在会出现在作品墙" : status === "rejected" ? "已标记为未通过" : "已退回待审核");
  }

  let revealObserver;
  function initReveal() {
    revealObserver?.disconnect();
    if (!("IntersectionObserver" in window)) { $$(".reveal").forEach(el=>el.classList.add("is-visible")); return; }
    revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {if(entry.isIntersecting){entry.target.classList.add("is-visible");revealObserver.unobserve(entry.target);}}),{threshold:.08,rootMargin:"0px 0px -35px"});
    $$(".reveal:not(.is-visible)").forEach(el=>revealObserver.observe(el));
  }

  document.addEventListener("click", event => {
    const route = event.target.closest("[data-route]"); if (route) { go(route.dataset.route); return; }
    const filter = event.target.closest("[data-filter]"); if (filter) { activeType = filter.dataset.filter; renderGallery(); return; }
    const card = event.target.closest("[data-work-id]"); if (card) { go(`work/${encodeURIComponent(card.dataset.workId)}`); return; }
    const remove = event.target.closest("[data-remove-image]"); if (remove) { uploadedImages.splice(Number(remove.dataset.removeImage),1); uploadedFiles.splice(Number(remove.dataset.removeImage),1); renderPreviews(); return; }
    const qrOpen = event.target.closest("[data-open-qr]"); if (qrOpen) { $("[data-qr-modal]").classList.add("is-open"); $("[data-qr-modal]").setAttribute("aria-hidden","false"); return; }
    if (event.target.closest("[data-close-qr]") || event.target === $("[data-qr-modal]")) { $("[data-qr-modal]").classList.remove("is-open"); $("[data-qr-modal]").setAttribute("aria-hidden","true"); return; }
    const review = event.target.closest("[data-review]"); if (review) reviewWork(review.dataset.id, review.dataset.review);
  });

  document.addEventListener("keydown", event => {
    const card = event.target.closest("[data-work-id]");
    if (card && (event.key === "Enter" || event.key === " ")) {event.preventDefault();go(`work/${encodeURIComponent(card.dataset.workId)}`);}
    if(event.key === "Escape") $("[data-qr-modal]").classList.remove("is-open");
  });

  $("[data-nav-toggle]").addEventListener("click", () => {
    const open = $("[data-header]").classList.toggle("nav-open");
    $("[data-nav-toggle]").setAttribute("aria-expanded",String(open));
  });
  $("[data-nav-links]").addEventListener("click", () => $("[data-header]").classList.remove("nav-open"));
  window.addEventListener("scroll", () => $("[data-header]").classList.toggle("is-scrolled",scrollY>18),{passive:true});
  window.addEventListener("hashchange", routeFromHash);
  $("[data-submit-form]").addEventListener("submit", event => {event.preventDefault();submitWork(event.currentTarget);});
  $$('[maxlength]').forEach(input => input.addEventListener("input", () => {
    const key = input.name === "summary" ? "summary" : input.name === "bio" ? "bio" : null;
    if(key) $(`[data-count="${key}"]`).textContent = input.value.length;
  }));
  $("[data-admin-login-form]").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(event.currentTarget);
    const error = $("[data-admin-error]");
    const submitButton = form.querySelector('button[type="submit"]');
    const submitText = submitButton.textContent;
    error.textContent = "";
    submitButton.disabled = true;
    submitButton.textContent = "正在进入审核台...";
    try {
      if (cloudEnabled) {
        const email = data.get("email").trim();
        if (!email) {
          error.textContent = "云端审核需要填写管理员邮箱。";
          submitButton.disabled = false;
          submitButton.textContent = submitText;
          return;
        }
        await cloudAdminLogin(email, data.get("password"));
      } else if (data.get("password") !== LOCAL_ADMIN_PASSWORD) {
        error.textContent = "密码不对，再想想。";
        submitButton.disabled = false;
        submitButton.textContent = submitText;
        return;
      } else {
        sessionStorage.setItem("baiyang-admin","yes");
      }
      adminUnlocked = true;
      if (location.hash !== "#admin") history.replaceState(null, "", "#admin");
      await renderAdmin();
      $("[data-admin-dashboard]").scrollIntoView({block: "start"});
    } catch (loginError) {
      const message = loginError.name === "AbortError"
        ? "浏览器连接 Supabase 超时。账号密码没问题，建议先关闭翻译/插件，或换一个浏览器再试。"
        : loginError.message;
      error.textContent = `登录失败：${message}`;
      submitButton.disabled = false;
      submitButton.textContent = submitText;
    }
  });
  $("[data-admin-logout]").addEventListener("click",()=>{
    adminUnlocked = false;
    sessionStorage.removeItem("baiyang-admin");
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_EMAIL_KEY);
    renderAdmin();
  });
  $("[data-admin-filters]").addEventListener("click",event=>{
    const button = event.target.closest("button");
    if(button){adminStatus = button.dataset.status; renderAdmin();}
  });
  $("[data-join-filter]").addEventListener("change",renderAdmin);
  initUpload();
  routeFromHash();
  initReveal();
})();
