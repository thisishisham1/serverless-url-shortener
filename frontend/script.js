// Your API Gateway invoke URL — this same origin also serves the
// GET /{shortCode} redirects, so the short link IS this domain + code.
const API_URL = "https://v375igxqil.execute-api.us-east-1.amazonaws.com";

const form = document.getElementById("shortenForm");
const input = document.getElementById("longUrl");
const btn = document.getElementById("shortenBtn");
const btnLabel = document.getElementById("btnLabel");
const btnLoader = document.getElementById("btnLoader");
const resultBox = document.getElementById("result");
const shortLinkEl = document.getElementById("shortLink");
const copyBtn = document.getElementById("copyBtn");
const errorMsg = document.getElementById("errorMsg");
const recentSection = document.getElementById("recentSection");
const recentList = document.getElementById("recentList");

// Session-only history — resets on page refresh, by design
const recentLinks = [];

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  resultBox.style.display = "none";
  errorMsg.style.display = "none";

  const longUrl = input.value.trim();
  if (!longUrl) return;

  setLoading(true);

  try {
    const res = await fetch(`${API_URL}/shorten`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ long_url: longUrl }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Something went wrong. Please try again.");
    }

    const shortUrl = `${API_URL}/${data.short_code}`;
    showResult(shortUrl);
    addToRecent(data.short_code, longUrl);
    input.value = "";

  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(shortLinkEl.textContent);
    const original = copyBtn.textContent;
    copyBtn.textContent = "Copied";
    setTimeout(() => { copyBtn.textContent = original; }, 1500);
  } catch {
    // Clipboard API can fail (older browsers, permissions) — fail quietly,
    // the link is still visible and selectable by hand.
  }
});

function setLoading(isLoading) {
  btn.disabled = isLoading;
  btnLabel.style.display = isLoading ? "none" : "inline";
  btnLoader.style.display = isLoading ? "inline-block" : "none";
}

function showResult(shortUrl) {
  shortLinkEl.textContent = shortUrl;
  resultBox.style.display = "flex";
}

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.style.display = "block";
}

function addToRecent(code, longUrl) {
  recentLinks.unshift({ code, longUrl });
  renderRecent();
}

function renderRecent() {
  recentList.innerHTML = "";
  recentLinks.slice(0, 5).forEach(({ code, longUrl }) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="recent-code">${code}</span>
      <span class="recent-original">${longUrl}</span>
    `;
    recentList.appendChild(li);
  });
  recentSection.style.display = recentLinks.length ? "block" : "none";
}
