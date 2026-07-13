/**
 * Premium Cookie Consent Banner
 * Safe City / Behind Bars website — integrates with existing template.
 */
(function (global) {
    "use strict";

    var STORAGE_KEY = "scvf_cookie_consent_v1";
    var CONSENT_VERSION = 1;

    var CATEGORIES = [
        {
            id: "essential",
            name: "Essential Cookies",
            description: "Required for core website functionality, security, consent storage, and basic navigation. These cannot be disabled.",
            required: true
        },
        {
            id: "analytics",
            name: "Analytics Cookies",
            description: "Help us understand how visitors use the site so we can improve content, navigation, and outreach effectiveness.",
            required: false
        },
        {
            id: "performance",
            name: "Performance Cookies",
            description: "Monitor site speed, reliability, and technical performance to deliver a smoother browsing experience.",
            required: false
        },
        {
            id: "functional",
            name: "Functional Cookies",
            description: "Remember your preferences such as language, region, and interface choices for a more personalized visit.",
            required: false
        },
        {
            id: "marketing",
            name: "Marketing Cookies",
            description: "Support relevant campaign messaging and measure engagement with our humanitarian and community programs.",
            required: false
        },
        {
            id: "thirdParty",
            name: "Third-Party Services",
            description: "Enable embedded tools and external services such as maps, media players, and partner integrations.",
            required: false
        }
    ];

    var state = {
        banner: null,
        modal: null,
        overlay: null,
        focusTrapHandler: null,
        lastFocused: null,
        learnMoreUrl: "about.html"
    };

    function getAssetBase() {
        var scripts = document.getElementsByTagName("script");
        for (var i = scripts.length - 1; i >= 0; i--) {
            var src = scripts[i].getAttribute("src") || "";
            if (src.indexOf("cookie-banner.js") !== -1) {
                return src.replace(/js\/cookie-banner\.js.*$/, "");
            }
        }
        return "Charitize/";
    }

    function defaultPreferences() {
        return {
            essential: true,
            analytics: false,
            performance: false,
            functional: false,
            marketing: false,
            thirdParty: false
        };
    }

    function allAcceptedPreferences() {
        return {
            essential: true,
            analytics: true,
            performance: true,
            functional: true,
            marketing: true,
            thirdParty: true
        };
    }

    function rejectNonEssentialPreferences() {
        return defaultPreferences();
    }

    function readConsent() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (!data || data.version !== CONSENT_VERSION) return null;
            return data;
        } catch (e) {
            return null;
        }
    }

    function writeConsent(choice, preferences) {
        var payload = {
            version: CONSENT_VERSION,
            choice: choice,
            preferences: preferences,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        dispatchConsentEvent(payload);
        return payload;
    }

    function dispatchConsentEvent(data) {
        try {
            global.dispatchEvent(new CustomEvent("cookieConsentUpdated", { detail: data }));
        } catch (e) {
            /* noop */
        }
    }

    /** Public API */
    function getConsent() {
        return readConsent();
    }

    function hasConsent() {
        return !!readConsent();
    }

    function updateConsent(choice, preferences) {
        var prefs = preferences || defaultPreferences();
        prefs.essential = true;
        return writeConsent(choice, prefs);
    }

    function resetConsent() {
        localStorage.removeItem(STORAGE_KEY);
        showBanner();
    }

    function acceptAll() {
        writeConsent("all", allAcceptedPreferences());
        hideBanner();
    }

    function rejectNonEssential() {
        writeConsent("reject", rejectNonEssentialPreferences());
        hideBanner();
    }

    function saveCustomPreferences(formPrefs) {
        var prefs = defaultPreferences();
        CATEGORIES.forEach(function (cat) {
            if (cat.required) {
                prefs[cat.id] = true;
            } else if (formPrefs && typeof formPrefs[cat.id] === "boolean") {
                prefs[cat.id] = formPrefs[cat.id];
            }
        });
        writeConsent("custom", prefs);
        closeModal();
        hideBanner();
    }

    function hideBanner() {
        if (!state.banner) return;
        state.banner.classList.add("is-hiding");
        state.banner.classList.remove("is-visible");
        window.setTimeout(function () {
            if (state.banner) {
                state.banner.setAttribute("hidden", "");
                state.banner.classList.remove("is-hiding");
            }
        }, 480);
    }

    function showBanner() {
        if (!state.banner) return;
        state.banner.removeAttribute("hidden");
        window.requestAnimationFrame(function () {
            state.banner.classList.add("is-visible");
        });
    }

    function trapFocus(container) {
        var focusable = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        var nodes = Array.prototype.filter.call(focusable, function (el) {
            return !el.disabled && el.offsetParent !== null;
        });
        if (!nodes.length) return;

        state.focusTrapHandler = function (e) {
            if (e.key !== "Tab") return;
            var first = nodes[0];
            var last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        container.addEventListener("keydown", state.focusTrapHandler);
        nodes[0].focus();
    }

    function releaseFocusTrap() {
        if (state.modal && state.focusTrapHandler) {
            state.modal.removeEventListener("keydown", state.focusTrapHandler);
            state.focusTrapHandler = null;
        }
        if (state.lastFocused && state.lastFocused.focus) {
            state.lastFocused.focus();
        }
    }

    function openModal() {
        if (!state.overlay) return;
        state.lastFocused = document.activeElement;
        state.overlay.classList.add("is-open");
        state.overlay.removeAttribute("hidden");
        state.overlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        trapFocus(state.modal);

        var existing = getConsent();
        if (existing && existing.preferences) {
            CATEGORIES.forEach(function (cat) {
                if (cat.required) return;
                var input = document.getElementById("cookie-toggle-" + cat.id);
                if (input) input.checked = !!existing.preferences[cat.id];
            });
        }
    }

    function closeModal() {
        if (!state.overlay) return;
        state.overlay.classList.remove("is-open");
        state.overlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        releaseFocusTrap();
        window.setTimeout(function () {
            if (state.overlay) state.overlay.setAttribute("hidden", "");
        }, 420);
    }

    function buildCategoryMarkup(cat) {
        if (cat.required) {
            return (
                '<div class="cookie-category" data-category="' + cat.id + '">' +
                    '<div class="cookie-category__head">' +
                        '<h3 class="cookie-category__name">' + cat.name + '</h3>' +
                        '<span class="cookie-category__badge">Always On</span>' +
                    '</div>' +
                    '<p class="cookie-category__desc">' + cat.description + '</p>' +
                '</div>'
            );
        }
        return (
            '<div class="cookie-category" data-category="' + cat.id + '">' +
                '<div class="cookie-category__head">' +
                    '<h3 class="cookie-category__name">' + cat.name + '</h3>' +
                    '<label class="cookie-toggle" aria-label="Toggle ' + cat.name + '">' +
                        '<input type="checkbox" id="cookie-toggle-' + cat.id + '" name="' + cat.id + '">' +
                        '<span class="cookie-toggle__track" aria-hidden="true"></span>' +
                    '</label>' +
                '</div>' +
                '<p class="cookie-category__desc">' + cat.description + '</p>' +
            '</div>'
        );
    }

    function createBanner() {
        var root = document.createElement("div");
        root.className = "cookie-banner-root";
        root.innerHTML =
            '<div id="cookieConsentBanner" class="cookie-banner" role="dialog" aria-modal="false" aria-labelledby="cookieBannerTitle" aria-describedby="cookieBannerDesc" hidden>' +
                '<div class="cookie-banner__panel">' +
                    '<div class="cookie-banner__inner">' +
                        '<div class="cookie-banner__icon" aria-hidden="true"><i class="fa fa-cookie-bite"></i></div>' +
                        '<div>' +
                            '<h2 id="cookieBannerTitle" class="cookie-banner__title">Your Privacy Matters</h2>' +
                            '<p id="cookieBannerDesc" class="cookie-banner__text">We use cookies and similar technologies to improve your browsing experience, analyze website traffic, remember your preferences, and enhance security. You can accept all cookies or manage your preferences at any time.</p>' +
                        '</div>' +
                        '<div class="cookie-banner__actions">' +
                            '<button type="button" class="cookie-banner__btn cookie-banner__btn--primary" id="cookieAcceptAll">Accept All</button>' +
                            '<button type="button" class="cookie-banner__btn cookie-banner__btn--secondary" id="cookieRejectNonEssential">Reject Non-Essential</button>' +
                            '<button type="button" class="cookie-banner__btn cookie-banner__btn--ghost" id="cookieCustomize">Customize Preferences</button>' +
                            '<a class="cookie-banner__btn cookie-banner__btn--link" id="cookieLearnMore" href="' + state.learnMoreUrl + '">Learn More</a>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div id="cookieModalOverlay" class="cookie-modal-overlay" role="presentation" aria-hidden="true" hidden>' +
                '<div id="cookiePreferencesModal" class="cookie-modal" role="dialog" aria-modal="true" aria-labelledby="cookieModalTitle" tabindex="-1">' +
                    '<div class="cookie-modal__header">' +
                        '<h2 id="cookieModalTitle" class="cookie-modal__title">Cookie Preferences</h2>' +
                        '<button type="button" class="cookie-modal__close" id="cookieModalClose" aria-label="Close cookie preferences">' +
                            '<i class="fa fa-times" aria-hidden="true"></i>' +
                        '</button>' +
                    '</div>' +
                    '<div class="cookie-modal__body">' +
                        '<p class="cookie-modal__intro">Manage how we use cookies and similar technologies. Essential cookies are always active because they are required for secure and reliable site operation.</p>' +
                        CATEGORIES.map(buildCategoryMarkup).join("") +
                    '</div>' +
                    '<div class="cookie-modal__footer">' +
                        '<button type="button" class="cookie-banner__btn cookie-banner__btn--primary" id="cookieModalAcceptAll">Accept All</button>' +
                        '<button type="button" class="cookie-banner__btn cookie-banner__btn--secondary" id="cookieModalSave">Save Preferences</button>' +
                        '<button type="button" class="cookie-banner__btn cookie-banner__btn--ghost" id="cookieModalCancel">Cancel</button>' +
                    '</div>' +
                '</div>' +
            '</div>';

        document.body.appendChild(root);

        state.banner = document.getElementById("cookieConsentBanner");
        state.overlay = document.getElementById("cookieModalOverlay");
        state.modal = document.getElementById("cookiePreferencesModal");

        document.getElementById("cookieAcceptAll").addEventListener("click", acceptAll);
        document.getElementById("cookieRejectNonEssential").addEventListener("click", rejectNonEssential);
        document.getElementById("cookieCustomize").addEventListener("click", openModal);
        document.getElementById("cookieModalClose").addEventListener("click", closeModal);
        document.getElementById("cookieModalCancel").addEventListener("click", closeModal);
        document.getElementById("cookieModalAcceptAll").addEventListener("click", function () {
            acceptAll();
            closeModal();
        });
        document.getElementById("cookieModalSave").addEventListener("click", function () {
            var prefs = {};
            CATEGORIES.forEach(function (cat) {
                if (cat.required) return;
                var input = document.getElementById("cookie-toggle-" + cat.id);
                prefs[cat.id] = input ? input.checked : false;
            });
            saveCustomPreferences(prefs);
        });

        state.overlay.addEventListener("click", function (e) {
            if (e.target === state.overlay) closeModal();
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && state.overlay.classList.contains("is-open")) {
                closeModal();
            }
        });
    }

    function injectFooterLink() {
        var copyright = document.querySelector(".copyright");
        if (!copyright || document.getElementById("cookieSettingsFooterLink")) return;

        var wrap = document.createElement("div");
        wrap.className = "col-12 text-center mt-2";
        wrap.innerHTML =
            '<button type="button" class="cookie-settings-link" id="cookieSettingsFooterLink">Cookie Settings</button>';

        copyright.appendChild(wrap);

        document.getElementById("cookieSettingsFooterLink").addEventListener("click", function () {
            openModal();
        });
    }

    function detectLearnMoreUrl(base) {
        var path = window.location.pathname || "";
        if (path.indexOf("/Charitize/") !== -1 || path.endsWith("/Charitize") || /Charitize\\/.test(path)) {
            return "about.html";
        }
        if (document.querySelector('a[href="Charitize/about.html"]')) {
            return "Charitize/about.html";
        }
        return base + "about.html";
    }

    function init() {
        var base = getAssetBase();
        state.learnMoreUrl = detectLearnMoreUrl(base);

        if (!document.querySelector('link[href*="cookie-banner.css"]')) {
            var link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = base + "css/cookie-banner.css";
            document.head.appendChild(link);
        }

        createBanner();
        injectFooterLink();

        if (!hasConsent()) {
            window.requestAnimationFrame(function () {
                showBanner();
            });
        }
    }

    global.CookieConsent = {
        getConsent: getConsent,
        hasConsent: hasConsent,
        updateConsent: updateConsent,
        resetConsent: resetConsent,
        acceptAll: acceptAll,
        rejectNonEssential: rejectNonEssential,
        openPreferences: openModal
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})(window);
