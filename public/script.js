

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    credentials: "same-origin",
    ...options
  });

  if (res.status === 401) {
    // DOAR dacă NU suntem deja pe login
    if (!location.pathname.endsWith("login.html")) {
      location.href = "login.html";
    }
    throw new Error("Neautentificat");
  }

  return res;
}


async function initLoginPage() {
  if (!location.pathname.endsWith("login.html")) return;

  const btn = document.getElementById("btnLogin");
  const msg = document.getElementById("loginMsg");

  btn.onclick = async () => {
    msg.textContent = "";

    const username = document.getElementById("loginUser").value.trim();
    const password = document.getElementById("loginPass").value;

    const res = await apiFetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
      msg.textContent = data.error || "Eroare la login";
      return;
    }

    location.href = "index.html";
  };
}
async function initRegister() {
  const btn = document.getElementById("btnRegister");
  if (!btn) return;

  const msg = document.getElementById("registerMsg");

  btn.onclick = async () => {
    msg.textContent = "";

    const username = document.getElementById("regUser").value.trim();
    const password = document.getElementById("regPass").value;

    if (!username || !password) {
      msg.textContent = "Completează toate câmpurile";
      return;
    }

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      msg.textContent = data.error || "Eroare";
      return;
    }

    alert("Cont creat. Te poți loga.");
    location.reload();
  };
}


async function protectPage() {
  if (location.pathname.endsWith("login.html")) return;

  let me;
  try {
    const res = await apiFetch("/api/me");
    me = await res.json();
  } catch {
    return; // apiFetch deja redirecționează
  }

  if (!me.loggedIn) {
    location.href = "login.html";
  }
}

async function renderUserBar() {
  const bar = document.getElementById("userBar");
  if (!bar) return;

  const res = await apiFetch("/api/me");
  const me = await res.json();

  if (!me.loggedIn) {
    bar.innerHTML = "";
    return;
  }

  bar.innerHTML = `
    <div style="text-align:right">
      👤 ${me.user.username} (${me.user.role})
      <button id="btnLogout">Logout</button>
    </div>
  `;

  document.getElementById("btnLogout").onclick = async () => {
    await apiFetch("/api/logout", { method: "POST" });
    location.href = "login.html";
  };
}



let stockMap = {};
const LOW_STOCK_LIMIT = 30;


// ================= STORAGE =================
function getSelectedClient() {
  try {
    return JSON.parse(localStorage.getItem("clientSelectat"));
  } catch {
    return null;
  }
}

function setSelectedClient(client) {
  const cart = getCart();
  if (cart.length > 0) {
    alert("Nu poți schimba clientul cât timp există produse în coș.");
    return false;
  }
  localStorage.setItem("clientSelectat", JSON.stringify(client));
  return true;
}

