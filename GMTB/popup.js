const MUSEUM_URL = "https://l-tike.com/st1/ghibli-en/Tt/Ttg010agreement/index";
const PARK_URL = "https://l-tike.com/st1/ghibli-pk-en4/Tt/Ttg010agreement/index";
const MAX_TABS = 104;

const PROFILE_KEYS = [
  "savedEmail",
  "savedPhone",
  "savedPassword",
  "savedGivenName",
  "savedSurname",
  "savedJapanAddress",
  "savedPassport",
  "savedCountry",
  "savedDisabilityCertificate",
  "savedCardNumber",
  "savedCardholder",
  "savedExpiryMonth",
  "savedExpiryYear",
  "savedSecurityCode"
];

const urlInput = document.getElementById("urlInput");
const tabCountInput = document.getElementById("tabCountInput");
const autoFillEnabledInput = document.getElementById("autoFillEnabledInput");
const autoClickNextInput = document.getElementById("autoClickNextInput");
const autoFillStatus = document.getElementById("autoFillStatus");
const currentPageStatus = document.getElementById("currentPageStatus");
const lockPopupButton = document.getElementById("lockPopup");
const museumButton = document.getElementById("museumBtn");
const parkButton = document.getElementById("parkBtn");

const isLockedView = new URLSearchParams(window.location.search).get("locked") === "1";

function setStatus(message, type = "") {
  autoFillStatus.textContent = message || "";
  autoFillStatus.className = `status-line ${type}`.trim();
}

async function loadSavedValues() {
  const data = await browser.storage.local.get([
    "savedUrl",
    "savedTabCount",
    "autoFillEnabled",
    "autoClickNextEnabled"
  ]);

  if (data.savedUrl) {
    urlInput.value = data.savedUrl;
  }

  if (data.savedTabCount) {
    tabCountInput.value = data.savedTabCount;
  }

  autoFillEnabledInput.checked = data.autoFillEnabled === true;
  autoClickNextInput.checked = data.autoClickNextEnabled === true;

  updateWebsitePresetHighlight();
}

async function saveMainSettings() {
  await browser.storage.local.set({
    savedUrl: urlInput.value.trim(),
    savedTabCount: tabCountInput.value,
    autoFillEnabled: autoFillEnabledInput.checked,
    autoClickNextEnabled: autoClickNextInput.checked
  });
}

function updateWebsitePresetHighlight() {
  const currentUrl = urlInput.value.trim();

  museumButton.classList.toggle("selected", currentUrl === MUSEUM_URL);
  parkButton.classList.toggle("selected", currentUrl === PARK_URL);
}

async function getSavedProfile() {
  return browser.storage.local.get(PROFILE_KEYS);
}

function missingRequiredFields(profile, fields) {
  return fields.filter(field => !String(profile[field] || "").trim());
}

