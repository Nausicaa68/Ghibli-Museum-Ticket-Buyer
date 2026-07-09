(function () {
  function readQueuePosition() {
    const element = document.getElementById("MainPart_lbUsersInLineAheadOfYou");

    if (!element) {
      return null;
    }

    const rawText = element.textContent.trim();
    const cleaned = rawText.replace(/[^\d]/g, "");

    if (!cleaned) {
      return null;
    }

    return parseInt(cleaned, 10);
  }

  function readEstimatedTime() {
    const element = document.getElementById("MainPart_lbWhichIsIn");

    if (!element) {
      return null;
    }

    const text = element.textContent.trim();

    return text || null;
  }

  function detectStatus() {
    if (location.hostname.includes("queue-it.net")) {
      return "queue";
    }

    if (location.hostname.includes("l-tike.com")) {
      return "entered";
    }

    return "unknown";
  }

  function autoClickCommonErrorToTop() {
    if (!location.hostname.includes("l-tike.com")) {
      return false;
    }

    const topButton =
      document.getElementById("TOP") ||
      document.querySelector('input[name="TOP"][value="To Top"]') ||
      document.querySelector('input[type="button"][value="To Top"]');

    if (!topButton) {
      return false;
    }

    const pageText = document.body ? document.body.innerText : "";

    const isCommonErrorPage =
      document.title.trim().toLowerCase() === "common error" ||
      pageText.includes("There was an unrecognized operation") ||
      pageText.includes("Please try again from the top screen");

    if (!isCommonErrorPage) {
      return false;
    }

    if (window.__gmtbCommonErrorAlreadyClicked) {
      return true;
    }

    window.__gmtbCommonErrorAlreadyClicked = true;

    setTimeout(() => {
      topButton.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

      topButton.focus();

      topButton.dispatchEvent(new MouseEvent("mouseover", {
        bubbles: true,
        cancelable: true,
        view: window
      }));

      topButton.dispatchEvent(new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        view: window
      }));

      topButton.dispatchEvent(new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
        view: window
      }));

      topButton.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window
      }));

      topButton.click();

      setTimeout(() => {
        const stillOnCommonError =
          document.title.trim().toLowerCase() === "common error" ||
          document.body.innerText.includes("There was an unrecognized operation");

        if (stillOnCommonError) {
          const form = document.getElementById("ttx100");

          if (form) {
            form.submit();
          }
        }
      }, 1500);
    }, 600);

    return true;
  }

  function autoAcceptTermsOfUse() {
    if (!location.hostname.includes("l-tike.com")) {
      return false;
    }

    const consentCheckbox = document.getElementById("CONSENT_CHK_BOX");
    const nextButton = document.getElementById("NEXT");

    if (!consentCheckbox || !nextButton) {
      return false;
    }

    const pageText = document.body ? document.body.innerText : "";

    const isTermsOfUsePage =
      document.title.trim().toLowerCase() === "terms of use" ||
      pageText.includes("Terms of Use") ||
      pageText.includes("If you agree to the Terms of Use");

    if (!isTermsOfUsePage) {
      return false;
    }

    if (window.__gmtbTermsAlreadyAccepted) {
      return true;
    }

    window.__gmtbTermsAlreadyAccepted = true;

    setTimeout(() => {
      consentCheckbox.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

      if (!consentCheckbox.checked) {
        consentCheckbox.focus();

        consentCheckbox.dispatchEvent(new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          view: window
        }));

        consentCheckbox.dispatchEvent(new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          view: window
        }));

        consentCheckbox.click();

        consentCheckbox.dispatchEvent(new Event("input", {
          bubbles: true
        }));

        consentCheckbox.dispatchEvent(new Event("change", {
          bubbles: true
        }));
      }

      setTimeout(() => {
        nextButton.disabled = false;
        nextButton.removeAttribute("disabled");
        nextButton.classList.remove("nonActive");

        nextButton.focus();

        nextButton.dispatchEvent(new MouseEvent("mouseover", {
          bubbles: true,
          cancelable: true,
          view: window
        }));

        nextButton.dispatchEvent(new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          view: window
        }));

        nextButton.dispatchEvent(new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          view: window
        }));

        nextButton.dispatchEvent(new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window
        }));

        nextButton.click();

        setTimeout(() => {
          const stillOnTermsPage =
            document.title.trim().toLowerCase() === "terms of use" ||
            document.body.innerText.includes("If you agree to the Terms of Use");

          if (stillOnTermsPage) {
            const form = document.getElementById("ttg010");

            if (form) {
              form.submit();
            }
          }
        }, 1500);
      }, 500);
    }, 600);

    return true;
  }

  async function sendQueuePosition() {
    const position = readQueuePosition();
    const estimatedTime = readEstimatedTime();

    await browser.runtime.sendMessage({
      action: "queuePosition",
      position,
      estimatedTime,
      status: detectStatus()
    });
  }

  function triggerEvents(element) {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function setValue(id, value) {
    const element = document.getElementById(id);

    if (!element || value === undefined || value === null || value === "") {
      return false;
    }

    element.value = value;
    triggerEvents(element);

    return true;
  }

async function highlightNextButton() {
  const button =
    document.getElementById("NEXT_BUTTON") ||
    document.getElementById("NEXT") ||
    document.getElementById("ENTRY_FIX") ||
    document.querySelector('input[value="Purchase"]') ||
    document.querySelector('input[value="Credit Input"]');

  if (!button) {
    return false;
  }

  button.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  button.style.outline = "5px solid red";
  button.style.outlineOffset = "4px";
  button.style.boxShadow = "0 0 14px red";

  const data = await browser.storage.local.get("autoClickNextEnabled");

//   if (data.autoClickNextEnabled === true) {
//     setTimeout(() => {
//       button.focus();

//       button.dispatchEvent(new MouseEvent("mouseover", {
//         bubbles: true,
//         cancelable: true,
//         view: window
//       }));

//       button.dispatchEvent(new MouseEvent("mousedown", {
//         bubbles: true,
//         cancelable: true,
//         view: window
//       }));

//       button.dispatchEvent(new MouseEvent("mouseup", {
//         bubbles: true,
//         cancelable: true,
//         view: window
//       }));

//       button.dispatchEvent(new MouseEvent("click", {
//         bubbles: true,
//         cancelable: true,
//         view: window
//       }));

//       button.click();
//     }, 1000);
//   }

if (data.autoClickNextEnabled === true) {
  let attempts = 0;
  const maxAttempts = 5;
  const delayMs = 1000;

  const clickInterval = setInterval(() => {
    attempts++;

    if (!document.body.contains(button)) {
      clearInterval(clickInterval);
      return;
    }

    button.focus();

    button.dispatchEvent(new MouseEvent("mouseover", {
      bubbles: true,
      cancelable: true,
      view: window
    }));

    button.dispatchEvent(new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      view: window
    }));

    button.dispatchEvent(new MouseEvent("mouseup", {
      bubbles: true,
      cancelable: true,
      view: window
    }));

    button.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window
    }));

    button.click();

    if (attempts >= maxAttempts) {
      clearInterval(clickInterval);
    }
  }, delayMs);
}

  return true;
}

  async function autoFillSupportedPageIfEnabled() {
    const data = await browser.storage.local.get([
      "autoFillEnabled",

      "savedEmail",
      "savedPhone",

      "savedPassword",
      "savedGivenName",
      "savedSurname",
      "savedJapanAddress",
      "savedPassport",
      "savedCountry",

      "savedCardNumber",
      "savedCardholder",
      "savedExpiryMonth",
      "savedExpiryYear",
      "savedSecurityCode",
      "savedDisabilityCertificate"
    ]);

    if (data.autoFillEnabled !== true) {
      return;
    }

    let filled = false;

    const isCustomerInfoPage =
      document.getElementById("MAIL_ADDRS") &&
      document.getElementById("TEL");

    const isPaymentApplicantPage =
      document.getElementById("PWD") &&
      document.getElementById("APLCT_FIRST_NAME");

    const isCreditCardPage =
      document.getElementById("pan") &&
      document.getElementById("3DS_NAME");

    if (isCustomerInfoPage) {
      const email = data.savedEmail || "";
      const phone = data.savedPhone || "";

      setValue("MAIL_ADDRS", email);
      setValue("MAIL_ADDRS_CONFIRM", email);
      setValue("TEL", phone);
      setValue("TEL_CONFIRM", phone);

      filled = true;
    }

    if (isPaymentApplicantPage) {
      const password = data.savedPassword || "";

      setValue("PWD", password);
      setValue("PWD_CNF", password);
      setValue("APLCT_FIRST_NAME", data.savedGivenName || "");
      setValue("APLCT_LAST_NAME", data.savedSurname || "");
      setValue("q_1", data.savedJapanAddress || "");
      setValue("q_2", data.savedPassport || "");
      setValue("q_3", data.savedCountry || "");
      setValue("q_4", data.savedDisabilityCertificate || "");

      filled = true;
    }

    if (isCreditCardPage) {
      const expiryMonth = (data.savedExpiryMonth || "").padStart(2, "0");
      const expiryYear = data.savedExpiryYear || "";

      setValue("pan", data.savedCardNumber || "");
      setValue("3DS_NAME", (data.savedCardholder || "").toUpperCase());
      setValue("EXPIRE_MONTH", expiryMonth);
      setValue("EXPIRE_YR", expiryYear);
      setValue("securityCode", data.savedSecurityCode || "");

      const cardExpire = document.getElementById("cardexpire");

      if (cardExpire && expiryMonth && expiryYear) {
        cardExpire.value = `${expiryMonth}/${expiryYear}`;
        triggerEvents(cardExpire);
      }

      filled = true;
    }

    const isConfirmBookingPage =
  document.getElementById("ENTRY_FIX") &&
  document.getElementById("ttg080");

if (isConfirmBookingPage) {
  filled = true;
}

    if (filled) {
  setTimeout(() => {
    highlightNextButton();
  }, 400);
}
  }

  const commonErrorInterval = setInterval(() => {
    if (autoClickCommonErrorToTop()) {
      clearInterval(commonErrorInterval);
    }
  }, 500);

  setTimeout(() => {
    clearInterval(commonErrorInterval);
  }, 10000);

  const termsOfUseInterval = setInterval(() => {
    if (autoAcceptTermsOfUse()) {
      clearInterval(termsOfUseInterval);
    }
  }, 500);

  setTimeout(() => {
    clearInterval(termsOfUseInterval);
  }, 10000);

  sendQueuePosition();
  setInterval(sendQueuePosition, 5000);

  setTimeout(autoFillSupportedPageIfEnabled, 800);
  setTimeout(autoFillSupportedPageIfEnabled, 2000);
  setTimeout(autoFillSupportedPageIfEnabled, 4000);

})();