function getCart() {
  try {
    const cart = JSON.parse(localStorage.getItem("cart"));
    return Array.isArray(cart) ? cart : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function clearCart() {
  localStorage.setItem("cart", JSON.stringify([]));
}


// ================= CART =================


function incQty(id) {
  const cart = getCart();
  const p = cart.find(x => x.id === id);
  if (p) p.qty++;
  saveCart(cart);
  renderCart();
}

function decQty(id) {
  const cart = getCart();
  const p = cart.find(x => x.id === id);
  if (!p) return;

  p.qty--;
  if (p.qty <= 0) cart.splice(cart.indexOf(p), 1);

  saveCart(cart);
  renderCart();
}
function setQty(id, value) {
  const cart = getCart();
  const p = cart.find(x => x.id === id);
  if (!p) return;

  const qty = parseInt(value, 10);

  if (isNaN(qty) || qty <= 0) {
    removeItem(id);
    return;
  }

  p.qty = qty;
  saveCart(cart);
  renderCart();
}


function removeItem(id) {
  saveCart(getCart().filter(x => x.id !== id));
  renderCart();
}

function renderCart() {
  const box = document.getElementById("cartBox");
  const totalBox = document.getElementById("cartTotal");

  if (!box) return;

  const cart = getCart();

  box.innerHTML = "";

  if (!cart.length) {
    box.innerHTML = "<p class='hint'>Coș gol</p>";
    if (totalBox) totalBox.innerHTML = "";
    return;
  }

  let total = 0;

  cart.forEach(i => {
    const row = document.createElement("div");

    const available = stockMap[i.id] || 0;
    const insufficient = i.qty > available;

    row.className = "cartItem" + (insufficient ? " out-of-stock" : "");

    const left = document.createElement("div");
    left.className = "cartLeft";

    const price = Number(i.price) || 0;
    const lineTotal = price * i.qty;
    total += lineTotal;

    left.innerHTML = `
      <strong>${i.name}</strong>
      <div class="price">
        Preț: ${price.toFixed(2)} RON × ${i.qty}
        = <strong>${lineTotal.toFixed(2)} RON</strong>
      </div>
      ${
        insufficient
          ? `<div class="stock-warning">❌ Stoc insuficient (disponibil: ${available})</div>`
          : `<div class="stock-ok">✔️ Stoc OK (${available})</div>`
      }
    `;

    const right = document.createElement("div");
    right.className = "cartRight";

    const btnDec = document.createElement("button");
    btnDec.textContent = "−";
    btnDec.onclick = () => decQty(i.id);

    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "1";
    qtyInput.value = i.qty;
    qtyInput.style.width = "70px";

    qtyInput.onchange = () => {
      const val = parseInt(qtyInput.value, 10);
      if (isNaN(val) || val <= 0) return;
      i.qty = val;
      saveCart(cart);
      renderCart(); // IMPORTANT: actualizează totalul
    };

    const btnInc = document.createElement("button");
    btnInc.textContent = "+";
    btnInc.onclick = () => incQty(i.id);

    const btnDel = document.createElement("button");
    btnDel.textContent = "🗑";
    btnDel.onclick = () => removeItem(i.id);

    right.append(btnDec, qtyInput, btnInc, btnDel);
    row.append(left, right);
    box.appendChild(row);
  });

  if (totalBox) {
    totalBox.innerHTML = `
      <strong>Total comandă:</strong>
      <span>${total.toFixed(2)} RON</span>
    `;
  }
  console.log("TOTAL COS:", total);

}

function initViewCurrentOrderButton() {
  const btn = document.getElementById("btnViewCurrentOrder");
  if (!btn) return;

  btn.onclick = () => {
    const cart = getCart();

    if (!cart || cart.length === 0) {
      alert("Nu există produse în coș.");
      return;
    }

    location.href = "comanda.html";
  };
  

}




// ================= TREE =================
function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function renderTree(obj, onClick) {
  const box = document.createElement("div");

  if (Array.isArray(obj)) {
    obj.forEach(item => {
      let label = "";
      let value = null;

      if (typeof item === "string") {
        label = item;
        value = item;
      } else if (typeof item === "object") {
        label = item.name;
        value = item.name; // IMPORTANT: folosim name ca legătură
      } else {
        return;
      }

      const b = document.createElement("button");
      b.className = "itembtn";
      b.textContent = label;
      b.onclick = () => onClick(value);
      box.appendChild(b);
    });
    return box;
  }

  if (obj && typeof obj === "object") {
    Object.keys(obj).forEach(k => {
      const h = document.createElement("h4");
      h.textContent = k;
      box.appendChild(h);
      box.appendChild(renderTree(obj[k], onClick));
    });
  }

  return box;
}


// ================= ADAUGA_COMANDA.HTML =================
async function initAddClientPage() {
  const treeBox = document.getElementById("clientsTree");
  const searchInput = document.getElementById("searchClient");
  const resultsBox = document.getElementById("clientSearchResults");

  if (!treeBox || !searchInput || !resultsBox) return;

  const tree = await fetch("/api/clients-tree").then(r => r.json());
  const flat = await fetch("/api/clients-flat").then(r => r.json());

  // 🌳 afișăm arborele de clienți
  treeBox.appendChild(
    renderTree(tree, name => {
      const client = flat.find(c => c.name === name);
      if (client && setSelectedClient(client)) {
        location.href = "comanda.html";
      }
    })
  );

  // 🔎 SEARCH LIVE CLIENTI
  searchInput.addEventListener("input", () => {
    const q = searchInput ? searchInput.value.toLowerCase().trim() : "";

    resultsBox.innerHTML = "";

    if (!q) return;

    flat
      .filter(c => c.name.toLowerCase().includes(q))
      .slice(0, 20)
      .forEach(c => {
        const b = document.createElement("button");
        b.className = "itembtn";
        b.textContent = c.name;

        b.onclick = () => {
          if (setSelectedClient(c)) {
            location.href = "comanda.html";
          }
        };

        resultsBox.appendChild(b);
      });
  });
}
// ================= COMANDA.HTML =================
async function initOrderPage() {
  stockMap = {}; // reset global

const stock = await fetch("/api/stock").then(r => r.json());

stock.forEach(s => {
stockMap[s.productId] =
  (stockMap[s.productId] || 0) + Number(s.qty);
});

  const treeBox = document.getElementById("productsTree");
  const sendBtn = document.getElementById("btnSendOrder");
  const clearBtn = document.getElementById("btnClearCart");
  const title = document.getElementById("clientTitle");

  console.log("initOrderPage pornit", treeBox);

  if (!treeBox ) return;
  if (sendBtn) {
  sendBtn.onclick = async () => {
    const client = getSelectedClient();
    const items = getCart();

    if (!client) {
      alert("Client nesetat");
      return;
    }

    if (!items.length) {
      alert("Coșul este gol");
      return;
    }

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client, items })
    });

    let data = {};
    try {
      data = await res.json();
    } catch {}

    // ❌ STOC INSUFICIENT → NU ȘTERGEM COȘUL
    if (!res.ok || data.error) {
      alert("Stoc insuficient pentru cel puțin un produs.\n\nVerifică cantitățile din coș.");
      return;
    }

    // ✅ SUCCES
    clearCart();
    alert("Comandă trimisă!");
    location.href = "index.html";
  };
}