function formatTimeAgo(isoDate) {
  if (!isoDate) {
    return "never";
  }

  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h ago`;
}

function isExtensionUrl(url) {
  return Boolean(url && url.startsWith(browser.runtime.getURL("")));
}

async function getTargetTab() {
  const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });

  if (activeTabs.length && !isExtensionUrl(activeTabs[0].url)) {
    await browser.storage.local.set({ lastTargetTabId: activeTabs[0].id });
    return activeTabs[0];
  }

  const data = await browser.storage.local.get("lastTargetTabId");

  if (data.lastTargetTabId) {
    try {
      const storedTab = await browser.tabs.get(data.lastTargetTabId);
      if (storedTab && !isExtensionUrl(storedTab.url)) {
        return storedTab;
      }
    } catch (e) {
      // Ignore stale tab IDs.
    }
  }

  const windows = await browser.windows.getAll({ populate: true });
  const normalWindows = windows.filter(win => win.type === "normal");
  const focusedWindow = normalWindows.find(win => win.focused) || normalWindows[0];

  if (focusedWindow && focusedWindow.tabs) {
    const activeTab = focusedWindow.tabs.find(tab => tab.active && !isExtensionUrl(tab.url));
    if (activeTab) {
      await browser.storage.local.set({ lastTargetTabId: activeTab.id });
      return activeTab;
    }
  }

  return null;
}

async function focusTab(tabId) {
  try {
    await browser.tabs.update(tabId, { active: true });
    await browser.storage.local.set({ lastTargetTabId: tabId });

    const tab = await browser.tabs.get(tabId);

    if (tab.windowId) {
      await browser.windows.update(tab.windowId, { focused: true });
    }
  } catch (e) {
    alert("Unable to focus this tab. It may already be closed.");
  }
}

async function executeOnTargetTab(code) {
  const tab = await getTargetTab();

  if (!tab) {
    alert("No target tab found. Select a Lawson Ticket tab first.");
    return null;
  }

  try {
    return await browser.tabs.executeScript(tab.id, { code });
  } catch (e) {
    alert("Unable to run on this page. Select a supported Lawson Ticket page first.");
    return null;
  }
}

async function refreshPositions() {
  const data = await browser.storage.local.get("queuePositions");
  const queuePositions = data.queuePositions || {};
  const positionsList = document.getElementById("positionsList");

  const rows = Object.values(queuePositions)
    .sort((a, b) => {
      if (a.status === "entered" && b.status !== "entered") return -1;
      if (b.status === "entered" && a.status !== "entered") return 1;
      if (a.position === null) return 1;
      if (b.position === null) return -1;
      return a.position - b.position;
    });

  positionsList.innerHTML = "";

  if (rows.length === 0) {
    positionsList.textContent = "No queue data yet.";
    return;
  }

  for (const row of rows) {
    const div = document.createElement("div");
    div.className = "position-row";

    const link = document.createElement("a");
    const estimatedTime = row.estimatedTime ? ` (${row.estimatedTime})` : "";
    link.textContent = `${row.containerName || `Tab ${row.tabId}`}${estimatedTime}`;
    link.href = "#";
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      await focusTab(row.tabId);
    });

    const value = document.createElement("strong");
    const positionText = row.status === "entered"
      ? "Entered"
      : row.position !== null
        ? row.position
        : "Unknown";

    value.textContent = `${positionText} · updated ${formatTimeAgo(row.updatedAt)}`;

    div.appendChild(link);
    div.appendChild(value);
    positionsList.appendChild(div);
  }
}

async function focusBestQueue() {
  const data = await browser.storage.local.get("queuePositions");
  const queuePositions = data.queuePositions || {};

  const rows = Object.values(queuePositions)
    .filter(row => row.tabId && row.position !== null && row.status !== "entered")
    .sort((a, b) => a.position - b.position);

  if (rows.length === 0) {
    alert("No queue position available.");
    return;
  }

  await focusTab(rows[0].tabId);
}

async function openTabs() {
  const url = urlInput.value.trim();
  let tabCount = parseInt(tabCountInput.value, 10);

  if (!url || !url.startsWith("http")) {
    alert("Invalid website address.");
    return;
  }

  if (!tabCount || tabCount < 1) {
    alert("Invalid number of tabs.");
    return;
  }

  if (tabCount > MAX_TABS) {
    tabCount = MAX_TABS;
    tabCountInput.value = MAX_TABS;
  }

  await saveMainSettings();

  await browser.runtime.sendMessage({
    action: "openTabs",
    url,
    tabCount
  });

  await refreshPositions();
}

async function closeTabs() {
  await browser.runtime.sendMessage({ action: "closeTabs" });

  await browser.storage.local.set({
    queuePositions: {}
  });

  await refreshPositions();
}

async function deleteUnusedContainers() {
  const confirmed = confirm(
    "Delete all unused Ghibli containers? Open tabs will not be deleted."
  );

  if (!confirmed) {
    return;
  }

  await browser.runtime.sendMessage({ action: "deleteUnusedContainers" });
  alert("Unused Ghibli containers deleted.");
}

async function openPersonalInfoPage() {
  if (browser.runtime.openOptionsPage) {
    await browser.runtime.openOptionsPage();
    return;
  }

  await browser.tabs.create({
    url: browser.runtime.getURL("personal-info.html")
  });
}

async function lockPopup() {
  if (isLockedView) {
    window.close();
    return;
  }

  const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (activeTabs.length && !isExtensionUrl(activeTabs[0].url)) {
    await browser.storage.local.set({ lastTargetTabId: activeTabs[0].id });
  }

  await browser.windows.create({
    url: browser.runtime.getURL("popup.html?locked=1"),
    type: "popup",
    width: 480,
    height: 760
  });
}

async function autoFillCustomerInfo() {
  const profile = await getSavedProfile();
  const missing = missingRequiredFields(profile, ["savedEmail", "savedPhone"]);

  if (missing.length) {
    alert("Please fill email address and phone number on the personal information page first.");
    setStatus("Missing customer information.", "error");
    return;
  }

  const email = profile.savedEmail.trim();
  const phone = profile.savedPhone.trim();

  const result = await executeOnTargetTab(`
    (function () {
      const email = ${JSON.stringify(email)};
      const phone = ${JSON.stringify(phone)};

      function setValue(id, value) {
        const element = document.getElementById(id);

        if (!element) {
          return false;
        }

        element.value = value;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        element.dispatchEvent(new Event("blur", { bubbles: true }));
        return true;
      }

      const ok =
        setValue("MAIL_ADDRS", email) &&
        setValue("MAIL_ADDRS_CONFIRM", email) &&
        setValue("TEL", phone) &&
        setValue("TEL_CONFIRM", phone);

      if (!ok) {
        alert("Customer Information Registration fields were not found on this page.");
      }

      return ok;
    })();
  `);

  if (result && result[0]) {
    setStatus("Customer information filled.", "success");
  }
}

async function autoFillPaymentInfo() {
  const profile = await getSavedProfile();
  const missing = missingRequiredFields(profile, [
    "savedPassword",
    "savedGivenName",
    "savedSurname",
    "savedJapanAddress",
    "savedPassport",
    "savedCountry"
  ]);

  if (missing.length) {
    alert("Please fill all required payment/applicant information on the personal information page first.");
    setStatus("Missing payment/applicant information.", "error");
    return;
  }

  const values = {
    PWD: profile.savedPassword.trim(),
    PWD_CNF: profile.savedPassword.trim(),
    APLCT_FIRST_NAME: profile.savedGivenName.trim(),
    APLCT_LAST_NAME: profile.savedSurname.trim(),
    q_1: profile.savedJapanAddress.trim(),
    q_2: profile.savedPassport.trim(),
    q_3: profile.savedCountry.trim(),
    q_4: String(profile.savedDisabilityCertificate || "").trim()
  };

  const result = await executeOnTargetTab(`
    (function () {
      const values = ${JSON.stringify(values)};

      function setValue(id, value) {
        const element = document.getElementById(id);

        if (!element) {
          return false;
        }

        element.value = value;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        element.dispatchEvent(new Event("blur", { bubbles: true }));
        return true;
      }

      const missingFields = [];

      for (const [id, value] of Object.entries(values)) {
        if (!setValue(id, value)) {
          missingFields.push(id);
        }
      }

      if (missingFields.length > 0) {
        alert("Some fields were not found on this page: " + missingFields.join(", "));
      }

      return missingFields.length === 0;
    })();
  `);

  if (result && result[0]) {
    setStatus("Payment/applicant information filled.", "success");
  }
}

async function autoFillCreditCardInfo() {
  const profile = await getSavedProfile();
  const missing = missingRequiredFields(profile, [
    "savedCardNumber",
    "savedCardholder",
    "savedExpiryMonth",
    "savedExpiryYear",
    "savedSecurityCode"
  ]);

  if (missing.length) {
    alert("Please fill all credit card information on the personal information page first.");
    setStatus("Missing credit card information.", "error");
    return;
  }

  const expiryMonth = profile.savedExpiryMonth.trim().padStart(2, "0");
  const values = {
    pan: profile.savedCardNumber.trim(),
    "3DS_NAME": profile.savedCardholder.trim().toUpperCase(),
    EXPIRE_MONTH: expiryMonth,
    EXPIRE_YR: profile.savedExpiryYear.trim(),
    securityCode: profile.savedSecurityCode.trim()
  };

  const result = await executeOnTargetTab(`
    (function () {
      const values = ${JSON.stringify(values)};

      function triggerEvents(element) {
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        element.dispatchEvent(new Event("blur", { bubbles: true }));
      }

      function setValue(id, value) {
        const element = document.getElementById(id);

        if (!element) {
          return false;
        }

        element.value = value;
        triggerEvents(element);
        return true;
      }

      const missingFields = [];

      for (const [id, value] of Object.entries(values)) {
        if (!setValue(id, value)) {
          missingFields.push(id);
        }
      }

      const cardExpire = document.getElementById("cardexpire");

      if (cardExpire) {
        cardExpire.value = values.EXPIRE_MONTH + "/" + values.EXPIRE_YR;
        triggerEvents(cardExpire);
      }

      if (missingFields.length > 0) {
        alert("Some credit card fields were not found on this page: " + missingFields.join(", "));
      }

      return missingFields.length === 0;
    })();
  `);

  if (result && result[0]) {
    setStatus("Credit card information filled.", "success");
  }
}

async function detectCurrentPageType() {
  const result = await executeOnTargetTab(`
    (function () {
      if (document.getElementById("pan") && document.getElementById("3DS_NAME")) {
        return "creditCard";
      }

      if (document.getElementById("PWD") && document.getElementById("APLCT_FIRST_NAME")) {
        return "paymentApplicant";
      }

      if (document.getElementById("MAIL_ADDRS") && document.getElementById("TEL")) {
        return "customerInfo";
      }

      if (document.getElementById("MainPart_lbUsersInLineAheadOfYou")) {
        return "queue";
      }

      return "unknown";
    })();
  `);

  return result && result[0] ? result[0] : "unknown";
}

async function autoFillCurrentPage() {
  const pageType = await detectCurrentPageType();

  if (pageType === "creditCard") {
    await autoFillCreditCardInfo();
    return;
  }

  if (pageType === "paymentApplicant") {
    await autoFillPaymentInfo();
    return;
  }

  if (pageType === "customerInfo") {
    await autoFillCustomerInfo();
    return;
  }

  if (pageType === "queue") {
    alert("This is a Queue-it page. There is no form to auto-fill.");
    return;
  }

  alert("No supported form detected on this page.");
}

async function updateCurrentPageStatus() {
  const tab = await getTargetTab();

  if (!tab) {
    currentPageStatus.textContent = "Current page: Unknown";
    return;
  }

  let pageName = "Unknown";

  try {
    const result = await browser.tabs.executeScript(tab.id, {
      code: `
        (function () {
          if (document.getElementById("pan") && document.getElementById("3DS_NAME")) {
            return "Credit Card Input";
          }

          if (document.getElementById("PWD") && document.getElementById("APLCT_FIRST_NAME")) {
            return "Payment / Applicant Information";
          }

          if (document.getElementById("MAIL_ADDRS") && document.getElementById("TEL")) {
            return "Customer Information Registration";
          }

          if (document.getElementById("MainPart_lbUsersInLineAheadOfYou")) {
            return "Queue";
          }

          return "Unknown";
        })();
      `
    });

    pageName = result && result[0] ? result[0] : "Unknown";
  } catch (e) {
    pageName = "Unsupported or protected page";
  }

  currentPageStatus.textContent = `Current page: ${pageName}`;
}

async function assistNextButton() {
  await executeOnTargetTab(`
    (function () {
      const button =
        document.getElementById("NEXT_BUTTON") ||
        document.getElementById("NEXT") ||
        document.getElementById("ENTRY_FIX") ||
        document.querySelector('input[value="Purchase"]') ||
        document.querySelector('input[value="Credit Input"]');

      if (!button) {
        alert("No Next/Purchase button found.");
        return false;
      }

      button.scrollIntoView({ behavior: "smooth", block: "center" });
      button.style.outline = "5px solid #d93025";
      button.style.outlineOffset = "4px";
      button.style.boxShadow = "0 0 16px rgba(217, 48, 37, 0.75)";
      return true;
    })();
  `);
}

function initLockedState() {
  if (isLockedView) {
    lockPopupButton.textContent = "✕";
    lockPopupButton.title = "Close pinned popup";
    document.body.classList.add("locked-view");
  }
}

urlInput.addEventListener("input", async () => {
  updateWebsitePresetHighlight();
  await saveMainSettings();
});
tabCountInput.addEventListener("input", saveMainSettings);
autoFillEnabledInput.addEventListener("change", saveMainSettings);
autoClickNextInput.addEventListener("change", saveMainSettings);

lockPopupButton.addEventListener("click", lockPopup);
document.getElementById("openPersonalInfo").addEventListener("click", openPersonalInfoPage);

museumButton.addEventListener("click", async () => {
  urlInput.value = MUSEUM_URL;
  updateWebsitePresetHighlight();
  await saveMainSettings();
});

parkButton.addEventListener("click", async () => {
  urlInput.value = PARK_URL;
  updateWebsitePresetHighlight();
  await saveMainSettings();
});

document.getElementById("openTabs").addEventListener("click", openTabs);
document.getElementById("closeTabs").addEventListener("click", closeTabs);
document.getElementById("deleteContainers").addEventListener("click", deleteUnusedContainers);
document.getElementById("refreshPositions").addEventListener("click", refreshPositions);
document.getElementById("focusBestQueue").addEventListener("click", focusBestQueue);
document.getElementById("autoFillCurrentPage").addEventListener("click", autoFillCurrentPage);
document.getElementById("autoFillCustomerInfo").addEventListener("click", autoFillCustomerInfo);
document.getElementById("autoFillPaymentInfo").addEventListener("click", autoFillPaymentInfo);
document.getElementById("autoFillCreditCardInfo").addEventListener("click", autoFillCreditCardInfo);
document.getElementById("assistNextButton").addEventListener("click", assistNextButton);

initLockedState();
loadSavedValues();
refreshPositions();
updateCurrentPageStatus();
setInterval(refreshPositions, 5000);
setInterval(updateCurrentPageStatus, 2500);
