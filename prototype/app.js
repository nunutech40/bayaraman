const state = {
  creator: "seller",
  status: "DRAFT",
  step: "input",
  channel: "email",
  transaction: null,
  log: ["Prototype siap. Ada 3 aktor: penjual, pembeli, admin."],
};

const stepOrder = ["input", "pay", "review", "group", "ship", "otp", "payout"];

const requiredByCreator = {
  seller: [
    "Data penjual: nama, WhatsApp, rekening payout",
    "Data transaksi: judul, nominal, kesepakatan",
    "Data pembeli minimal: nama/WhatsApp/email untuk invite dan OTP",
    "Buyer nanti membuka link dan membayar ke rekening BayarAman",
  ],
  buyer: [
    "Data pembeli: nama, WhatsApp, email",
    "Data transaksi: judul, nominal, kesepakatan",
    "Data penjual: nama, WhatsApp, rekening payout seller",
    "Seller perlu menerima/verifikasi data sebelum buyer bayar",
  ],
};

const rupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

function calculateFee(amount) {
  return Math.min(Math.max(Math.round(amount * 0.02), 20000), 100000);
}

function setView(view) {
  document.querySelectorAll(".view").forEach((el) => el.classList.remove("active"));
  document.querySelector(`#view-${view}`).classList.add("active");
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === view);
  });
}

