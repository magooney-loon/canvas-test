/**
 * Store for token information
 * @type {Map<string, Object>}
 */
const tokenStore = new Map();

/**
 * Currently active token address
 * @type {string|null}
 */
let activeTokenAddress = null;

/**
 * Price refresh interval ID
 * @type {number|null}
 */
let priceRefreshInterval = null;

/**
 * User settings object
 * @type {Object}
 */
const userSettings = {
    apiKey: '',
    theme: 'dark'
};

/**
 * Wait for the DOM to be fully loaded before initializing the app
 */
document.addEventListener('DOMContentLoaded', () => {
    // Register service worker for PWA functionality
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    }

    // Get element references
    const addTab = document.getElementById('add-tab');
    const tabCloseButton = document.getElementById('tab-close-button');
    const tabsBar = document.getElementById('tabs-bar');
    const settingsButton = document.getElementById('settings-button');

    // Add event listeners
    addTab.addEventListener('click', promptForTokenAddress);
    tabCloseButton.addEventListener('click', closeCurrentTab);
    
    // Delegate tab click events, excluding the add tab
    tabsBar.addEventListener('click', (event) => {
        const tab = event.target.closest('.tab:not(.add-tab)');
        if (tab) {
            const address = tab.dataset.address;
            setActiveToken(address);
        }
    });
    
    // Add copy-to-clipboard functionality for addresses
    document.body.addEventListener('click', (event) => {
        const addressElement = event.target.closest('.address-value');
        if (addressElement) {
            const address = addressElement.dataset.address;
            if (address) {
                navigator.clipboard.writeText(address).then(() => {
                    // Show tooltip or feedback
                    const originalText = addressElement.textContent;
                    addressElement.textContent = 'Copied!';
                    setTimeout(() => {
                        addressElement.textContent = originalText;
                    }, 1000);
                });
            }
        }
    });

    // Initialize settings button
    settingsButton.addEventListener('click', () => {
        const settingsModal = document.getElementById('settings-modal');
        settingsModal.classList.remove('hidden');
        setTimeout(() => {
            settingsModal.classList.add('active');
        }, 10);
    });

    // Initialize settings
    initSettings();

    // Load saved tabs
    loadSavedTabs();
    
    // Show Birdeye iframe by default (even without tokens)
    const birdeyeContainer = document.getElementById('birdeye-iframe-container');
    if (birdeyeContainer) {
        birdeyeContainer.classList.remove('hidden');
        
        // If no token is selected, load the default SOL chart
        if (!activeTokenAddress) {
            loadBirdeyeIframe('So11111111111111111111111111111111111111112');
        }
    }
    
    // Initialize Jupiter Terminal in integrated mode
    initJupiterTerminal();
});

/**
 * Initialize Jupiter Terminal in integrated mode
 */
function initJupiterTerminal() {
    // Get initial input mint based on active token or fallback to SOL
    const initialInputMint = activeTokenAddress && tokenStore.has(activeTokenAddress) 
        ? activeTokenAddress 
        : "3S8qX1MsMqRbiwKg2cQyx7nis1oHMgaCuc9c4VfvVdPN";

    // Initialize Jupiter Terminal
    window.Jupiter.init({
        displayMode: "integrated",
        integratedTargetId: "integrated-terminal",
        defaultExplorer: "Solscan",
        formProps: {
            initialInputMint: initialInputMint,
            fixedMint: "So11111111111111111111111111111111111111112",
        },
    });
}

/**
 * Initialize settings functionality
 */
