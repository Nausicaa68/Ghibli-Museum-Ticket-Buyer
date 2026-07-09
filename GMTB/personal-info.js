const FIELDS = {
  savedEmail: "emailInput",
  savedPhone: "phoneInput",
  savedPassword: "passwordInput",
  savedGivenName: "givenNameInput",
  savedSurname: "surnameInput",
  savedJapanAddress: "japanAddressInput",
  savedPassport: "passportInput",
  savedCountry: "countryInput",
  savedDisabilityCertificate: "disabilityCertificateInput",
  savedCardNumber: "cardNumberInput",
  savedCardholder: "cardholderInput",
  savedExpiryMonth: "expiryMonthInput",
  savedExpiryYear: "expiryYearInput",
  savedSecurityCode: "securityCodeInput"
};

const fieldEntries = Object.entries(FIELDS).map(([storageKey, elementId]) => ({
  storageKey,
  element: document.getElementById(elementId)
}));

const validationStatus = document.getElementById("validationStatus");
const saveStatus = document.getElementById("saveStatus");

function showSaveStatus(message, type = "success") {
  saveStatus.textContent = message;
  saveStatus.className = `status-line ${type}`.trim();
}

async function loadProfile() {
  const data = await browser.storage.local.get(Object.keys(FIELDS));

  for (const { storageKey, element } of fieldEntries) {
    element.value = data[storageKey] || "";
  }

  validateInputs();
}

async function saveProfile() {
  const payload = {};

  for (const { storageKey, element } of fieldEntries) {
    const value = element.value.trim();
    payload[storageKey] = storageKey === "savedCardholder" ? value.toUpperCase() : value;
  }

  await browser.storage.local.set(payload);
  showSaveStatus("Saved locally.");
  validateInputs();
}

function validateInputs() {
  const get = id => document.getElementById(id).value.trim();
  const errors = [];
  const email = get("emailInput");
  const password = get("passwordInput");
  const cardNumber = get("cardNumberInput");
  const expiryMonth = get("expiryMonthInput");
  const expiryYear = get("expiryYearInput");
  const securityCode = get("securityCodeInput");

  if (email && !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    errors.push("Invalid email");
  }

  if (password && password.length !== 4) {
    errors.push("Password must be 4 characters");
  }

  if (cardNumber && !/^\d{16}$/.test(cardNumber)) {
    errors.push("Card number must contain 16 digits");
  }

  if (expiryMonth && !/^(0?[1-9]|1[0-2])$/.test(expiryMonth)) {
    errors.push("Invalid expiry month");
  }

  if (expiryYear && !/^\d{4}$/.test(expiryYear)) {
    errors.push("Expiry year must contain 4 digits");
  }

  if (securityCode && !/^\d{3,4}$/.test(securityCode)) {
    errors.push("Invalid security code");
  }

  if (errors.length === 0) {
    validationStatus.textContent = "Validation: OK";
    validationStatus.className = "status-line success";
  } else {
    validationStatus.textContent = errors.join(" | ");
    validationStatus.className = "status-line error";
  }
}

async function clearSavedFormData() {
  const confirmed = confirm("Delete all saved form data from this extension?");

  if (!confirmed) {
    return;
  }

  await browser.storage.local.remove(Object.keys(FIELDS));

  for (const { element } of fieldEntries) {
    element.value = "";
  }

  showSaveStatus("Saved form data deleted.");
  validateInputs();
}

async function fillWithTestData() {
  const testValues = window.GMTB_TEST_VALUES || {};

  for (const { storageKey, element } of fieldEntries) {
    if (Object.prototype.hasOwnProperty.call(testValues, storageKey)) {
      element.value = testValues[storageKey];
    }
  }

  await saveProfile();
  showSaveStatus("Test values loaded and saved locally.");
  validateInputs();
}

async function openPinnedPopup() {
  await browser.windows.create({
    url: browser.runtime.getURL("popup.html?locked=1"),
    type: "popup",
    width: 480,
    height: 760
  });
}

for (const { element } of fieldEntries) {
  element.addEventListener("input", async () => {
    await saveProfile();
  });
}

document.getElementById("saveProfile").addEventListener("click", saveProfile);
document.getElementById("clearSavedData").addEventListener("click", clearSavedFormData);
document.getElementById("openPinnedPopup").addEventListener("click", openPinnedPopup);
document.getElementById("fillTestData").addEventListener("click", fillWithTestData);

loadProfile();
