document.addEventListener("DOMContentLoaded", async () => {
  // DOM Elements
  const addButton = document.getElementById("add-url");
  const customList = document.getElementById("custom-list");
  const customUrlInput = document.getElementById("custom-url");
  const blockSection = document.getElementById("block-section");
  const modal = document.getElementById("modal");
  const modalMessage = document.getElementById("modal-message");
  const modalClose = document.getElementById("modal-close");
  const blockCustomContainer = document.getElementById(
    "block-custom-container"
  );
  const recommendedList = document.getElementById("recommended-list");
  const seeRecommendedButton = document.getElementById("see-recommended");
  const popup = document.getElementById("recommended-popup");
  const closePopupButton = document.getElementById("close-popup");

  const RECOMMENDED_SITES = [
    "reddit.com",
    "quora.com", 
    "tiktok.com",
    "x.com"
  ];

  const BLOCKLIST_START = "# SalamGuard Blocklist Start";
  const BLOCKLIST_END = "# SalamGuard Blocklist End";

  let isHaramBlocked = false;
  let modalProgressBar;

  const tabs = document.querySelectorAll(".tab-item");

  // fetch data

  window.electron.checkBlocklistIntegrity();

  window.electron.onUpdateCustomList(renderCustomUrls);

  window.electron.receiveInitialConfig((config) => {
    isHaramBlocked = config.haramBlocked;
  });

  async function getHostsContent() {
    try {
      const hostsContent = await window.electron.readHostsFile();
      return hostsContent;
    } catch (error) {
      console.error("Failed to read hosts file:", error);
      throw error;
    }
  }

  window.electron.onVersionUpdateAvailable((versionInfo) => {
    showVersionUpdateModal(versionInfo);
  });

  async function fetchAndDisplayBlocklist() {
    try {
      const blocklist = await window.electron.getBlocklistUrls();
      return blocklist;
    } catch (error) {
      console.error("Failed to fetch blocklist:", error);
      throw error;
    }
  }

  // ui

  function showModal(message, showProgress = false, hideCloseButton = false) {
    console.log("showModal called with message:", message);
    modalMessage.textContent = message;
    if (showProgress) {
      if (!modalProgressBar) {
        modalProgressBar = document.createElement("progress");
        modalProgressBar.id = "modal-progress-bar";
        modalProgressBar.value = 0;
        modalProgressBar.max = 100;
        modalMessage.insertAdjacentElement("afterend", modalProgressBar);
      }
      modalProgressBar.classList.remove("hidden");
    } else {
      modalProgressBar?.classList.add("hidden");
    }

    if (hideCloseButton) {
      modalClose.classList.add("hidden");
    } else {
      modalClose.classList.remove("hidden");
    }
    modal.classList.remove("hidden");
  }

  const closeModal = () => {
    modal.classList.add("hidden");
    modal.classList.remove("show-progress");
  };

  // Event: Close Modal
  modalClose.addEventListener("click", () => {
    modal.classList.add("hidden");
    modalProgressBar?.classList.add("hidden");
  });

  function renderBlockSection(isBlocked, message, action = null) {
    if (isBlocked) {
      const header = document.querySelector("header");
      header.insertAdjacentHTML(
        "beforeend",
        `<div class="success-tag">${message}</div>`
      );
      const gridContainer = document.querySelector(".grid-container");
      gridContainer.style.display = "none"; // Completely hide the grid-container
      blockCustomContainer.classList.remove("hidden");
    } else {
      blockSection.innerHTML = `
          <div class="error-message">
              <h2>${message}</h2>
              ${
                action
                  ? `<button id="${action.buttonId}">${action.buttonText}</button>`
                  : ""
              }
          </div>`;

      if (action) {
        document
          .getElementById(action.buttonId)
          ?.addEventListener("click", action.onClick);
      }
    }
  }

  function updateUI(isBlocked = isHaramBlocked, message = "", action = null) {
    console.log("updateUI called with:", { isBlocked, message, action });
    if (isBlocked) {
      renderBlockSection(
        true,
        message || "You are currently being protected from Haram sites"
      );
    } else {
      renderBlockSection(
        false,
        message || "Your computer is unprotected",
        action || {
          buttonId: "block-haram",
          buttonText: "Block Haram Content",
          onClick: () => {
            showModal(
              "Blocking haram content... Please enter your password and wait a moment",
              true,
              true
            );
            window.electron.blockHaramContent();
          },
        }
      );
    }
  }

  // Render Custom URL List
  function renderCustomUrls(customUrls) {
    const uniqueDomains = [
      ...new Set(customUrls.map((url) => url.replace(/^www\./, ""))),
    ];
    customList.innerHTML = uniqueDomains.length
      ? uniqueDomains
          .map(
            (url) => `
              <li>
                ${url} <button class="remove-url" data-url="${url}">Unblock</button>
              </li>`
          )
          .join("")
      : "<p style='color: #8af6e5; font-size: 1.2rem; font-weight: 600; text-align: center; margin-top: 2rem; margin-bottom: 2rem; font-style: italic; font-family: 'SF Pro Text', 'SF Pro Icons', 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif;'>No additional sites are blocked</p>";
  }

  // Refresh Custom URL List
  async function refreshCustomList() {
    const customUrls = await window.electron.getCustomList();
    renderCustomUrls(customUrls);
  }

  // Function to clean up the URL to the correct format
  function cleanDomain(domain) {
    try {
      // Add "http://" if it's missing to parse with URL
      if (!domain.startsWith("http://") && !domain.startsWith("https://")) {
        domain = `http://${domain}`;
      }

      const url = new URL(domain);

      // Extract the hostname and remove "www."
      let cleanedDomain = url.hostname.replace(/^www\./, "");

      // Return the cleaned domain
      return cleanedDomain;
    } catch (error) {
      return null; // Invalid URL
    }
  }

  // Function to validate the domain
  function validateDomain(domain) {
    const cleanedDomain = cleanDomain(domain);
    if (!cleanedDomain) {
      return false; // Invalid domain
    }

    // Further validate cleaned domain
    const domainRegex = /^[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/;
    return domainRegex.test(cleanedDomain);
  }

  // Function to handle adding a custom URL
  function handleAddUrl() {
    const inputDomain = customUrlInput.value.trim();
    const cleanedDomain = cleanDomain(inputDomain);

    if (!cleanedDomain || !validateDomain(cleanedDomain)) {
      showModal(
        "❌ Please enter a valid domain in the correct format (e.g., youtube.com).",
        false
      );
      return;
    }

    // Show loading state
    addButton.disabled = true;
    addButton.textContent = "Adding...";

    // Submit the cleaned domain
    window.electron.addCustomUrl(cleanedDomain);

    // Clear the input field
    customUrlInput.value = "";
  }

  // Event: Add Custom URL when the button is clicked
  addButton?.addEventListener("click", handleAddUrl);

  // Event: Add Custom URL when Enter key is pressed
  customUrlInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handleAddUrl();
    }
  });

  // Event: Remove Custom URL (Event Delegation)
  customList?.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-url")) {
      const url = e.target.dataset.url;
      window.electron.removeCustomUrl(url, (success, updatedUrls) => {
        if (success) {
          renderCustomUrls(updatedUrls);
        } else {
          showModal("❌ Failed to remove the URL. Please try again.", false);
        }
      });
    }
  });

  window.electron.onBlocklistError((error) => {
    modalMessage.textContent = error;
    modalProgressBar?.classList.add("hidden");
  });

  window.electron.onBlockHaramSuccess((response) => {
    if (response.success) {
      window.electron.checkBlocklistIntegrity();
      window.electron.onBlocklistIntegrityStatus((isValid, result) => {
        if (result.status === 1) {
          isHaramBlocked = true;
          modal.classList.add("hidden");
          showModal("Your computer is now protected from over 50,000 Haram sites. You do not need to keep the app running for the block to work. Uninstalling the app will not remove the block.");
        } else {
          isHaramBlocked = false;
          modal.classList.add("hidden");
          showModal(
            "❌ Error: There was a problem. Feel free to email us for help at contact@salamguard.com."
          );
        }

        updateUI();
      });
    } else {
      modal.classList.add("hidden");
      showModal(`❌ Error: ${response.message}`);
    }
  });

  // Check Blocklist Integrity
  window.electron.onBlocklistIntegrityStatus((isValid, result) => {
    console.log('Blocklist integrity check result:', { isValid, result });  // Debug log
    const defaultMessage = "An issue was detected.";
    const message = result?.message || defaultMessage;

    switch (result?.status) {
      case 1:
        isHaramBlocked = true;
        updateUI(true, message);
        closeModal();
        break;
      case 2: // Case 1: Blocklist needs updating
        isHaramBlocked = false;
        updateUI(false, message, {
          buttonId: "rewrite-blocklist",
          buttonText: "Update Blocklist",
          onClick: async () => {
            showModal(
              "Blocking more sites... please enter your password and wait",
              true,
              true
            );
            try {
              const response = await updateHostsFile();
            } catch (error) {
              showModal(`❌ Error: ${error.message}`, false);
            }
          },
        });
        break;
      case 3: // Blocklist needs rewriting
        isHaramBlocked = false;
        updateUI(false, message, {
          buttonId: "rewrite-blocklist",
          buttonText: "Block Sites",
          onClick: async () => {
            showModal(
              "Blocking sites... please enter your password and wait",
              true,
              true
            );
            try {
              const response = await rewriteHostsFile(true);
            } catch (error) {
              updateUI(false, `Error: ${error.message}`);
            }
          },
        });
        break;
    }
  });

  async function rewriteHostsFile(preserveUrls) {
    try {
      let newHostsContent;

      const spacerLines = "\n".repeat(10000); // 10,000 blank lines

      const blocklistUrls = await window.electron.getBlocklistUrls();

      // Load custom URLs using IPC or fetch
      const customURLs = (await window.electron.getCustomList()) || [];

      const blocklistSet = new Set(blocklistUrls);
      const normalizeDomain = (domain) => domain.replace(/^www\./, "");

      if (preserveUrls) {
        const currentHostsContent = await getHostsContent();
        const currentHosts = currentHostsContent
          .split("\n")
          .map((line) => line.trim());

        const nonBlocklistUrls = currentHosts.filter((line) => {
          const [ip, domain] = line.split(/\s+/);

          if (!domain || line.startsWith("#")) {
            return true; // Keep comments and invalid lines
          }

          const normalizedDomain = normalizeDomain(domain);

          return (
            !blocklistSet.has(normalizedDomain) &&
            !blocklistSet.has(domain) &&
            !customURLs.includes(normalizedDomain)
          );
        });

        const blocklistSection = [
          BLOCKLIST_START,
          ...customURLs.map((url) => `127.0.0.1 ${url}\n127.0.0.1 www.${url}`),
          ...Array.from(blocklistSet).map((url) => `127.0.0.1 ${url}\n127.0.0.1 www.${url}`),
          BLOCKLIST_END,
        ].join("\n");

        newHostsContent = [
          ...nonBlocklistUrls,
          spacerLines,
          blocklistSection,
        ].join("\n");
      } else {
        const blocklistSection = [
          BLOCKLIST_START,
          ...customURLs.map((url) => `127.0.0.1 ${url}\n127.0.0.1 www.${url}`),
          ...blocklistUrls.map((url) => `127.0.0.1 ${url}\n127.0.0.1 www.${url}`),
          BLOCKLIST_END,
        ].join("\n");

        newHostsContent = [spacerLines, blocklistSection].join("\n"); // Add spacer
      }

      // Send the new hosts content to the IPC handler
      return new Promise((resolve, reject) => {
        window.electron.rewriteHosts(newHostsContent, (success, response) => {
          if (success) {
            resolve(response);
          } else {
            reject(
              new Error(response.message || "Failed to rewrite hosts file.")
            );
          }
        });
      });
    } catch (error) {
      console.error("Error in rewriteHostsFile:", error);
      throw new Error("Failed to rewrite the hosts file.");
    }
  }

  async function updateHostsFile() {
    const normalizeDomain = (domain) => domain.replace(/^www\./, "");
    const spacerLines = "\n".repeat(10000); // 10,000 blank lines

    try {
      // Fetch current hosts file content
      const currentHostsContent = await getHostsContent();
      const currentHosts = currentHostsContent
        .split("\n")
        .map((line) => line.trim());

      // Fetch updated blocklist
      const blocklistUrls = await window.electron.getBlocklistUrls();
      const blocklistDomains = new Set(blocklistUrls);

      // Extract existing blocklist section
      const existingBlocklistStartIndex = currentHosts.indexOf(BLOCKLIST_START);
      const existingBlocklistEndIndex = currentHosts.indexOf(BLOCKLIST_END);

      let existingBlocklist = new Set();
      if (
        existingBlocklistStartIndex !== -1 &&
        existingBlocklistEndIndex !== -1
      ) {
        for (
          let i = existingBlocklistStartIndex + 1;
          i < existingBlocklistEndIndex;
          i++
        ) {
          const parts = currentHosts[i].split(/\s+/);
          if (parts.length > 1) existingBlocklist.add(parts[1]); // Extract domain
        }
      }

      // Merge blocklist: Add only new domains
      const updatedBlocklist = new Set([...existingBlocklist]);
      blocklistDomains.forEach((domain) => {
        const normalizedDomain = normalizeDomain(domain);
        const wwwDomain = `www.${normalizedDomain}`;

        // Add both "www." and non-"www." versions if they are not already present
        if (!updatedBlocklist.has(normalizedDomain)) {
          updatedBlocklist.add(normalizedDomain);
        }
        if (!updatedBlocklist.has(wwwDomain)) {
          updatedBlocklist.add(wwwDomain);
        }
      });

      // Format blocklist for hosts file
      const blocklistSection = [
        BLOCKLIST_START,
        ...Array.from(updatedBlocklist).map((domain) => `127.0.0.1 ${domain}\n127.0.0.1 www.${domain}`),
        BLOCKLIST_END,
      ];

      // Rebuild hosts file
      const nonBlocklistLines = currentHosts.filter(
        (line, index) =>
          index < existingBlocklistStartIndex ||
          index > existingBlocklistEndIndex
      );
      const newHostsContent = [
        spacerLines,
        ...nonBlocklistLines,
        ...blocklistSection,
      ].join("\n");

      return await new Promise((resolve, reject) => {
        window.electron.rewriteHosts(newHostsContent, (success, response) => {
          if (success) {
            resolve(response);
          } else {
            reject(
              new Error(response.message || "Failed to rewrite hosts file.")
            );
          }
        });
      });
    } catch (error) {
      console.error("Error in updateHostsFile:", error);
      throw new Error("Failed to rewrite the hosts file.");
    }
  }

  // Add event listeners to each tab
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      // Remove active class from all tabs
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      // Hide all tab contents
      const tabContents = document.querySelectorAll(".tab-content");
      tabContents.forEach((content) => content.classList.add("hidden"));

      // Show the selected tab content
      const targetId = tab.dataset.target;
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.remove("hidden");
      }
    });
  });

  // Optionally, activate the first tab by default
  const firstTab = document.querySelector(".tab-item");
  if (firstTab) {
    firstTab.click();
  }

  async function verifyBlockedUrls() {
    try {
      const hostsContent = await window.electron.readHostsFile();
      const hostsLines = hostsContent.split('\n');
      
      // Get current custom URLs - now returns a Promise
      const customUrls = await window.electron.getCustomList();
      const urlsToRemove = [];
  
      // Check each custom URL
      for (const url of customUrls) {
        const cleanUrl = url.replace(/^www\./, "");
        const isBlocked = hostsLines.some(line => {
          const trimmedLine = line.trim();
          return (
            trimmedLine.includes(`127.0.0.1 ${cleanUrl}`) || 
            trimmedLine.includes(`127.0.0.1 www.${cleanUrl}`)
          );
        });
  
        if (!isBlocked) {
          urlsToRemove.push(url);
        }
      }
  
      // If we found unblocked URLs, remove them from customUrls.json
      if (urlsToRemove.length > 0) {
        const updatedUrls = customUrls.filter(url => !urlsToRemove.includes(url));
        await window.electron.updateCustomUrlsJson(updatedUrls);
        renderCustomUrls(updatedUrls);
      } else {
        renderCustomUrls(customUrls);
      }
    } catch (error) {
      console.error('Error verifying blocked URLs:', error);
    }
  }
  

  function initializeRecommendedSites() {
    const recommendedList = document.getElementById("recommended-list");
    const seeRecommendedButton = document.getElementById("see-recommended");
    const popup = document.getElementById("recommended-popup");
    const closePopupButton = document.getElementById("close-popup");

    // Show/hide popup handlers
    seeRecommendedButton.addEventListener("click", () => popup.style.display = "flex");
    closePopupButton.addEventListener("click", () => popup.style.display = "none");

    async function refreshRecommendedList() {
      const customUrls = await window.electron.getCustomList();
      recommendedList.innerHTML = '';

      RECOMMENDED_SITES.forEach(site => {
        const isBlocked = customUrls.includes(site);
        const li = document.createElement("li");
        
        // Create span for site name
        const siteSpan = document.createElement("span");
        siteSpan.textContent = site;
        li.appendChild(siteSpan);

        // Create button with updated styling
        const button = document.createElement("button");
        button.textContent = isBlocked ? "Unblock" : "Block";
        button.className = "aesthetic-button";
        button.setAttribute("data-state", isBlocked ? "blocked" : "unblocked");
        
        // Add hover effect
        button.addEventListener("mouseover", () => {
          if (isBlocked) {
            button.textContent = "Unblock";
          }
        });

        button.addEventListener("mouseout", () => {
          if (isBlocked) {
            button.textContent = "Blocked";
          }
        });

        button.addEventListener("click", () => handleSiteToggle(site, button));
        
        li.appendChild(button);
        recommendedList.appendChild(li);
      });

      // Update visibility of recommended button
      const allBlocked = customUrls.length >= RECOMMENDED_SITES.length && 
        RECOMMENDED_SITES.every(site => customUrls.includes(site));
      seeRecommendedButton.style.display = allBlocked ? "none" : "inline-block";
    }

    async function handleSiteToggle(site, button) {
      if (button.textContent === "Block") {
        await window.electron.addCustomUrl(site);
        button.textContent = "Unblock";
      } else {
        await window.electron.removeCustomUrl(site);
        button.textContent = "Block";
      }
      refreshRecommendedList();
    }

    // Initial render
    refreshRecommendedList();

    // Listen for custom list updates
    window.electron.onUpdateCustomList(() => refreshRecommendedList());
  }

  initializeRecommendedSites();

  // Enhance the update listener
  window.electron.onUpdateCustomList((customUrls) => {
    console.log("Received custom URL update:", customUrls);
    renderCustomUrls(customUrls);
    // Reset button state
    addButton.disabled = false;
    addButton.textContent = "Block Website";
  });

  // Initialize App
  await verifyBlockedUrls();
});

function showVersionUpdateModal(versionInfo) {
  const versionModal = document.getElementById("version-modal");
  const versionModalMessage = document.getElementById("version-modal-message");
  const versionModalClose = document.getElementById("version-modal-close");

  versionModalMessage.innerHTML = `A new version of SalamGuard is available (${versionInfo.latest}).<br><br>
    Please visit <a href="https://salamguard.com/mac" target="_blank" style="color: #8af6e5;">salamguard.com/mac</a> to download the latest version.`;
  
  versionModal.classList.remove("hidden");
  
  versionModalClose.addEventListener("click", () => {
    versionModal.classList.add("hidden");
  }, { once: true });
}