function initSettings() {
    const settingsButton = document.getElementById('settings-button');
    const settingsModal = document.getElementById('settings-modal');
    const closeModal = document.getElementById('close-modal');
    const saveSettings = document.getElementById('save-settings');
    const themeSwitch = document.getElementById('theme-switch');
    const themeLabel = document.getElementById('theme-label');
    const apiKeyInput = document.getElementById('api-key');
    
    // Load saved settings
    loadSettings();

    // Apply current settings to form elements
    apiKeyInput.value = userSettings.apiKey;
    themeSwitch.checked = userSettings.theme === 'light';
    themeLabel.textContent = userSettings.theme === 'light' ? 'Light Mode' : 'Dark Mode';
    
    // Apply theme
    applyTheme(userSettings.theme);
    
    // Toggle settings modal
    settingsButton.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
        setTimeout(() => {
            settingsModal.classList.add('active');
        }, 10);
    });
    
    // Close modal
    closeModal.addEventListener('click', closeSettingsModal);
    
    // Close modal when clicking outside content
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeSettingsModal();
        }
    });
    
    // Theme toggle
    themeSwitch.addEventListener('change', () => {
        const newTheme = themeSwitch.checked ? 'light' : 'dark';
        themeLabel.textContent = newTheme === 'light' ? 'Light Mode' : 'Dark Mode';
        applyTheme(newTheme);
    });
    
    // Save settings
    saveSettings.addEventListener('click', () => {
        userSettings.apiKey = apiKeyInput.value.trim();
        userSettings.theme = themeSwitch.checked ? 'light' : 'dark';
        
        saveUserSettings();
        closeSettingsModal();
    });
}

/**
 * Closes the settings modal
 */
function closeSettingsModal() {
    const settingsModal = document.getElementById('settings-modal');
    settingsModal.classList.remove('active');
    setTimeout(() => {
        settingsModal.classList.add('hidden');
    }, 300);
}

/**
 * Applies the selected theme
 * @param {string} theme - Either 'light' or 'dark'
 */
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Loads user settings from localStorage
 */