// 🔎 SEARCH PRODUSE
const searchInput = document.getElementById("searchProduct");
const resultsBox = document.getElementById("productSearchResults");

if (searchInput && resultsBox) {
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.toLowerCase().trim();
    resultsBox.innerHTML = "";
    if (!q) return;

    flat
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.path.toLowerCase().includes(q)
      )
      .slice(0, 20)
      .forEach(p => {
        const b = document.createElement("button");
        b.className = "itembtn";
        b.textContent = `${p.name} (${p.path})`;
        b.onclick = () => addToCart(p);
        resultsBox.appendChild(b);
      });
  });
}



  const client = getSelectedClient();
  if (client && title) {
    title.textContent = `Client: ${client.name}`;
  }

  const tree = await fetch("/api/products-tree").then(r => r.json());
  const flat = await fetch("/api/products-flat").then(r => r.json());

  treeBox.innerHTML = "";
  treeBox.appendChild(
    renderTree(tree, name => {
      const p = flat.find(x => x.name === name);
      if (p) addToCart(p);
    })
  );

  renderCart();

}


function getProductClass(name) {
  const n = name.toLowerCase();

  if (n.includes("active") || n.includes("chilot")) return "active";
  if (n.includes("air") || n.includes("scai")) return "air";
  if (n.includes("lady")) return "lady";
  if (n.includes("bella")) return "bella";

  return "altele";
}

