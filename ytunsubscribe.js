// ==UserScript==
// @name         YouTube Unsubscribe Manager CSP Safe Final
// @namespace    https://www.nullpk.com
// @version      4.3
// @description  CSP-safe YouTube unsubscribe manager with dry-run, test scan, pause, stop, skip words, safer real mode, and footer credit.
// @author       Naqash Afzal
// @homepage     https://www.nullpk.com
// @supportURL   https://www.nullpk.com
// @match        https://www.youtube.com/feed/channels*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";

    /*
        YouTube Unsubscribe Manager
        Created by: Naqash Afzal
        Website: https://www.nullpk.com

        Features:
        - Only visible on https://www.youtube.com/feed/channels
        - CSP-safe UI, no innerHTML
        - Dry-run mode
        - Test Scan
        - Pause / Stop
        - Skip channels by keyword
        - Safer confirmation for real unsubscribe mode
        - Footer credit
    */

    let running = false;
    let paused = false;
    let stopped = false;

    let unsubscribedCount = 0;
    let skippedCount = 0;
    let scannedCount = 0;

    const state = {
        minDelay: 1500,
        maxDelay: 3000,
        dryRun: true,
        skipKeywords: []
    };

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    function setStyles(el, styles) {
        Object.assign(el.style, styles);
    }

    function make(tag, text, styles = {}) {
        const el = document.createElement(tag);

        if (text !== undefined && text !== null) {
            el.textContent = text;
        }

        setStyles(el, styles);
        return el;
    }

    function buttonStyle(bg) {
        return {
            padding: "10px",
            background: bg,
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold"
        };
    }

    function log(message, type = "info") {
        console.log("[YT Unsub]", message);

        const status = document.getElementById("yt-unsub-status");
        if (status) status.textContent = message;

        const logBox = document.getElementById("yt-unsub-log");
        if (!logBox) return;

        const line = make("div", `[${new Date().toLocaleTimeString()}] ${message}`);

        if (type === "error") line.style.color = "#ff6b6b";
        if (type === "success") line.style.color = "#7CFC00";
        if (type === "warning") line.style.color = "#ffd166";

        logBox.prepend(line);
    }

    function updateStats() {
        const stats = document.getElementById("yt-unsub-stats");
        if (!stats) return;

        stats.textContent =
            `Scanned: ${scannedCount} | Unsubscribed: ${unsubscribedCount} | Skipped: ${skippedCount}`;
    }

    function randomDelay() {
        return Math.floor(
            state.minDelay + Math.random() * (state.maxDelay - state.minDelay)
        );
    }

    function getVisibleElements(selector) {
        return [...document.querySelectorAll(selector)].filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
    }

    function getChannelCards() {
        const cards = getVisibleElements(
            "ytd-channel-renderer, ytd-grid-channel-renderer"
        );

        return [...new Set(cards)];
    }

    function getChannelName(card) {
        const selectors = [
            "#channel-title",
            "#text",
            "a#main-link",
            "yt-formatted-string#text",
            "yt-formatted-string",
            "a[href*='/@']",
            "a[href*='/channel/']",
            "a[href*='/c/']"
        ];

        for (const selector of selectors) {
            const el = card.querySelector(selector);
            const text = el && el.textContent ? el.textContent.trim() : "";

            if (text && text.length < 120) {
                return text;
            }
        }

        return "Unknown Channel";
    }

    function getSubscribedButton(card) {
        const buttons = [
            ...card.querySelectorAll("button"),
            ...card.querySelectorAll("tp-yt-paper-button"),
            ...card.querySelectorAll("yt-button-shape button"),
            ...card.querySelectorAll("div[role='button']")
        ];

        return buttons.find(btn => {
            const text = (btn.textContent || "").trim().toLowerCase();
            const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
            const title = (btn.getAttribute("title") || "").toLowerCase();

            return (
                text === "subscribed" ||
                text.includes("subscribed") ||
                aria.includes("unsubscribe") ||
                aria.includes("subscribed") ||
                title.includes("subscribed")
            );
        });
    }

    function getConfirmUnsubscribeButton() {
        const buttons = [
            ...document.querySelectorAll("button"),
            ...document.querySelectorAll("tp-yt-paper-button"),
            ...document.querySelectorAll("yt-button-shape button"),
            ...document.querySelectorAll("div[role='button']")
        ];

        return buttons.find(btn => {
            const text = (btn.textContent || "").trim().toLowerCase();
            const aria = (btn.getAttribute("aria-label") || "").toLowerCase();

            return (
                text === "unsubscribe" ||
                text.includes("unsubscribe") ||
                aria === "unsubscribe" ||
                aria.includes("unsubscribe")
            );
        });
    }

    function readSettings() {
        const minEl = document.getElementById("yt-min-delay");
        const maxEl = document.getElementById("yt-max-delay");
        const dryEl = document.getElementById("yt-dry-run");
        const skipEl = document.getElementById("yt-skip-keywords");

        state.minDelay = Number(minEl && minEl.value) || 1500;
        state.maxDelay = Number(maxEl && maxEl.value) || 3000;
        state.dryRun = dryEl ? dryEl.checked : true;

        state.skipKeywords = skipEl
            ? skipEl.value.split(",").map(x => x.trim()).filter(Boolean)
            : [];

        if (state.maxDelay < state.minDelay) {
            alert("Max delay must be greater than min delay.");
            return false;
        }

        return true;
    }

    function shouldSkipChannel(channelName) {
        const lowerName = channelName.toLowerCase();

        return state.skipKeywords.some(keyword =>
            keyword && lowerName.includes(keyword.toLowerCase())
        );
    }

    async function testScan() {
        log("Testing page scan...", "warning");

        const cards = getChannelCards();
        scannedCount = cards.length;
        updateStats();

        log(`Found ${cards.length} channel card(s).`, cards.length ? "success" : "error");

        let foundButtons = 0;

        for (const card of cards.slice(0, 10)) {
            const name = getChannelName(card);
            const btn = getSubscribedButton(card);

            if (btn) foundButtons++;

            log(`${btn ? "✅" : "❌"} ${name}`, btn ? "success" : "warning");
        }

        log(
            `Found ${foundButtons} subscribed button(s) in first 10 cards.`,
            foundButtons ? "success" : "error"
        );

        if (!cards.length) {
            log("Scroll down a little and click Test Scan again.", "warning");
        }
    }

    async function waitWhilePaused() {
        while (paused && !stopped) {
            await sleep(500);
        }
    }

    async function scrollAndLoadMore() {
        window.scrollBy(0, window.innerHeight * 1.5);
        await sleep(1800);
    }

    async function unsubscribeChannel(card) {
        const channelName = getChannelName(card);

        scannedCount++;
        updateStats();

        if (shouldSkipChannel(channelName)) {
            skippedCount++;
            updateStats();
            log(`Skipped: ${channelName}`, "warning");
            return true;
        }

        const button = getSubscribedButton(card);

        if (!button) {
            log(`No subscribed button found for: ${channelName}`, "warning");
            return false;
        }

        if (state.dryRun) {
            unsubscribedCount++;
            updateStats();
            log(`[Dry Run] Would unsubscribe: ${channelName}`, "success");
            return true;
        }

        button.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        await sleep(900);

        button.click();
        log(`Clicked subscribed button: ${channelName}`);

        await sleep(1500);

        const confirmButton = getConfirmUnsubscribeButton();

        if (!confirmButton) {
            log(`Confirmation button not found for: ${channelName}`, "error");
            return false;
        }

        confirmButton.click();

        unsubscribedCount++;
        updateStats();

        log(`Unsubscribed: ${channelName}`, "success");

        await sleep(randomDelay());

        return true;
    }

    async function startUnsubscribeProcess() {
        log("Start button clicked.", "success");

        if (!readSettings()) return;

        if (running) {
            log("Already running.", "warning");
            return;
        }

        if (!location.href.includes("/feed/channels")) {
            alert("Open https://www.youtube.com/feed/channels first.");
            log("Wrong page. Open youtube.com/feed/channels", "error");
            return;
        }

        if (!state.dryRun) {
            const confirmStart = confirm(
                "REAL MODE: This will unsubscribe from channels one by one. Are you sure?"
            );

            if (!confirmStart) {
                log("Start cancelled.", "warning");
                return;
            }
        }

        running = true;
        paused = false;
        stopped = false;

        log(
            state.dryRun
                ? "Started in dry-run mode. No real unsubscribe will happen."
                : "Started in real unsubscribe mode.",
            "success"
        );

        let emptyRounds = 0;

        while (!stopped) {
            await waitWhilePaused();

            const cards = getChannelCards();

            log(`Scanning ${cards.length} visible channel card(s)...`);

            let actionTaken = false;

            for (const card of cards) {
                if (stopped) break;

                await waitWhilePaused();

                const success = await unsubscribeChannel(card);

                if (success) {
                    actionTaken = true;
                }

                await sleep(randomDelay());
            }

            if (!actionTaken) {
                emptyRounds++;
                log(`No action found. Loading more... ${emptyRounds}/5`, "warning");
                await scrollAndLoadMore();
            } else {
                emptyRounds = 0;
                await scrollAndLoadMore();
            }

            if (emptyRounds >= 5) {
                log("No more channels found. Finished.", "success");
                break;
            }
        }

        running = false;
        paused = false;

        log(
            stopped ? "Stopped by user." : "Process completed.",
            stopped ? "warning" : "success"
        );
    }

    function createInput(labelText, id, value, type = "text", placeholder = "") {
        const wrapper = make("div");

        const label = make("label", labelText, {
            display: "block",
            fontSize: "12px",
            marginBottom: "4px"
        });

        const input = make("input");
        input.id = id;
        input.type = type;
        input.value = value;
        input.placeholder = placeholder;

        setStyles(input, {
            width: "100%",
            marginBottom: "8px",
            padding: "7px",
            color: "#000",
            boxSizing: "border-box"
        });

        wrapper.appendChild(label);
        wrapper.appendChild(input);

        return wrapper;
    }

    function createCreditFooter() {
        const footer = make("div", null, {
            marginTop: "10px",
            padding: "10px",
            background: "#0b0b0b",
            borderTop: "1px solid #333",
            borderRadius: "0 0 8px 8px",
            fontSize: "11px",
            color: "#aaa",
            textAlign: "center",
            lineHeight: "1.5"
        });

        const credit = make("div", "Created by Naqash Afzal", {
            fontWeight: "bold",
            color: "#ffffff"
        });

        const website = make("div", "www.nullpk.com", {
            color: "#ff4d4d"
        });

        footer.appendChild(credit);
        footer.appendChild(website);

        return footer;
    }

    function createPanel() {
        if (document.getElementById("yt-unsub-panel")) return;
        if (!document.body) return;

        const panel = make("div");
        panel.id = "yt-unsub-panel";

        setStyles(panel, {
            position: "fixed",
            top: "90px",
            right: "20px",
            width: "370px",
            maxHeight: "85vh",
            background: "#111",
            color: "#fff",
            zIndex: "2147483647",
            borderRadius: "12px",
            boxShadow: "0 8px 30px rgba(0,0,0,0.65)",
            fontFamily: "Arial, sans-serif",
            overflow: "hidden",
            border: "2px solid #ff0000"
        });

        const header = make("div", "YouTube Unsubscribe Manager", {
            padding: "14px",
            background: "#ff0000",
            color: "#fff",
            fontSize: "16px",
            fontWeight: "bold"
        });

        const body = make("div", null, {
            padding: "14px",
            paddingBottom: "0"
        });

        const note = make("div", "Page required: youtube.com/feed/channels", {
            fontSize: "12px",
            color: "#aaa",
            marginBottom: "8px"
        });

        const status = make("div", "Ready. Click Test Scan first.", {
            fontSize: "12px",
            color: "#7CFC00",
            marginBottom: "8px"
        });
        status.id = "yt-unsub-status";

        const stats = make("div", "Scanned: 0 | Unsubscribed: 0 | Skipped: 0", {
            marginBottom: "10px",
            fontSize: "13px"
        });
        stats.id = "yt-unsub-stats";

        const minInput = createInput("Min Delay ms", "yt-min-delay", "1500", "number");
        const maxInput = createInput("Max Delay ms", "yt-max-delay", "3000", "number");

        const skipInput = createInput(
            "Skip channel names containing these words",
            "yt-skip-keywords",
            "",
            "text",
            "music, news, official"
        );

        const dryLabel = make("label", null, {
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            marginBottom: "12px"
        });

        const dryCheck = make("input");
        dryCheck.id = "yt-dry-run";
        dryCheck.type = "checkbox";
        dryCheck.checked = true;

        dryLabel.appendChild(dryCheck);
        dryLabel.appendChild(document.createTextNode("Dry run only"));

        const grid1 = make("div", null, {
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            marginBottom: "8px"
        });

        const startBtn = make("button", "Start", buttonStyle("#ff0000"));
        const testBtn = make("button", "Test Scan", buttonStyle("#0077ff"));

        startBtn.id = "yt-start-btn";
        testBtn.id = "yt-test-btn";

        grid1.appendChild(startBtn);
        grid1.appendChild(testBtn);

        const grid2 = make("div", null, {
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            marginBottom: "10px"
        });

        const pauseBtn = make("button", "Pause", buttonStyle("#555"));
        const stopBtn = make("button", "Stop", buttonStyle("#333"));

        pauseBtn.id = "yt-pause-btn";
        stopBtn.id = "yt-stop-btn";

        grid2.appendChild(pauseBtn);
        grid2.appendChild(stopBtn);

        const logTitle = make("div", "Logs", {
            fontSize: "12px",
            marginBottom: "6px",
            color: "#bbb"
        });

        const logBox = make("div");
        logBox.id = "yt-unsub-log";

        setStyles(logBox, {
            height: "160px",
            overflow: "auto",
            background: "#000",
            padding: "8px",
            borderRadius: "6px",
            fontSize: "12px",
            lineHeight: "1.4",
            marginBottom: "0"
        });

        body.appendChild(note);
        body.appendChild(status);
        body.appendChild(stats);
        body.appendChild(minInput);
        body.appendChild(maxInput);
        body.appendChild(skipInput);
        body.appendChild(dryLabel);
        body.appendChild(grid1);
        body.appendChild(grid2);
        body.appendChild(logTitle);
        body.appendChild(logBox);

        const footer = createCreditFooter();

        panel.appendChild(header);
        panel.appendChild(body);
        panel.appendChild(footer);

        document.body.appendChild(panel);

        startBtn.onclick = startUnsubscribeProcess;
        testBtn.onclick = testScan;

        pauseBtn.onclick = function () {
            if (!running) {
                log("Nothing is running.", "warning");
                return;
            }

            paused = !paused;
            pauseBtn.textContent = paused ? "Resume" : "Pause";

            log(paused ? "Paused." : "Resumed.", "warning");
        };

        stopBtn.onclick = function () {
            stopped = true;
            paused = false;
            running = false;

            log("Stop requested.", "warning");
        };

        log("Panel loaded. Click Test Scan first.", "success");
    }

    function boot() {
        const timer = setInterval(() => {
            if (document.body) {
                createPanel();
                clearInterval(timer);
            }
        }, 500);

        setTimeout(() => clearInterval(timer), 30000);
    }

    boot();
})();
