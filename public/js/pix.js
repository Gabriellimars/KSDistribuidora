// BR Code estático conforme o Manual de Padrões para Iniciação do Pix (BCB).
// A geração do código não confirma recebimento nem registra pagamento.
(() => {
  const config = window.KS_PIX_CONFIG;
  const field = (id, value) =>
    id + String(value.length).padStart(2, "0") + value;

  function crc16(text) {
    let crc = 0xffff;
    for (const character of text) {
      crc ^= character.charCodeAt(0) << 8;
      for (let bit = 0; bit < 8; bit++) {
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }

  function normalize(text, length) {
    return String(text)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9 ]/g, "")
      .toUpperCase()
      .slice(0, length);
  }

  function createPayload({
    key,
    name,
    city,
    reference = "***",
    totalCents = null,
  }) {
    if (!key || !/^[\x20-\x7e]+$/.test(key) || key.length > 77) {
      throw new Error("Chave Pix inválida.");
    }
    const transaction =
      reference === "***"
        ? "***"
        : String(reference)
            .replace(/[^A-Za-z0-9]/g, "")
            .slice(0, 25);
    if (!transaction) throw new Error("Referência Pix inválida.");
    const merchantName = normalize(name, 25);
    const merchantCity = normalize(city, 15);
    if (!merchantName || !merchantCity)
      throw new Error("Dados do recebedor incompletos.");
    let payload =
      field("00", "01") +
      field("26", field("00", "br.gov.bcb.pix") + field("01", key)) +
      field("52", "0000") +
      field("53", "986");
    if (totalCents !== null) {
      if (
        !Number.isSafeInteger(totalCents) ||
        totalCents <= 0 ||
        totalCents > 99999999999
      ) {
        throw new Error("Valor Pix inválido.");
      }
      payload += field("54", (totalCents / 100).toFixed(2));
    }
    payload +=
      field("58", "BR") +
      field("59", merchantName) +
      field("60", merchantCity) +
      field("62", field("05", transaction)) +
      "6304";
    return payload + crc16(payload);
  }

  function show({ id, totalCents }) {
    if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
      throw new Error("Confirme o valor total antes de gerar o Pix.");
    }
    const code = createPayload({
      ...config,
      reference: id,
      totalCents,
    });
    const qr = qrcode(0, "M");
    qr.addData(code, "Byte");
    qr.make();
    document.querySelector("#pix-qr").innerHTML = qr.createSvgTag({
      cellSize: 5,
      margin: 20,
      scalable: true,
    });
    document.querySelector("#pix-code").value = code;
    document.querySelector("#pix-key").textContent = config.displayKey;
    document.querySelector("#pix-amount").textContent =
      totalCents === null
        ? "Valor a confirmar com a KS"
        : new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(totalCents / 100);
    document.querySelector("#pix-value-notice").hidden = totalCents !== null;
    document.querySelector("#pix-message").textContent = "";
    document.querySelector("#pix-payment").hidden = false;
    document
      .querySelector("#pix-payment")
      .scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function hide() {
    document.querySelector("#pix-payment").hidden = true;
    document.querySelector("#pix-code").value = "";
    document.querySelector("#pix-qr").innerHTML = "";
  }

  document.querySelector("#copy-pix").addEventListener("click", async () => {
    const input = document.querySelector("#pix-code");
    const status = document.querySelector("#pix-message");
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(input.value);
      } else {
        input.focus();
        input.select();
        if (!document.execCommand("copy")) throw new Error();
      }
      status.textContent =
        "Código copiado. Cole no Pix do aplicativo do seu banco.";
    } catch {
      input.focus();
      input.select();
      status.textContent = "Selecione e copie o código acima.";
    }
  });

  window.KSPix = { createPayload, crc16, show, hide };
})();
