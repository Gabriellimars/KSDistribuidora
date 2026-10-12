(() => {
  const local = location.protocol === "file:" || location.pathname.includes("/paginas/");
  document.querySelectorAll("header nav").forEach(nav => {
    if (nav.querySelector(".ks-account-link")) return;
    const link = document.createElement("a");
    link.className = "ks-account-link"; link.href = "./conta.html";
    link.textContent = "Minha conta ↗"; nav.append(link);
  });
  let cached;
  const ready = (async () => {
    if (local) return { configured: false, user: null, local: true };
    const response = await fetch("/api/customer", { credentials: "same-origin", cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível carregar a conta.");
    cached = data; return data;
  })();
  // Every consumer handles errors; never silently treat a failed lookup as a guest.
  ready.catch(() => {});
  async function saveAddress(address) {
    const response = await fetch("/api/customer", { method: "PUT", credentials: "same-origin",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(address) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível salvar seus dados.");
    return data;
  }
  ready.then(data => {
    const name = String(data.user?.name || "").trim();
    const firstName = name ? name.split(/\s+/)[0] :
      String(data.user?.email || "").split("@")[0];
    document.querySelectorAll(".ks-account-link").forEach(link => {
      link.textContent = data.user ? (firstName || "Minha conta") + " ↗" : "Minha conta ↗";
      link.setAttribute("aria-label", data.user ? "Abrir conta de " + (firstName || "cliente") : "Minha conta");
    });
  }).catch(() => {});
  window.KSAccount = { ready, saveAddress };
  const main = document.querySelector("#account-main");
  if (!main) return;
  const message = document.querySelector("#account-message");
  const login = document.querySelector("#google-login");
  const form = document.querySelector("#profile-form");
  const orderList = document.querySelector("#account-orders");
  const editor = form.closest("section");
  const layout = editor.parentElement;
  const savedCard = document.createElement("aside");
  savedCard.className = "saved-address-card";
  savedCard.hidden = true;
  savedCard.setAttribute("aria-labelledby", "saved-address-title");
  const savedTitle = document.createElement("h3");
  savedTitle.id = "saved-address-title";
  savedTitle.textContent = "Endereços salvos";
  const savedLabel = document.createElement("span");
  savedLabel.className = "saved-address-label";
  savedLabel.textContent = "Seu endereço de entrega";
  const savedText = document.createElement("p");
  savedText.className = "saved-address-text";
  const savedActions = document.createElement("div");
  savedActions.className = "saved-address-actions";
  const editSaved = document.createElement("button");
  editSaved.type = "button";
  editSaved.className = "btn";
  editSaved.textContent = "Editar endereço";
  const removeSaved = document.createElement("button");
  removeSaved.type = "button";
  removeSaved.className = "account-text-button";
  removeSaved.textContent = "Remover";
  const savedMessage = document.createElement("p");
  savedMessage.className = "account-status";
  savedMessage.setAttribute("role", "status");
  savedMessage.setAttribute("aria-live", "polite");
  savedActions.append(editSaved, removeSaved);
  savedCard.append(savedLabel, savedTitle, savedText, savedActions, savedMessage);
  document.querySelector("#account-signed-in").append(savedCard);
  const cancelEdit = document.createElement("button");
  cancelEdit.type = "button";
  cancelEdit.className = "account-text-button";
  cancelEdit.textContent = "Cancelar edição";
  cancelEdit.hidden = true;
  form.querySelector(".account-actions").append(cancelEdit);
  function showSavedAddress(address, announcement = "") {
    savedText.textContent = [
      address.name,
      address.street + ", " + address.number,
      address.neighborhood + " · " + address.city,
      address.complement ? "Complemento: " + address.complement : "",
      address.reference ? "Referência: " + address.reference : "",
    ].filter(Boolean).join("\n");
    savedMessage.textContent = announcement;
    savedCard.hidden = false;
    editor.hidden = true;
    layout.classList.add("has-saved-address");
    cancelEdit.hidden = false;
  }
  function openAddressEditor() {
    editor.hidden = false;
    savedCard.hidden = true;
    layout.classList.remove("has-saved-address");
    cancelEdit.hidden = !cached?.address;
    editor.scrollIntoView({ behavior: "smooth", block: "start" });
    form.querySelector('input[name="name"]').focus({ preventScroll: true });
  }
  editSaved.onclick = () => { fillForm(cached.address); openAddressEditor(); };
  cancelEdit.onclick = () => {
    fillForm(cached.address);
    showSavedAddress(cached.address);
    editSaved.focus();
  };
  removeSaved.onclick = () => document.querySelector("#delete-profile").click();

  const money = cents => cents == null ? "Valor sob consulta" :
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  function fillForm(address) {
    for (const input of form.elements) if (input.name) input.value = address?.[input.name] || "";
  }
  function renderOrders(orders) {
    orderList.replaceChildren();
    if (!orders.length) { orderList.textContent = "Seus pedidos feitos com esta conta aparecerão aqui."; return; }
    for (const order of orders) {
      const card = document.createElement("article"); card.className = "account-order";
      const title = document.createElement("h4");
      title.textContent = "Pedido · " + new Date(order.createdAt).toLocaleDateString("pt-BR");
      const status = document.createElement("p");
      status.textContent = order.status === "aguardando_confirmacao" ? "Aguardando confirmação da KS" : String(order.status);
      const items = document.createElement("ul");
      for (const item of order.items) {
        const li = document.createElement("li");
        li.textContent = item.quantity + " × " + (item.name || item.brand || "Bebida") + (item.format ? " · " + item.format : "");
        items.append(li);
      }
      const total = document.createElement("p"); total.textContent = money(order.totalCents);
      const protocol = document.createElement("p"); protocol.textContent = "Protocolo: " + order.id;
      card.append(title, status, items, total, protocol); orderList.append(card);
    }
  }
  ready.then(data => {
    if (!data.user) {
      document.querySelector("#account-signed-out").hidden = false;
      login.disabled = !data.configured && !data.local;
      if (data.local) login.textContent = "Entrar com Google no site online";
      message.textContent = data.local ? "Para salvar seus dados, entre no site online. Este botão abre sua conta na KS." :
        data.configured ? "Entre para salvar seus dados de entrega e consultar seus pedidos." :
        "O login com Google está aguardando ativação pela KS. Você pode continuar fazendo pedidos.";
      return;
    }
    document.querySelector("#account-signed-out").hidden = true;
    document.querySelector("#account-signed-in").hidden = false;
    document.querySelector("#account-name").textContent = data.user.name;
    document.querySelector("#account-email").textContent = data.user.email;
    fillForm(data.address || { name: data.user.name }); renderOrders(data.orders || []);
    if (data.address) showSavedAddress(data.address);
    message.textContent = "Você está conectado. Seus dados ficam vinculados à sua conta.";
  }).catch(error => { message.textContent = error.message; document.querySelector("#account-retry").hidden = false; });
  document.querySelector("#account-retry").onclick = () => location.reload();
  login.onclick = async () => {
    if (local) {
      window.open("https://ks-distribuidora-coimbra.auroracocoa8.chatgpt.site/conta.html", "_blank", "noopener,noreferrer");
      return;
    }
    login.disabled = true; message.textContent = "Abrindo o Google…";
    try {
      const response = await fetch("/api/auth/sign-in/social", { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google", callbackURL: "/conta.html", errorCallbackURL: "/conta.html?login=erro", disableRedirect: true }) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error("Não foi possível iniciar o login. Tente novamente.");
      const target = new URL(data.url);
      if (target.protocol !== "https:" || target.hostname !== "accounts.google.com") throw new Error("Não foi possível abrir o Google.");
      window.location.assign(target.href);
    } catch (error) { message.textContent = error.message; login.disabled = false; }
  };
  if (new URLSearchParams(location.search).get("login") === "erro") {
    ready.then(data => { if (data.configured && !data.user) message.textContent = "O login não foi concluído. Tente entrar novamente."; }).catch(() => {});
  }
  form.onsubmit = async event => {
    event.preventDefault(); const button = form.querySelector('button[type="submit"]'); button.disabled = true;
    const status = document.querySelector("#profile-message"); status.textContent = "Salvando…";
    try {
      const address = Object.fromEntries(new FormData(form));
      for (const key in address) address[key] = String(address[key]).trim();
      await saveAddress(address);
      cached.address = address;
      status.textContent = "";
      showSavedAddress(address, "Endereço salvo na sua conta.");
      editSaved.focus();
    }
    catch (error) { status.textContent = error.message; } finally { button.disabled = false; }
  };
  document.querySelector("#delete-profile").onclick = async event => {
    const button = event.currentTarget; button.disabled = true;
    const status = document.querySelector("#profile-message");
    try {
      const response = await fetch("/api/customer", { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) throw new Error("Não foi possível remover. Tente novamente.");
      cached.address = null;
      fillForm({ name: cached.user.name });
      savedCard.hidden = true;
      openAddressEditor();
      status.textContent = "Endereço e telefone removidos da sua conta.";
    } catch(error) { status.textContent = error.message; savedMessage.textContent = error.message; } finally { button.disabled = false; }
  };
  document.querySelector("#account-signout").onclick = async event => {
    event.currentTarget.disabled = true;
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error("Não foi possível sair. Tente novamente.");
      location.reload();
    } catch(error) { message.textContent = error.message; event.currentTarget.disabled = false; }
  };
})();
(() => {
  const form = document.querySelector("#address-form");
  if (!form || !window.KSAccount) return;
  const holder = document.createElement("div"); holder.className = "account-save-option"; holder.hidden = true;
  const label = document.createElement("label"); const checkbox = document.createElement("input");
  checkbox.type = "checkbox"; checkbox.id = "save-to-account";
  label.append(checkbox, " Salvar estes dados na minha conta para os próximos pedidos.");
  const status = document.createElement("p"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
  holder.append(label, status); form.append(holder);
  const addressSection = document.createElement("section");
  addressSection.className = "delivery-saved-address";
  addressSection.hidden = true;
  const heading = document.createElement("h4");
  heading.textContent = "Endereços salvos";
  const addressText = document.createElement("p");
  addressText.className = "delivery-saved-address-text";
  const addressActions = document.createElement("div");
  addressActions.className = "saved-address-actions";
  const useAddress = document.createElement("button");
  useAddress.type = "button";
  useAddress.className = "btn";
  useAddress.textContent = "Usar este endereço";
  const manageAddress = document.createElement("a");
  manageAddress.href = "./conta.html";
  manageAddress.className = "account-text-button";
  manageAddress.textContent = "Gerenciar endereço ↗";
  addressActions.append(useAddress, manageAddress);
  addressSection.append(heading, addressText, addressActions);
  form.prepend(addressSection);
  let savedAddress = null;
  function displayDeliveryAddress(address) {
    savedAddress = address;
    addressText.textContent = [
      address.name,
      address.street + ", " + address.number,
      address.neighborhood + " · " + address.city,
      address.complement ? "Complemento: " + address.complement : "",
      address.reference ? "Referência: " + address.reference : "",
    ].filter(Boolean).join("\n");
    useAddress.hidden = false;
    manageAddress.textContent = "Gerenciar endereço ↗";
  }
  useAddress.onclick = () => {
    if (!savedAddress) return;
    for (const [name, value] of Object.entries(savedAddress)) {
      const input = form.elements.namedItem(name);
      if (input) input.value = value;
    }
    form.dispatchEvent(new Event("input", { bubbles: true }));
    status.textContent = "Endereço salvo selecionado. Revise os dados e confirme a entrega.";
    form.querySelector('button[type="submit"]')?.focus({ preventScroll: true });
  };

  window.KSAccount.ready.then(data => {
    addressSection.hidden = false;
    if (!data.user) {
      addressText.textContent = "Entre com sua conta Google para acessar seu endereço salvo.";
      useAddress.hidden = true;
      manageAddress.textContent = "Entrar na minha conta ↗";
      return;
    }
    holder.hidden = false;
    if (data.address) {
      displayDeliveryAddress(data.address);
      for (const [name,value] of Object.entries(data.address)) {
        const input = form.elements.namedItem(name);
        if (input && !input.value) input.value = value;
      }
      status.textContent = "Dados salvos preenchidos. Revise e confirme o endereço.";
    } else {
      addressText.textContent = "Você ainda não tem um endereço salvo. Preencha os dados abaixo ou salve um na sua conta.";
      useAddress.hidden = true;
      const name = form.elements.namedItem("name");
      if (name && !name.value) name.value = data.user.name;
    }
  }).catch(() => { status.textContent = "Não foi possível carregar os dados da conta."; holder.hidden = false; checkbox.disabled = true; });
  form.addEventListener("submit", async () => {
    if (!checkbox.checked || !form.checkValidity()) return;
    const address = Object.fromEntries(new FormData(form));
    for (const key in address) address[key] = String(address[key]).trim();
    status.textContent = "Salvando os dados na conta…";
    try { await window.KSAccount.saveAddress(address); displayDeliveryAddress(address); status.textContent = "Dados salvos na sua conta."; }
    catch (error) { status.textContent = error.message + " Seu pedido pode continuar sem salvar o endereço."; }
  });
})();