function openGuide() {
  const modal = document.querySelector("#guideModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeGuide() {
  const modal = document.querySelector("#guideModal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function addLog(message) {
  state.log.unshift(message);
  render();
}

function setStatus(status, step, message) {
  state.status = status;
  state.step = step;
  addLog(message);
}

function createTransaction() {
  const amount = Number(document.querySelector("#amountInput").value || 0);
  const fee = calculateFee(amount);

  state.transaction = {
    code: "BA-8H2K91",
    title: document.querySelector("#titleInput").value,
    amount,
    fee,
    total: amount + fee,
    buyerName: document.querySelector("#buyerNameInput").value,
    buyerPhone: document.querySelector("#buyerPhoneInput").value,
    buyerEmail: document.querySelector("#buyerEmailInput").value,
    sellerName: document.querySelector("#sellerNameInput").value,
    sellerPhone: document.querySelector("#sellerPhoneInput").value,
    sellerBank: document.querySelector("#sellerBankInput").value,
    deal: document.querySelector("#dealInput").value,
  };

  state.creator = "seller";
  setStatus("WAITING_BUYER_PAYMENT", "pay", "Penjual membuat transaksi. Link siap dibagikan ke pembeli.");
  document.querySelector("#sellerCreateNote").textContent =
    "Transaksi dibuat. Berikutnya pembeli membuka Halaman Bayar, transfer ke rekening BayarAman, lalu klik Sudah Bayar.";
}

function createBuyerTransaction() {
  const amount = Number(document.querySelector("#buyerAmountInput").value || 0);
  const fee = calculateFee(amount);

  state.transaction = {
    code: "BA-8H2K91",
    title: document.querySelector("#buyerTitleInput").value,
    amount,
    fee,
    total: amount + fee,
    buyerName: document.querySelector("#buyerCreateNameInput").value,
    buyerPhone: document.querySelector("#buyerCreatePhoneInput").value,
    buyerEmail: document.querySelector("#buyerCreateEmailInput").value,
    sellerName: document.querySelector("#buyerSellerNameInput").value,
    sellerPhone: document.querySelector("#buyerSellerPhoneInput").value,
    sellerBank: document.querySelector("#buyerSellerBankInput").value,
    deal: document.querySelector("#buyerDealInput").value,
  };

  state.creator = "buyer";
  setStatus("WAITING_BUYER_PAYMENT", "pay", "Pembeli membuat transaksi dan memasukkan rekening seller. Berikutnya buyer bayar ke BayarAman.");
}

function resetPrototype() {
  state.status = "DRAFT";
  state.step = "input";
  state.transaction = null;
  state.log = ["Prototype di-reset."];
  render();
  setView("seller");
}

function hintForStatus(status) {
  return {
    DRAFT: "Mulai dari aktor yang meng-input transaksi.",
    WAITING_BUYER_PAYMENT: "Buyer transfer ke rekening BayarAman sebelum 1x24 jam.",
    PAYMENT_UNDER_REVIEW: "Buyer sudah klik Sudah Bayar. Admin cek dana masuk.",
    PAYMENT_CONFIRMED: "Admin sudah validasi pembayaran. Berikutnya buat WA group.",
    WA_GROUP_CREATED: "Group WA dibuat. Admin perlu info pembayaran masuk di group.",
    PAYMENT_ANNOUNCED: "Admin sudah info pembayaran masuk. Seller boleh kirim barang.",
    SELLER_SHIPPED: "Seller sudah kirim barang. Tunggu seller dan buyer info pesanan selesai.",
    WAITING_BUYER_CONFIRMATION: "Admin kirim link. Buyer konfirmasi dengan OTP.",
    BUYER_CONFIRMED: "Buyer sudah OTP. Admin boleh transfer uang ke seller.",
    PAID_OUT: "Admin sudah transfer uang ke seller. Flow selesai.",
    PAYMENT_EXPIRED: "Transaksi tidak dibayar dalam 1x24 jam.",
  }[status] || "Butuh tindak lanjut admin.";
}

function renderCreator() {
  const isSeller = state.creator === "seller";
  document.querySelector("#sellerRoleNote").textContent = isSeller
    ? "Penjual adalah user yang meng-input transaksi pertama kali."
    : "Penjual menerima/verifikasi data dan rekening payout yang dimasukkan pembeli.";
  document.querySelector("#buyerRoleNote").textContent = isSeller
    ? "Pembeli membuka link, transfer ke BayarAman, lalu klik Sudah Bayar."
    : "Pembeli adalah user yang meng-input transaksi dan rekening seller.";
}

function renderTransaction() {
  const tx = state.transaction;
  document.querySelector("#sideStatus").textContent = state.status;
  document.querySelector("#sideHint").textContent = hintForStatus(state.status);
  document.querySelector("#expiryLabel").textContent = state.status === "PAYMENT_EXPIRED" ? "Expired" : "1x24 jam";
  document.querySelector("#statusBadge").textContent = state.status;
  document.querySelector("#adminQueue").textContent = state.status;
  document.querySelector("#transactionNote").textContent = hintForStatus(state.status);

  if (!tx) {
    document.querySelector("#transactionTitle").textContent = "Belum ada transaksi";
    document.querySelector("#transactionMeta").textContent = "Buyer melihat detail lalu membayar ke rekening BayarAman.";
    return;
  }

  document.querySelector("#transactionTitle").textContent = tx.title;
  document.querySelector("#transactionMeta").textContent =
    `${tx.code} - dibuat oleh ${state.creator === "seller" ? "penjual" : "pembeli"}`;
  document.querySelector("#amountLabel").textContent = rupiah(tx.amount);
  document.querySelector("#feeLabel").textContent = rupiah(tx.fee);
  document.querySelector("#totalLabel").textContent = rupiah(tx.total);
  document.querySelector("#buyerLabel").textContent = `${tx.buyerName} / ${tx.buyerPhone} / ${tx.buyerEmail}`;
  document.querySelector("#sellerLabel").textContent = `${tx.sellerName} / ${tx.sellerPhone}`;
  document.querySelector("#sellerBankLabel").textContent = tx.sellerBank;
  document.querySelector("#dealLabel").textContent = tx.deal;
}

function renderSteps() {
  const currentIndex = stepOrder.indexOf(state.step);
  document.querySelectorAll(".flow-step").forEach((el) => {
    const index = stepOrder.indexOf(el.dataset.step);
    el.classList.toggle("active", index === currentIndex);
    el.classList.toggle("done", index < currentIndex);
  });
}

function renderLog() {
  document.querySelector("#activityLog").innerHTML = state.log.map((item) => `<div>${item}</div>`).join("");
}

function renderOtp() {
  document.querySelector("#otpNote").textContent =
    state.status === "WAITING_BUYER_CONFIRMATION"
      ? `OTP dikirim ke ${state.channel === "email" ? "email buyer" : "WhatsApp buyer"}.`
      : hintForStatus(state.status);
}

function setButtonState() {
  const rules = [
    ["#paidBtn", state.status === "WAITING_BUYER_PAYMENT"],
    ["#confirmPaymentBtn", state.status === "PAYMENT_UNDER_REVIEW"],
    ["#paymentNotFoundBtn", state.status === "PAYMENT_UNDER_REVIEW"],
    ["#waBtn", state.status === "PAYMENT_CONFIRMED"],
    ["#announceBtn", state.status === "WA_GROUP_CREATED"],
    ["#shippedBtn", state.status === "PAYMENT_ANNOUNCED"],
    ["#completeBtn", state.status === "SELLER_SHIPPED"],
    ["#sendConfirmBtn", state.status === "SELLER_SHIPPED"],
    ["#payoutBtn", state.status === "BUYER_CONFIRMED"],
  ];

  rules.forEach(([selector, enabled]) => {
    const button = document.querySelector(selector);
    if (button) button.disabled = !enabled;
  });
}

function render() {
  renderCreator();
  renderTransaction();
  renderSteps();
  renderLog();
  renderOtp();
  setButtonState();
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelector("#helpBtn").addEventListener("click", openGuide);
document.querySelector("#closeGuideBtn").addEventListener("click", closeGuide);
document.querySelector("#guideBackdrop").addEventListener("click", closeGuide);

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    state.creator = button.dataset.creator;
    document.querySelectorAll(".segment").forEach((el) => el.classList.remove("active"));
    document.querySelectorAll(`[data-creator="${state.creator}"]`).forEach((el) => el.classList.add("active"));
    addLog(`Mode input diganti: ${state.creator === "seller" ? "penjual" : "pembeli"} meng-input transaksi.`);
  });
});

