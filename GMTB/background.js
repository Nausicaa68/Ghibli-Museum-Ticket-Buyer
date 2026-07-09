const COLORS = [
  "blue",
  "turquoise",
  "green",
  "yellow",
  "orange",
  "red",
  "pink",
  "purple"
];

const ICONS = [
  "fingerprint",
  "briefcase",
  "dollar",
  "cart",
  "vacation",
  "gift",
  "food",
  "fruit",
  "pet",
  "tree",
  "chill",
  "circle",
  "fence"
];

const MAX_TABS = 104;

async function getOrCreateContainer(index) {
  const name = `Ghibli ${index}`;
  const existing = await browser.contextualIdentities.query({ name });

  if (existing.length > 0) {
    return existing[0];
  }

  const color = COLORS[(index - 1) % COLORS.length];
  const icon = ICONS[Math.floor((index - 1) / COLORS.length) % ICONS.length];

  return browser.contextualIdentities.create({
    name,
    color,
    icon
  });
}

async function saveOpenedTab(tabId) {
  const data = await browser.storage.local.get("openedTabs");
  const openedTabs = data.openedTabs || [];

  openedTabs.push(tabId);

  await browser.storage.local.set({ openedTabs });
}

async function openTabs(url, tabCount) {
  tabCount = Math.min(tabCount, MAX_TABS);

  await browser.storage.local.set({
    openedTabs: [],
    queuePositions: {}
  });

  for (let i = 1; i <= tabCount; i++) {
    const container = await getOrCreateContainer(i);

    const tab = await browser.tabs.create({
      url,
      cookieStoreId: container.cookieStoreId,
      active: i === 1
    });

    await saveOpenedTab(tab.id);
  }
}

async function clearLTakeCookies() {
  const identities = await browser.contextualIdentities.query({});
  const storeIds = [
    "firefox-default",
    ...identities.map(identity => identity.cookieStoreId)
  ];

  const domains = [
    "l-tike.com",
    ".l-tike.com"
  ];

  for (const storeId of storeIds) {
    for (const domain of domains) {
      const cookies = await browser.cookies.getAll({
        domain,
        storeId
      });

      for (const cookie of cookies) {
        const cleanDomain = cookie.domain.replace(/^\./, "");
        const protocol = cookie.secure ? "https://" : "http://";
        const url = `${protocol}${cleanDomain}${cookie.path}`;

        try {
          await browser.cookies.remove({
            url,
            name: cookie.name,
            storeId
          });
        } catch (e) {
          console.error("Failed to remove cookie:", cookie.name, storeId, e);
        }
      }
    }
  }
}

async function closeTabs() {
  const data = await browser.storage.local.get("openedTabs");
  const openedTabs = data.openedTabs || [];

  for (const tabId of openedTabs) {
    try {
      await browser.tabs.remove(tabId);
    } catch (e) {
      console.error("Failed to close tab:", tabId, e);
    }
  }

  await clearLTakeCookies();

  await browser.storage.local.set({
    openedTabs: [],
    queuePositions: {}
  });
}

async function saveQueuePosition(message, sender) {
  if (!sender.tab || !sender.tab.id) {
    return;
  }

  const tabId = sender.tab.id;
  const cookieStoreId = sender.tab.cookieStoreId;

  let containerName = "Default";

  const identities = await browser.contextualIdentities.query({});
  const identity = identities.find(item => item.cookieStoreId === cookieStoreId);

  if (identity) {
    containerName = identity.name;
  }

  const data = await browser.storage.local.get("queuePositions");
  const queuePositions = data.queuePositions || {};
  const previous = queuePositions[tabId];

  queuePositions[tabId] = {
    tabId,
    containerName,
    cookieStoreId,
    position: message.position,
    estimatedTime: message.estimatedTime || null,
    updatedAt: new Date().toISOString(),
    status: message.status || "queue",
    notifiedAtPositionOne: previous ? previous.notifiedAtPositionOne : false
  };

  await browser.storage.local.set({ queuePositions });

  const shouldNotifyPositionOne =
    message.position === 1 &&
    (!previous || previous.notifiedAtPositionOne !== true);

  if (shouldNotifyPositionOne) {
    queuePositions[tabId].notifiedAtPositionOne = true;
    await browser.storage.local.set({ queuePositions });

    browser.notifications.create(`position-one-${tabId}`, {
      type: "basic",
      title: "Ghibli Ticket Queue",
      message: `${containerName} is now position 1 in the queue.`
    });
  }
}

async function deleteUnusedContainers() {
  const identities = await browser.contextualIdentities.query({});
  const tabs = await browser.tabs.query({});

  const usedStoreIds = new Set(
    tabs
      .map(tab => tab.cookieStoreId)
      .filter(Boolean)
  );

  for (const identity of identities) {
    if (
      identity.name.startsWith("Ghibli ") &&
      !usedStoreIds.has(identity.cookieStoreId)
    ) {
      try {
        await browser.contextualIdentities.remove(identity.cookieStoreId);
      } catch (e) {
        console.error("Failed to delete container:", identity.name, e);
      }
    }
  }
}