// ================= ORDERS.HTML =================
// ================= ORDERS.HTML =================
async function initOrdersPage() {
  const selStatus = document.getElementById("filterStatus");

  const list = document.getElementById("ordersList");
  const selGroup = document.getElementById("filterGroup");
  const selCategory = document.getElementById("filterCategory");
  const searchInput = document.getElementById("orderSearch");
  const searchResults = document.getElementById("orderSearchResults");
  const btnReset = document.getElementById("btnResetFilters");

  if (!list) return;

  const orders = await fetch("/api/orders").then(r => r.json());
  const clients = await fetch("/api/clients-flat").then(r => r.json());

  // 🔹 map clientName -> category
  const clientCategoryMap = {};
  clients.forEach(c => {
    clientCategoryMap[c.name] = c.path.split(" / ")[1] || "";
  });

  // 🔹 populăm filtrele
  const groups = new Set();
  const categories = new Set();

  orders.forEach(o => {
    if (o.client?.group) groups.add(o.client.group);
    const cat = clientCategoryMap[o.client?.name];
    if (cat) categories.add(cat);
  });

  groups.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    selGroup.appendChild(opt);
  });

  categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    selCategory.appendChild(opt);
  });

  function render() {
   const gFilter = selGroup.value;
const cFilter = selCategory.value;
const sFilter = selStatus ? selStatus.value : "";
const q = searchInput ? searchInput.value.toLowerCase().trim() : "";

    list.innerHTML = "";

    const filtered = orders.filter(o => {
      if (gFilter && o.client.group !== gFilter) return false;

      if (cFilter) {
        const cat = clientCategoryMap[o.client.name];
        if (cat !== cFilter) return false;
      }
      if (sFilter) {
  const status = o.status || "in_procesare";
  if (status !== sFilter) return false;
}


      if (q && !o.client.name.toLowerCase().includes(q)) return false;

      return true;
    });

    if (!filtered.length) {
      list.innerHTML = "<p class='hint'>Nu există comenzi.</p>";
      return;
    }

    filtered
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .forEach(o => {
        if (!o || !Array.isArray(o.items)) {
  console.warn("Comandă invalidă ignorată:", o);
  return;
}

        const card = document.createElement("div");
        card.className = "orderCard";

        const head = document.createElement("div");
head.className = "orderHeader";


        const status = o.status || "in_procesare";

        head.innerHTML = `
  <span>
    ${o.client.name} (${o.client.group}) –
    ${new Date(o.createdAt).toLocaleDateString("ro-RO")}
  </span>
`;
const statusBtn = document.createElement("button");
statusBtn.className = `order-status ${status}`;
statusBtn.textContent =
  status === "livrata" ? "Livrată" : "În procesare";

statusBtn.onclick = async (e) => {
  e.stopPropagation();

  const newStatus =
    status === "in_procesare" ? "livrata" : "in_procesare";

  const res = await fetch(`/api/orders/${o.id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: newStatus })
  });

  if (!res.ok) {
    alert("Eroare la schimbare status");
    return;
  }

  o.status = newStatus;
  render();
};
head.appendChild(statusBtn);


        const body = document.createElement("div");
        body.className = "orderBody";
        body.style.display = "none";

    if (!Array.isArray(o.items)) return;

o.items.forEach(i => {
  const row = document.createElement("div");
  row.className = `orderItem ${getProductClass(i.name)}`;

  // TITLU PRODUS (O SINGURĂ DATĂ)
  let html = `
    <strong>${i.name}</strong> × ${i.qty}
  `;

  // LOTURI FEFO (SUB-SECȚIUNE)
  if (Array.isArray(i.allocations) && i.allocations.length > 0) {
    html += `<div class="lots">`;
    i.allocations.forEach(a => {
      html += `
        <div class="lot">
          LOT: ${a.lot} | EXP: ${a.expiresAt} | Qty: ${a.qty}
        </div>
      `;
    });
    html += `</div>`;
  }

  row.innerHTML = html;
  body.appendChild(row);
});






        // toggle detalii
        head.onclick = () => {
          body.style.display =
            body.style.display === "none" ? "block" : "none";
        };

        // 🔄 schimbare status (click pe badge)
        const statusEl = head.querySelector(".order-status");
        statusEl.onclick = async (e) => {
          e.stopPropagation();
          if (!o.id) return;

          const newStatus =
            status === "in_procesare" ? "livrata" : "in_procesare";

          await fetch(`/api/orders/${o.id}/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus })
          });

          o.status = newStatus;
          render();
        };

        card.appendChild(head);
        card.appendChild(body);
        list.appendChild(card);
      });
  }

  // 🔍 SEARCH LIVE + sugestii
  if (searchInput && searchResults) {
    searchInput.oninput = () => {
      const q = searchInput.value.toLowerCase().trim();
      searchResults.innerHTML = "";
      if (!q) return;

      const matches = orders
        .map(o => o.client.name)
        .filter((v, i, a) => a.indexOf(v) === i)
        .filter(name => name.toLowerCase().includes(q))
        .slice(0, 10);

      matches.forEach(name => {
        const b = document.createElement("button");
        b.textContent = name;
        b.onclick = () => {
          searchInput.value = name;
          searchResults.innerHTML = "";
          render();
        };
        searchResults.appendChild(b);
      });
    };
  }

  // 🔄 RESET FILTRE
  if (btnReset) {
    btnReset.onclick = () => {
      selGroup.value = "";
      selCategory.value = "";
      if (searchInput) searchInput.value = "";
      if (searchResults) searchResults.innerHTML = "";
      render();
    };
  }

  selGroup.onchange = render;
  selCategory.onchange = render;
  if (selStatus) selStatus.onchange = render;


  render();
}