document.querySelectorAll(".channel").forEach((button) => {
  button.addEventListener("click", () => {
    state.channel = button.dataset.channel;
    document.querySelectorAll(".channel").forEach((el) => el.classList.remove("active"));
    button.classList.add("active");
    render();
  });
});

document.querySelector("#sellerCreateBtn").addEventListener("click", createTransaction);
document.querySelector("#buyerCreateBtn").addEventListener("click", createBuyerTransaction);
document.querySelector("#resetBtn").addEventListener("click", resetPrototype);
document.querySelector("#resetBtn2").addEventListener("click", resetPrototype);

document.querySelector("#paidBtn").addEventListener("click", () => {
  if (!state.transaction) return addLog("Belum ada transaksi. Isi form dulu.");
  setStatus("PAYMENT_UNDER_REVIEW", "review", "Buyer klik Sudah Bayar. Admin cek rekening BayarAman.");
});

document.querySelector("#confirmPaymentBtn").addEventListener("click", () => {
  if (state.status !== "PAYMENT_UNDER_REVIEW") return addLog("Belum ada payment claim dari buyer.");
  setStatus("PAYMENT_CONFIRMED", "group", "Admin validasi dana masuk sesuai total bayar.");
});

document.querySelector("#paymentNotFoundBtn").addEventListener("click", () => {
  if (!state.transaction) return addLog("Belum ada transaksi.");
  setStatus("WAITING_BUYER_PAYMENT", "pay", "Admin belum menemukan dana. Buyer tetap harus bayar sebelum expired.");
});

document.querySelector("#waBtn").addEventListener("click", () => {
  if (state.status !== "PAYMENT_CONFIRMED") return addLog("Pembayaran harus confirmed dulu.");
  setStatus("WA_GROUP_CREATED", "group", "Admin membuat group WhatsApp buyer, seller, BayarAman.");
});

document.querySelector("#announceBtn").addEventListener("click", () => {
  if (state.status !== "WA_GROUP_CREATED") return addLog("Group WA belum dibuat.");
  setStatus("PAYMENT_ANNOUNCED", "ship", "Admin info di group: pembayaran sudah masuk. Seller boleh kirim.");
});

document.querySelector("#shippedBtn").addEventListener("click", () => {
  if (state.status !== "PAYMENT_ANNOUNCED") return addLog("Admin harus info pembayaran masuk dulu di group.");
  setStatus("SELLER_SHIPPED", "ship", "Seller info di group: barang sudah dikirim.");
});

document.querySelector("#completeBtn").addEventListener("click", () => {
  if (state.status !== "SELLER_SHIPPED") return addLog("Seller harus kirim barang dulu.");
  setStatus("WAITING_BUYER_CONFIRMATION", "otp", "Seller dan buyer info pesanan selesai. Admin kirim link OTP.");
  setView("confirm");
});

document.querySelector("#sendConfirmBtn").addEventListener("click", () => {
  if (state.status !== "SELLER_SHIPPED") return addLog("Pesanan belum ditandai selesai oleh seller dan buyer.");
  setStatus("WAITING_BUYER_CONFIRMATION", "otp", "Admin kirim link konfirmasi ke group WhatsApp.");
  setView("confirm");
});

document.querySelector("#verifyOtpBtn").addEventListener("click", () => {
  const otp = document.querySelector("#otpInput").value.trim();
  if (state.status !== "WAITING_BUYER_CONFIRMATION") return addLog("Admin belum kirim link konfirmasi.");
  if (otp !== "123456") return addLog("OTP salah. Untuk prototype gunakan 123456.");
  setStatus("BUYER_CONFIRMED", "payout", "Buyer berhasil OTP dan konfirmasi pesanan selesai.");
  setView("admin");
});

document.querySelector("#payoutBtn").addEventListener("click", () => {
  if (state.status !== "BUYER_CONFIRMED") return addLog("Buyer belum konfirmasi OTP.");
  setStatus("PAID_OUT", "payout", "Admin transfer uang ke rekening seller. Flow selesai.");
});

render();