const AUTO_VALIDATE_URL_PATTERNS = [
  "https://l-tike.com/*"
];

function canAutoValidateTab(tab) {
  return (
    tab &&
    tab.id &&
    tab.url &&
    tab.url.startsWith("https://l-tike.com/")
  );
}

async function injectAutoValidation(tabId) {
  try {
    await browser.tabs.executeScript(tabId, {
      runAt: "document_idle",
      code: `
        (function () {
          function submitFormSafely(form) {
            if (!form) {
              return false;
            }

            form.submit();
            return true;
          }

          function handleCommonError() {
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

            if (!isCommonErrorPage || window.__gmtbCommonErrorHandled) {
              return false;
            }

            window.__gmtbCommonErrorHandled = true;

            const form = document.getElementById("ttx100");

            topButton.disabled = false;
            topButton.removeAttribute("disabled");

            topButton.dispatchEvent(new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window
            }));

            topButton.click();

            setTimeout(function () {
              submitFormSafely(form);
            }, 300);

            return true;
          }

          function handleTermsOfUse() {
            const consentCheckbox = document.getElementById("CONSENT_CHK_BOX");
            const nextButton = document.getElementById("NEXT");
            const form = document.getElementById("ttg010");

            if (!consentCheckbox || !nextButton || !form) {
              return false;
            }

            const pageText = document.body ? document.body.innerText : "";

            const isTermsOfUsePage =
              document.title.trim().toLowerCase() === "terms of use" ||
              pageText.includes("If you agree to the Terms of Use") ||
              pageText.includes("Terms of Use");

            if (!isTermsOfUsePage || window.__gmtbTermsHandled) {
              return false;
            }

            window.__gmtbTermsHandled = true;

            consentCheckbox.checked = true;

            consentCheckbox.dispatchEvent(new Event("input", {
              bubbles: true
            }));

            consentCheckbox.dispatchEvent(new Event("change", {
              bubbles: true
            }));

            nextButton.disabled = false;
            nextButton.removeAttribute("disabled");
            nextButton.classList.remove("nonActive");

            nextButton.dispatchEvent(new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window
            }));

            nextButton.click();

            setTimeout(function () {
              submitFormSafely(form);
            }, 300);

            return true;
          }

          function handleTopPageScrollBottom() {
            const pageText = document.body ? document.body.innerText : "";

            const isTopPage =
              document.title.trim().toLowerCase() === "top" &&
              (
                document.getElementById("ttg030") ||
                document.querySelector(".ENTRY_DETAIL_BUTTON") ||
                pageText.includes("Application can be made at the bottom of this page")
              );

            if (!isTopPage || window.__gmtbTopPageScrolledBottom) {
              return false;
            }

            window.__gmtbTopPageScrolledBottom = true;

            function scrollToBottom() {
              const height = Math.max(
                document.body ? document.body.scrollHeight : 0,
                document.documentElement ? document.documentElement.scrollHeight : 0
              );

              window.scrollTo(0, height);

              if (document.documentElement) {
                document.documentElement.scrollTop = height;
              }

              if (document.body) {
                document.body.scrollTop = height;
              }
            }

            setTimeout(scrollToBottom, 800);
            setTimeout(scrollToBottom, 1600);
            setTimeout(scrollToBottom, 3000);
            setTimeout(scrollToBottom, 5000);

            return true;
          }

          handleCommonError();
          handleTermsOfUse();
          handleTopPageScrollBottom();
        })();
      `
    });
  } catch (error) {
    // Ignore tabs that are not ready anymore, closed, or not scriptable.
  }
}

async function autoValidateOpenedTabs() {
  const data = await browser.storage.local.get("openedTabs");
  const openedTabs = data.openedTabs || [];

  for (const tabId of openedTabs) {
    try {
      const tab = await browser.tabs.get(tabId);

      if (canAutoValidateTab(tab)) {
        await injectAutoValidation(tabId);
      }
    } catch (error) {
      // Tab closed or unavailable.
    }
  }
}

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    canAutoValidateTab(tab)
  ) {
    injectAutoValidation(tabId);
  }
});

setInterval(autoValidateOpenedTabs, 2000);

browser.runtime.onMessage.addListener((message, sender) => {
  if (message.action === "openTabs") {
    openTabs(message.url, message.tabCount);
  }

  if (message.action === "closeTabs") {
    closeTabs();
  }

  if (message.action === "queuePosition") {
    saveQueuePosition(message, sender);
  }

  if (message.action === "deleteUnusedContainers") {
    deleteUnusedContainers();
  }
});