function loadSettings() {
    try {
        const savedSettings = localStorage.getItem('userSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            userSettings.apiKey = settings.apiKey || '';
            userSettings.theme = settings.theme || 'dark';
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

/**
 * Saves user settings to localStorage
 */
function saveUserSettings() {
    try {
        localStorage.setItem('userSettings', JSON.stringify(userSettings));
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

/**
 * Loads saved tabs from localStorage
 */
async function loadSavedTabs() {
    try {
        // Get saved data
        const savedTabsData = localStorage.getItem('solanaTokenTabs');
        const savedActiveTab = localStorage.getItem('activeTokenTab');
        
        if (savedTabsData) {
            const savedTabs = JSON.parse(savedTabsData);
            
            // Load each saved tab
            const loadPromises = savedTabs.map(address => fetchTokenInfo(address, false));
            await Promise.all(loadPromises);
            
            // Set active tab if available
            if (savedActiveTab && tokenStore.has(savedActiveTab)) {
                setActiveToken(savedActiveTab);
            } else if (savedTabs.length > 0 && tokenStore.has(savedTabs[0])) {
                // Otherwise set the first tab as active
                setActiveToken(savedTabs[0]);
            }
        }
    } catch (error) {
        console.error('Error loading saved tabs:', error);
    }
}

/**
 * Saves the current tabs to localStorage
 */
function saveTabsState() {
    try {
        // Get all tab addresses
        const tabAddresses = Array.from(tokenStore.keys());
        
        // Save tabs and active tab
        localStorage.setItem('solanaTokenTabs', JSON.stringify(tabAddresses));
        if (activeTokenAddress) {
            localStorage.setItem('activeTokenTab', activeTokenAddress);
        }
    } catch (error) {
        console.error('Error saving tabs state:', error);
    }
}

/**
 * Prompts the user to enter a Solana token address
 * and fetches the token information
 */
function promptForTokenAddress() {
    const tokenAddress = prompt('Please enter a Solana token address:');
    
    if (tokenAddress) {
        // Check if we already have this token
        if (tokenStore.has(tokenAddress)) {
            setActiveToken(tokenAddress);
        } else {
            fetchTokenInfo(tokenAddress, true);
        }
    }
}

/**
 * Fetches token information from the JUP.ag API
 * @param {string} address - The Solana token address
 * @param {boolean} [setActive=true] - Whether to set this token as active after fetching
 * @returns {Promise<void>}
 */
async function fetchTokenInfo(address, setActive = true) {
    try {
        // Fetch basic token info
        const tokenInfoResponse = await (
            await fetch(`https://lite-api.jup.ag/tokens/v1/token/${address}`)
        ).json();
        
        // If we get a valid response with an address property
        if (tokenInfoResponse && tokenInfoResponse.address) {
            // Fetch price data with extra info
            try {
                const priceResponse = await fetch(
                    `https://lite-api.jup.ag/price/v2?ids=${address}&showExtraInfo=true`
                );
                const priceData = await priceResponse.json();
                
                // Combine token info with price data
                tokenInfoResponse.priceData = priceData.data && priceData.data[address] 
                    ? priceData.data[address] 
                    : null;
            } catch (priceError) {
                console.error('Error fetching price data:', priceError);
                // Continue without price data
                tokenInfoResponse.priceData = null;
            }
            
            // Store the token info
            tokenStore.set(address, tokenInfoResponse);
            
            // Create a tab for this token
            createTab(address, tokenInfoResponse);
            
            // Set as active token if requested
            if (setActive) {
                setActiveToken(address);
            }

            // Save tabs state
            saveTabsState();

            return tokenInfoResponse;
        } else {
            if (setActive) {
                alert('Invalid token or token not found.');
            }
            return null;
        }
    } catch (error) {
        console.error('Error fetching token info:', error);
        if (setActive) {
            alert('Failed to fetch token information. Please try again.');
        }
        return null;
    }
}

/**
 * Creates a new tab for a token
 * @param {string} address - The token address
 * @param {Object} tokenInfo - The token information
 */
function createTab(address, tokenInfo) {
    const tabsBar = document.getElementById('tabs-bar');
    const addTab = document.getElementById('add-tab');
    const tabCloseButton = document.getElementById('tab-close-button');
    
    // Create tab element
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.address = address;
    
    // Add icon and name to tab
    tab.innerHTML = `
        <img src="${tokenInfo.logoURI || 'https://via.placeholder.com/16'}" 
             alt="${tokenInfo.symbol}" 
             class="tab-icon">
        <span>${tokenInfo.symbol || 'Unknown'}</span>
    `;
    
    // Insert tab before the add tab
    tabsBar.insertBefore(tab, addTab);
    
    // Show close button
    tabCloseButton.classList.remove('hidden');
}

/**
 * Sets the active token and updates UI
 * @param {string} address - The token address to set as active
 */
function setActiveToken(address) {
    // Clear any existing price refresh interval
    clearPriceRefreshInterval();
    
    // Update active token
    activeTokenAddress = address;
    
    // Get token info
    const tokenInfo = tokenStore.get(address);
    
    // Update tabs
    updateTabsUI();
    
    // Display token info
    displayTokenInfo(tokenInfo);
    
    // Set Birdeye.so iframe source
    loadBirdeyeIframe(address);
    
    // Start price refresh interval
    startPriceRefreshInterval();

    // Save the active tab state
    saveTabsState();
    
    // Update Jupiter Terminal with new token
    updateJupiterTerminal(address);
}

/**
 * Updates Jupiter Terminal with a new input token
 * @param {string} tokenAddress - The token address to use as input
 */
function updateJupiterTerminal(tokenAddress) {
    // Reinitialize Jupiter terminal with the new token
    initJupiterTerminal();
}

/**
 * Loads the Birdeye.so iframe for the specified token address
 * @param {string} tokenAddress - The token address to use in the iframe URL
 */
function loadBirdeyeIframe(tokenAddress) {
    const iframeContainer = document.getElementById('birdeye-iframe-container');
    const iframe = document.getElementById('birdeye-embed');
    
    // Show the container
    iframeContainer.classList.remove('hidden');
    
    // Set the iframe source
    const iframeUrl = `https://birdeye.so/tv-widget/${tokenAddress}?chain=solana&viewMode=pair&chartInterval=15&chartType=Candle&chartTimezone=Europe%2FZagreb&chartLeftToolbar=show&theme=dark`;
    
    iframe.src = iframeUrl;
}

/**
 * Updates the tabs UI to reflect the active token
 */
function updateTabsUI() {
    const tabs = document.querySelectorAll('.tab:not(.add-tab)');
    
    // Remove active class from all tabs
    tabs.forEach(tab => {
        if (tab.dataset.address === activeTokenAddress) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

/**
 * Closes the currently active tab
 */
function closeCurrentTab() {
    if (!activeTokenAddress) return;
    
    // Clear price refresh interval
    clearPriceRefreshInterval();
    
    // Find the active tab
    const activeTab = document.querySelector(`.tab[data-address="${activeTokenAddress}"]`);
    
    if (activeTab) {
        // Remove from DOM
        activeTab.remove();
        
        // Remove from store
        tokenStore.delete(activeTokenAddress);
        
        // Check if we have any tabs left
        const remainingTabs = document.querySelectorAll('.tab:not(.add-tab)');
        
        if (remainingTabs.length > 0) {
            // Set the first remaining tab as active
            const nextTabAddress = remainingTabs[0].dataset.address;
            setActiveToken(nextTabAddress);
        } else {
            // No tabs left, hide the header
            document.getElementById('token-header').classList.add('hidden');
            document.getElementById('tab-close-button').classList.add('hidden');
            
            // Reset active token address
            activeTokenAddress = null;
            
            // Show default SOL chart
            loadBirdeyeIframe('So11111111111111111111111111111111111111112');
        }

        // Save the updated tabs state
        saveTabsState();
    }
}

/**
 * Displays the token information in the header
 * @param {Object} tokenInfo - The token information object
 * @param {string} tokenInfo.address - Token address
 * @param {string} tokenInfo.name - Token name
 * @param {string} tokenInfo.symbol - Token symbol
 * @param {number} tokenInfo.decimals - Token decimals
 * @param {string} tokenInfo.logoURI - URL to the token logo
 * @param {string[]} tokenInfo.tags - Array of tags
 * @param {number} tokenInfo.daily_volume - Daily trading volume
 * @param {Object} [tokenInfo.priceData] - Price data from Jupiter API
 */
function displayTokenInfo(tokenInfo) {
    const tokenHeader = document.getElementById('token-header');
    
    // Create basic token info HTML
    let html = `
        <img src="${tokenInfo.logoURI || 'https://via.placeholder.com/36'}" alt="${tokenInfo.symbol}" class="token-logo">
        
        <div class="info-item token-name-symbol">
            <span class="info-label">Token</span>
            <span class="info-value">${tokenInfo.name || 'Unknown'} <span style="opacity: 0.7">${tokenInfo.symbol || 'N/A'}</span></span>
        </div>
        
        <div class="token-info">
            <div class="info-item">
                <span class="info-label">Address</span>
                <span class="info-value address-value" data-address="${tokenInfo.address}" title="Click to copy">${formatAddress(tokenInfo.address)}</span>
            </div>
            
            <div class="info-item">
                <span class="info-label">Decimals</span>
                <span class="info-value numeric-value">${tokenInfo.decimals !== undefined ? tokenInfo.decimals : 'N/A'}</span>
            </div>`;
    
    // Add price data if available
    if (tokenInfo.priceData) {
        const priceData = tokenInfo.priceData;
        const price = parseFloat(priceData.price);
        const extraInfo = priceData.extraInfo || {};
        
        html += `
            <div class="info-item price-item">
                <span class="info-label">Price</span>
                <span class="info-value">$${formatCurrency(price, 6)}</span>
            </div>`;
            
        // Add confidence level if available
        if (extraInfo.confidenceLevel) {
            html += `
            <div class="info-item">
                <span class="info-label">Confidence</span>
                <span class="info-value confidence-${extraInfo.confidenceLevel}">${extraInfo.confidenceLevel.toUpperCase()}</span>
            </div>`;
        }
        
        // Add last swap prices if available
        if (extraInfo.lastSwappedPrice) {
            const lastSwap = extraInfo.lastSwappedPrice;
            if (lastSwap.lastJupiterBuyPrice && lastSwap.lastJupiterSellPrice) {
                const buyPrice = parseFloat(lastSwap.lastJupiterBuyPrice);
                const sellPrice = parseFloat(lastSwap.lastJupiterSellPrice);
                
                // Calculate the spread
                const spread = ((sellPrice - buyPrice) / buyPrice) * 100;
                
                html += `
                <div class="info-item">
                    <span class="info-label">Last Swap</span>
                    <span class="info-value numeric-value">$${formatCurrency(buyPrice, 6)} / $${formatCurrency(sellPrice, 6)}</span>
                    <span class="info-subvalue">Spread: ${formatPercentage(spread, 3)}</span>
                </div>`;
            }
        }
        
        // Add quoted prices if available
        if (extraInfo.quotedPrice) {
            const quoted = extraInfo.quotedPrice;
            if (quoted.buyPrice && quoted.sellPrice) {
                const buyPrice = parseFloat(quoted.buyPrice);
                const sellPrice = parseFloat(quoted.sellPrice);
                
                // Calculate the spread
                const spread = ((sellPrice - buyPrice) / buyPrice) * 100;
                
                // Calculate the time ago for quotes
                const buyTimeAgo = quoted.buyAt ? formatTimeAgo(quoted.buyAt) : 'N/A';
                
                html += `
                <div class="info-item quote-item">
                    <span class="info-label">Quote (Buy/Sell)</span>
                    <span class="info-value numeric-value">$${formatCurrency(buyPrice, 6)} / $${formatCurrency(sellPrice, 6)}</span>
                    <span class="info-subvalue">Spread: ${formatPercentage(spread, 3)} · ${buyTimeAgo}</span>
                </div>`;
            }
        }
        
        // Add depth information if available
        if (extraInfo.depth && extraInfo.depth.buyPriceImpactRatio && extraInfo.depth.sellPriceImpactRatio) {
            const buyDepth = extraInfo.depth.buyPriceImpactRatio.depth;
            const sellDepth = extraInfo.depth.sellPriceImpactRatio.depth;
            
            if (buyDepth && sellDepth) {
                html += `
                <div class="info-item depth-item">
                    <span class="info-label">Market Impact (10 SOL)</span>
                    <span class="info-value numeric-value">${formatPercentage(buyDepth['10'], 4)} buy / ${formatPercentage(sellDepth['10'], 4)} sell</span>
                </div>`;
                
                if (buyDepth['100'] && sellDepth['100']) {
                    html += `
                    <div class="info-item depth-item">
                        <span class="info-label">Market Impact (100 SOL)</span>
                        <span class="info-value numeric-value">${formatPercentage(buyDepth['100'], 4)} buy / ${formatPercentage(sellDepth['100'], 4)} sell</span>
                    </div>`;
                }
            }
        }
    }
    
    // Add trading volume
    if (tokenInfo.daily_volume) {
        html += `
        <div class="info-item">
            <span class="info-label">Daily Volume</span>
            <span class="info-value numeric-value">$${formatCurrency(tokenInfo.daily_volume, 2)}</span>
        </div>`;
    }
    
    // Add minted date if available
    if (tokenInfo.minted_at) {
        html += `
        <div class="info-item">
            <span class="info-label">Minted</span>
            <span class="info-value">${formatDate(tokenInfo.minted_at)}</span>
        </div>`;
    }
    
    html += `</div>`;
    
    // Update the token header and show it
    tokenHeader.innerHTML = html;
    tokenHeader.classList.remove('hidden');
}

/**
 * Formats a Unix timestamp to a human-readable time ago string
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Time ago string (e.g. "2m ago")
 */
function formatTimeAgo(timestamp) {
    const now = Math.floor(Date.now() / 1000);
    const seconds = now - timestamp;
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Formats a decimal as a percentage with specified precision
 * @param {number} value - The decimal value to format as percentage
 * @param {number} [precision=2] - Number of decimal places to show
 * @returns {string} Formatted percentage
 */
function formatPercentage(value, precision = 2) {
    return `${(value * 100).toFixed(precision)}%`;
}

/**
 * Formats a Solana address to be shorter and more readable
 * @param {string} address - The full Solana address
 * @returns {string} The formatted address
 */
function formatAddress(address) {
    if (!address) return 'N/A';
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
}

/**
 * Formats a currency value with thousands separators and specified decimal places
 * @param {number} value - The number to format
 * @param {number} [precision=2] - Number of decimal places to show
 * @returns {string} The formatted currency value
 */
function formatCurrency(value, precision = 2) {
    if (value === undefined || value === null) return 'N/A';
    
    // Determine if we need to show more decimal places
    let dynamicPrecision = precision;
    if (value < 0.01 && precision < 6) {
        // For very small values, show more decimal places
        dynamicPrecision = 6;
    } else if (value < 1 && precision < 4) {
        // For small values, show more decimal places
        dynamicPrecision = 4;
    }
    
    return new Intl.NumberFormat('en-US', { 
        minimumFractionDigits: 2,
        maximumFractionDigits: dynamicPrecision
    }).format(value);
}

/**
 * Formats a number with commas and limits decimal places
 * @param {number} num - The number to format
 * @param {number} [precision=2] - Number of decimal places to show
 * @returns {string} The formatted number
 */
function formatNumber(num, precision = 2) {
    if (num === undefined || num === null) return 'N/A';
    return new Intl.NumberFormat('en-US', { 
        maximumFractionDigits: precision
    }).format(num);
}

/**
 * Formats a date string to be more readable
 * @param {string} dateString - The ISO date string
 * @returns {string} The formatted date
 */
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    return date.toLocaleDateString('en-US', options);
}

/**
 * Starts the price refresh interval for the active token
 */
function startPriceRefreshInterval() {
    // Set up interval to refresh price data every 5 seconds
    priceRefreshInterval = setInterval(async () => {
        if (activeTokenAddress) {
            await refreshTokenPrice(activeTokenAddress);
        }
    }, 5000); // 5 seconds
}

/**
 * Clears the price refresh interval
 */
function clearPriceRefreshInterval() {
    if (priceRefreshInterval) {
        clearInterval(priceRefreshInterval);
        priceRefreshInterval = null;
    }
}

/**
 * Refreshes the price data for a token
 * @param {string} tokenAddress - The token address to refresh price data for
 */
async function refreshTokenPrice(tokenAddress) {
    try {
        const tokenInfo = tokenStore.get(tokenAddress);
        
        if (!tokenInfo) return;
        
        // Fetch updated price data
        const priceResponse = await fetch(
            `https://lite-api.jup.ag/price/v2?ids=${tokenAddress}&showExtraInfo=true`
        );
        const priceData = await priceResponse.json();
        
        // Update the token info with new price data
        if (priceData.data && priceData.data[tokenAddress]) {
            tokenInfo.priceData = priceData.data[tokenAddress];
            tokenStore.set(tokenAddress, tokenInfo);
            
            // Update the UI if this is the active token
            if (tokenAddress === activeTokenAddress) {
                displayTokenInfo(tokenInfo);
            }
        }
    } catch (error) {
        console.error('Error refreshing price data:', error);
    }
} 