function parseGS1(qr) {
  const out = {};
  const regex = /\((\d{2})\)([^()]+)/g;
  let m;

  while ((m = regex.exec(qr)) !== null) {
    const ai = m[1];
    const val = m[2];

    if (ai === "01") out.gtin = val.trim();
    if (ai === "17") {
      out.expiresAt =
        "20" + val.slice(0, 2) + "-" +
        val.slice(2, 4) + "-" +
        val.slice(4, 6);
    }
    if (ai === "10") out.lot = val.trim();
  }

  return out;
}

function selectProductByGTIN(gtin) {
  const sel = document.getElementById("stockProduct");
  if (!sel) return;

  const clean = gtin.trim();

  [...sel.options].forEach(o => {
    if (o.dataset.gtin && o.dataset.gtin.trim() === clean) {
      sel.value = o.value;
    }
  });
}

async function initStockPage() {
  const prodSel = document.getElementById("stockProduct");
  const list = document.getElementById("stockList");
  const qrInput = document.getElementById("qrInput");

  if (!prodSel || !list) return;

  const products = await fetch("/api/products-flat").then(r => r.json());
  const stock = await fetch("/api/stock").then(r => r.json());

  // populate produse
  products.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    opt.dataset.name = p.name;
    opt.dataset.gtin = p.gtin || ""; // 🔑 CHEIA
    prodSel.appendChild(opt);
  });

  renderStock(stock);

  if (qrInput) {
    qrInput.addEventListener("change", () => {
      const qr = qrInput.value.trim();
      if (!qr) return;

      const data = parseGS1(qr);

      if (data.lot) {
        document.getElementById("stockLot").value = data.lot;
      }

      if (data.expiresAt) {
        document.getElementById("stockExpire").value = data.expiresAt;
      }

      if (data.gtin) {
        selectProductByGTIN(data.gtin);
      }
    });
  }

  document.getElementById("btnAddStock").onclick = async () => {
    const productId = prodSel.value;
    const productName = prodSel.selectedOptions[0].dataset.name;
    const lot = document.getElementById("stockLot").value.trim();
    const expiresAt = document.getElementById("stockExpire").value;
    const qty = document.getElementById("stockQty").value;

    if (!productId || !lot || !expiresAt || !qty) {
      alert("Completează toate câmpurile");
      return;
    }

    await fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, productName, lot, expiresAt, qty })
    });

    location.reload();
  };
}
async function initInventoryPage() {
  const list = document.getElementById("inventoryList");
  const btnRefresh = document.getElementById("btnRefreshStock");

  if (!list) return;

  async function loadStock() {
    list.innerHTML = "<p class='hint'>Se încarcă stocul...</p>";

    const stock = await apiFetch("/api/stock").then(r => r.json());

    if (!stock.length) {
      list.innerHTML = "<p class='hint'>Nu există stoc.</p>";
      return;
    }

    // 🔥 GRUPARE CORECTĂ PE PRODUS
    const grouped = {};

    stock.forEach(s => {
      if (!grouped[s.productId]) {
        grouped[s.productId] = {
          productName: s.productName,
          totalQty: 0,
          lots: []
        };
      }

      grouped[s.productId].totalQty += Number(s.qty);
      grouped[s.productId].lots.push(s);
      
    });

    list.innerHTML = "";
    // 🔔 ALERTĂ STOC MIC (GLOBAL)
const lowProducts = Object.values(grouped)
  .filter(p => p.totalQty < LOW_STOCK_LIMIT);

if (lowProducts.length) {
  const alert = document.createElement("div");
  alert.className = "alert-low-stock";
  alert.innerHTML = `
    ⚠️ <strong>Atenție!</strong>
    ${lowProducts.length} produse au stoc sub ${LOW_STOCK_LIMIT} buc.
  `;
  list.appendChild(alert);
}


    Object.values(grouped).forEach(prod => {
      const header = document.createElement("div");
      header.className = "inventory-row";

    const isLow = prod.totalQty < LOW_STOCK_LIMIT;

header.innerHTML = `
  <strong>${prod.productName}</strong>
  <span class="${isLow ? "low-stock" : ""}">
    TOTAL: ${prod.totalQty} buc
    ${isLow ? "⚠️ STOC MIC" : ""}
  </span>
  <button class="btnToggle">✏️</button>
`;


      list.appendChild(header);

      const details = document.createElement("div");
      details.style.display = "none";
      details.style.marginLeft = "20px";

      prod.lots.forEach(lot => {
        const row = document.createElement("div");
        row.className = "inventory-lot";

        row.innerHTML = `
          LOT: ${lot.lot} | EXP: ${lot.expiresAt}
          Qty:
          <input type="number" value="${lot.qty}" id="qty-${lot.id}">
          <button class="btnSave" data-id="${lot.id}">💾</button>
          <button class="btnDelete" data-id="${lot.id}">🗑</button>
        `;

        details.appendChild(row);
      });

      list.appendChild(details);

      header.querySelector(".btnToggle").onclick = () => {
        details.style.display =
          details.style.display === "none" ? "block" : "none";
      };
    });

    // 💾 SAVE
    document.querySelectorAll(".btnSave").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const qty = document.getElementById(`qty-${id}`).value;

        await apiFetch(`/api/stock/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qty })
        });

        loadStock();
      };
    });

    // 🗑 DELETE
    document.querySelectorAll(".btnDelete").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;

        if (!confirm("Ștergi acest lot?")) return;

        await apiFetch(`/api/stock/${id}`, {
          method: "DELETE"
        });

        loadStock();
      };
    });
  }

  if (btnRefresh) btnRefresh.onclick = loadStock;
  loadStock();
}





function renderStock(stock) {
  const list = document.getElementById("stockList");
  list.innerHTML = "";

  stock.forEach(s => {
    const row = document.createElement("div");
    row.className = "stockRow";
    row.textContent =
      `${s.productName} | LOT: ${s.lot} | Exp: ${s.expiresAt} | Qty: ${s.qty}`;
    list.appendChild(row);
  });
}

function getProductPrice(product, client) {
  // preț custom?
  if (
    client &&
    client.prices &&
    client.prices[product.id] != null
  ) {
    return Number(client.prices[product.id]);
  }

  // fallback la preț de listă
  return Number(product.price || 0);
}

function addToCart(product) {
  const cart = getCart();
  const client = getSelectedClient();

  const price = getProductPrice(product, client);

  const found = cart.find(p => p.id === product.id);

  if (found) {
    found.qty++;
  } else {
    cart.push({
      ...product,
      qty: 1,
      price
    });
  }

  saveCart(cart);
  renderCart();
}
const orderItemsMap = {};



// ================= THEME =================
function applyTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
}







// ================= BOOT =================
document.addEventListener("DOMContentLoaded", async () => {
  const isLoginPage = location.pathname.endsWith("login.html");

  if (isLoginPage) {
    initLoginPage();
    initRegister();
    return;
  }

  await protectPage();
  await renderUserBar();

  const savedTheme = localStorage.getItem("theme") || "light";
  applyTheme(savedTheme);
  
  const btn = document.getElementById("btnOpenCartMobile");
if (btn) {
  btn.onclick = () => {
    document.getElementById("cartBox")
      ?.scrollIntoView({ behavior: "smooth" });
  };
}


  const btn = document.getElementById("btnToggleTheme");
  if (btn) {
    btn.textContent = savedTheme === "dark" ? "☀️" : "🌙";
    btn.onclick = () => {
      const isDark = document.body.classList.toggle("dark");
      const newTheme = isDark ? "dark" : "light";
      localStorage.setItem("theme", newTheme);
      btn.textContent = isDark ? "☀️" : "🌙";
    };
  }

  if (document.getElementById("inventoryList")) initInventoryPage();
  if (document.getElementById("stockProduct")) initStockPage();
  if (document.getElementById("clientsTree")) initAddClientPage();
  if (document.getElementById("productsTree")) initOrderPage();
  if (document.getElementById("ordersList")) initOrdersPage();

  initViewCurrentOrderButton();
});




