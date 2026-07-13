(function () {
    "use strict";

    var STORAGE_KEY = "scvf_donations_ledger";
    var SPENT_KEY = "scvf_donations_spent";
    var DEFAULT_SPENT = 2450000; // NGN demo baseline for amount spent so far

    var causeLabels = {
        "legal-aid": "Legal Aid Fund",
        "rescue": "Rescue Missions",
        "victim-support": "Victim Support / Emergency Response",
        "safe-city": "Safe City Community Programs",
        "general": "General Donation"
    };

    // Approximate conversion to NGN for unified bank totals (demo rates)
    var toNgn = {
        NGN: 1,
        USD: 1600,
        GBP: 2050,
        EUR: 1750
    };

    var seedDonations = [
        {
            id: "seed-1",
            name: "Adaora Okeke",
            phone: "+2348034567890",
            description: "Support for legal aid and wrongful detention advocacy in Delta State.",
            amount: 50000,
            currency: "NGN",
            cause: "legal-aid",
            anonymous: false,
            createdAt: "2026-07-10T09:15:00.000Z"
        },
        {
            id: "seed-2",
            name: "Chinedu Bassey",
            phone: "08091234567",
            description: "Monthly gift toward rescue missions and family reunification.",
            amount: 25000,
            currency: "NGN",
            cause: "rescue",
            anonymous: false,
            createdAt: "2026-07-11T14:42:00.000Z"
        },
        {
            id: "seed-3",
            name: "Anonymous Donor",
            phone: "+2347011122233",
            description: "Emergency response support for victims and missing persons cases.",
            amount: 100,
            currency: "USD",
            cause: "victim-support",
            anonymous: true,
            createdAt: "2026-07-12T08:05:00.000Z"
        },
        {
            id: "seed-4",
            name: "Ifeanyi Nwosu",
            phone: "08145556677",
            description: "Safe City volunteer logistics and community safety outreach.",
            amount: 75000,
            currency: "NGN",
            cause: "safe-city",
            anonymous: false,
            createdAt: "2026-07-12T18:30:00.000Z"
        },
        {
            id: "seed-5",
            name: "Blessing Eze",
            phone: "+2349098765432",
            description: "General donation to defend rights and keep communities safer.",
            amount: 15000,
            currency: "NGN",
            cause: "general",
            anonymous: false,
            createdAt: "2026-07-13T11:20:00.000Z"
        }
    ];

    function loadDonations() {
        try {
            var stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            if (!Array.isArray(stored) || stored.length === 0) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(seedDonations));
                return seedDonations.slice();
            }
            return stored;
        } catch (e) {
            return seedDonations.slice();
        }
    }

    function getSpent() {
        var spent = Number(localStorage.getItem(SPENT_KEY));
        if (!spent || isNaN(spent)) {
            localStorage.setItem(SPENT_KEY, String(DEFAULT_SPENT));
            return DEFAULT_SPENT;
        }
        return spent;
    }

    function maskPhone(phone) {
        var digits = String(phone || "").replace(/\D/g, "");
        if (!digits) return "••••••••";
        if (digits.length <= 4) return "****" + digits;
        var start = digits.slice(0, 3);
        var end = digits.slice(-2);
        return start + "****" + end;
    }

    function truncateText(text, max) {
        var t = String(text || "").trim();
        if (!t) return "—";
        if (t.length <= max) return t;
        return t.slice(0, max).trim() + "…";
    }

    function formatMoney(amount, currency) {
        var cur = currency || "NGN";
        try {
            return new Intl.NumberFormat("en-NG", {
                style: "currency",
                currency: cur,
                maximumFractionDigits: 0
            }).format(amount);
        } catch (e) {
            return cur + " " + Number(amount).toLocaleString();
        }
    }

    function formatNgn(amount) {
        return formatMoney(amount, "NGN");
    }

    function toBankNgn(entry) {
        var rate = toNgn[entry.currency] || 1;
        return Number(entry.amount || 0) * rate;
    }

    function formatDateTime(iso) {
        var d = new Date(iso);
        if (isNaN(d.getTime())) return "—";
        return d.toLocaleString("en-GB", {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
    }

    function displayName(entry) {
        if (entry.anonymous) return "Anonymous Donor";
        return entry.name || "Supporter";
    }

    function descriptionOf(entry) {
        if (entry.description) return entry.description;
        var cause = causeLabels[entry.cause] || entry.cause || "Donation";
        return "Donation toward " + cause;
    }

    function render() {
        var donations = loadDonations().slice().sort(function (a, b) {
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        var tbody = document.getElementById("donationsTableBody");
        var emptyState = document.getElementById("donationsEmpty");
        if (!tbody) return;

        tbody.innerHTML = "";

        if (!donations.length) {
            if (emptyState) emptyState.classList.remove("d-none");
            updateTotals([], getSpent());
            return;
        }
        if (emptyState) emptyState.classList.add("d-none");

        donations.forEach(function (entry, index) {
            var sn = donations.length - index;
            var tr = document.createElement("tr");
            tr.innerHTML =
                "<td>" + sn + "</td>" +
                "<td>" + formatDateTime(entry.createdAt) + "</td>" +
                "<td>" + escapeHtml(displayName(entry)) + "</td>" +
                "<td>" + escapeHtml(maskPhone(entry.phone)) + "</td>" +
                "<td>" + escapeHtml(truncateText(descriptionOf(entry), 48)) + "</td>" +
                "<td class=\"fw-semi-bold\">" + escapeHtml(formatMoney(entry.amount, entry.currency)) + "</td>";
            tbody.appendChild(tr);
        });

        updateTotals(donations, getSpent());

        var countEl = document.getElementById("donorCount");
        if (countEl) countEl.textContent = String(donations.length);
    }

    function updateTotals(donations, spent) {
        var totalReceived = donations.reduce(function (sum, d) {
            return sum + toBankNgn(d);
        }, 0);
        var bankBalance = Math.max(0, totalReceived - spent);

        setText("totalInBank", formatNgn(bankBalance));
        setText("amountSpent", formatNgn(spent));
        setText("totalReceived", formatNgn(totalReceived));
    }

    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function tickClock() {
        var nowEl = document.getElementById("liveClock");
        var updatedEl = document.getElementById("lastUpdated");
        var now = new Date();
        if (nowEl) {
            nowEl.textContent = now.toLocaleString("en-GB", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            });
        }
        if (updatedEl) {
            updatedEl.textContent = "Updated " + now.toLocaleTimeString("en-GB");
        }
    }

    // Initial seed if needed + first paint
    loadDonations();
    render();
    tickClock();

    // Real-time refresh: clock every second, ledger every 3 seconds
    window.setInterval(tickClock, 1000);
    window.setInterval(render, 3000);

    // Instant refresh when another tab/page saves a donation
    window.addEventListener("storage", function (e) {
        if (e.key === STORAGE_KEY || e.key === SPENT_KEY) render();
    });
})();
