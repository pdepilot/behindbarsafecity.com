(function () {
    "use strict";

    var MAX_FILES = 5;
    var MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB for images/documents
    var MAX_VIDEO_SIZE = 20 * 1024 * 1024; // 20 MB for video (e.g. MP4)
    var MIN_DESC = 50;
    var ALLOWED_EXT = /\.(jpe?g|png|gif|webp|pdf|doc|docx|mp4|mov|webm|avi)$/i;
    var ALLOWED_MIME = /^(image\/(jpeg|png|gif|webp)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|video\/(mp4|quicktime|webm|x-msvideo))$/i;

    var selectedFiles = [];
    var form = document.getElementById("incidentReportForm");
    var fileInput = document.getElementById("evidenceFiles");
    var preview = document.getElementById("evidencePreview");
    var descField = document.getElementById("incidentDescription");
    var charCounter = document.getElementById("descCharCount");
    var relationship = document.getElementById("relationship");
    var fullName = document.getElementById("fullName");
    var submitBtn = document.getElementById("submitReportBtn");
    var successBox = document.getElementById("reportSuccessBox");
    var refDisplay = document.getElementById("generatedReference");
    var mapFrame = document.getElementById("locationMapFrame");
    var locationStatus = document.getElementById("locationStatus");
    var latInput = document.getElementById("gpsLatitude");
    var lngInput = document.getElementById("gpsLongitude");
    var addressInput = document.getElementById("incidentAddress");

    if (!form) return;

    function storageKey() {
        return "scvf_reports";
    }

    function getStoredReports() {
        try {
            return JSON.parse(sessionStorage.getItem(storageKey()) || "{}");
        } catch (e) {
            return {};
        }
    }

    function saveReport(ref, data) {
        var all = getStoredReports();
        all[ref] = data;
        sessionStorage.setItem(storageKey(), JSON.stringify(all));
    }

    function generateReference() {
        var year = new Date().getFullYear();
        var num = String(Math.floor(Math.random() * 900000) + 100000);
        return "SCVF-" + year + "-" + num;
    }

    function updateCharCount() {
        if (!descField || !charCounter) return;
        var len = descField.value.trim().length;
        charCounter.textContent = len + " / " + MIN_DESC + " minimum characters";
        charCounter.classList.toggle("is-invalid-text", len > 0 && len < MIN_DESC);
    }

    function toggleAnonymousFields() {
        if (!relationship || !fullName) return;
        var isAnon = relationship.value === "Anonymous Reporter";
        fullName.required = !isAnon;
        fullName.closest(".col-md-6, .col-12") && fullName.setAttribute("aria-required", String(!isAnon));
        var hint = document.getElementById("nameOptionalHint");
        if (hint) {
            hint.textContent = isAnon ? "(optional for anonymous reports)" : "";
        }
    }

    function formatBytes(bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / 1048576).toFixed(1) + " MB";
    }

    function renderPreviews() {
        if (!preview) return;
        preview.innerHTML = "";
        selectedFiles.forEach(function (file, index) {
            var item = document.createElement("div");
            item.className = "preview-item";

            var removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "btn btn-secondary btn-remove";
            removeBtn.setAttribute("aria-label", "Remove " + file.name);
            removeBtn.innerHTML = "&times;";
            removeBtn.addEventListener("click", function () {
                selectedFiles.splice(index, 1);
                syncFileInput();
                renderPreviews();
            });

            if (file.type.indexOf("image/") === 0) {
                var img = document.createElement("img");
                img.alt = file.name;
                img.src = URL.createObjectURL(file);
                item.appendChild(img);
            } else {
                var icon = document.createElement("div");
                icon.className = "file-icon";
                icon.innerHTML = file.type.indexOf("video/") === 0
                    ? '<i class="fa fa-video"></i>'
                    : '<i class="fa fa-file"></i>';
                item.appendChild(icon);
            }

            var name = document.createElement("p");
            name.className = "file-name";
            name.textContent = file.name + " (" + formatBytes(file.size) + ")";
            item.appendChild(name);
            item.appendChild(removeBtn);
            preview.appendChild(item);
        });
    }

    function syncFileInput() {
        if (!fileInput) return;
        var dt = new DataTransfer();
        selectedFiles.forEach(function (f) {
            dt.items.add(f);
        });
        fileInput.files = dt.files;
    }

    function isVideoFile(file) {
        return (file.type && file.type.indexOf("video/") === 0) ||
            /\.(mp4|mov|webm|avi)$/i.test(file.name);
    }

    function validateFile(file) {
        var isVideo = isVideoFile(file);
        var limit = isVideo ? MAX_VIDEO_SIZE : MAX_FILE_SIZE;
        var limitLabel = isVideo ? "20 MB" : "10 MB";
        if (file.size > limit) {
            return file.name + " exceeds the " + limitLabel + " limit" +
                (isVideo ? " for videos." : " for files.");
        }
        if (!ALLOWED_EXT.test(file.name) && !(file.type && ALLOWED_MIME.test(file.type))) {
            return file.name + " is not an allowed file type.";
        }
        return null;
    }

    function handleFiles(fileList) {
        var errors = [];
        Array.prototype.forEach.call(fileList, function (file) {
            if (selectedFiles.length >= MAX_FILES) {
                errors.push("Maximum of " + MAX_FILES + " files allowed.");
                return;
            }
            var err = validateFile(file);
            if (err) {
                errors.push(err);
                return;
            }
            var duplicate = selectedFiles.some(function (f) {
                return f.name === file.name && f.size === file.size;
            });
            if (!duplicate) selectedFiles.push(file);
        });
        if (errors.length) {
            alert(errors.join("\n"));
        }
        syncFileInput();
        renderPreviews();
    }

    function updateMap(lat, lng) {
        if (!mapFrame) return;
        var q = encodeURIComponent(lat + "," + lng);
        mapFrame.src = "https://www.google.com/maps?q=" + q + "&z=15&output=embed";
        mapFrame.setAttribute("aria-label", "Map preview for coordinates " + lat + ", " + lng);
    }

    function setLocationStatus(message, isError) {
        if (!locationStatus) return;
        locationStatus.textContent = message;
        locationStatus.className = isError ? "small text-danger mt-2 mb-0" : "small text-secondary mt-2 mb-0";
    }

    function detectLocation() {
        if (!navigator.geolocation) {
            setLocationStatus("Geolocation is not supported by this browser.", true);
            return;
        }
        setLocationStatus("Detecting your location…", false);
        navigator.geolocation.getCurrentPosition(
            function (pos) {
                var lat = pos.coords.latitude.toFixed(6);
                var lng = pos.coords.longitude.toFixed(6);
                if (latInput) latInput.value = lat;
                if (lngInput) lngInput.value = lng;
                updateMap(lat, lng);
                setLocationStatus("Location captured successfully.", false);
            },
            function () {
                setLocationStatus("Unable to detect location. Please enter coordinates manually or allow location access.", true);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    }

    function clearFieldErrors() {
        form.querySelectorAll(".is-invalid").forEach(function (el) {
            el.classList.remove("is-invalid");
        });
        var alertEl = document.getElementById("formValidationAlert");
        if (alertEl) alertEl.classList.add("d-none");
    }

    function showFieldError(el) {
        if (el) el.classList.add("is-invalid");
    }

    function validateForm() {
        clearFieldErrors();
        var valid = true;
        var messages = [];

        // Honeypot
        var honey = document.getElementById("website");
        if (honey && honey.value) {
            return { valid: false, spam: true };
        }

        var isAnon = relationship && relationship.value === "Anonymous Reporter";
        if (!isAnon && fullName && !fullName.value.trim()) {
            showFieldError(fullName);
            messages.push("Full name is required unless reporting anonymously.");
            valid = false;
        }

        var phone = document.getElementById("phoneNumber");
        if (phone && !isAnon && !phone.value.trim()) {
            showFieldError(phone);
            messages.push("Phone number is required unless reporting anonymously.");
            valid = false;
        }

        if (relationship && !relationship.value) {
            showFieldError(relationship);
            messages.push("Please select your relationship to the incident.");
            valid = false;
        }

        var incidentType = document.getElementById("incidentType");
        if (incidentType && !incidentType.value) {
            showFieldError(incidentType);
            messages.push("Please select an incident type.");
            valid = false;
        }

        var title = document.getElementById("incidentTitle");
        if (title && !title.value.trim()) {
            showFieldError(title);
            messages.push("Incident title is required.");
            valid = false;
        }

        var date = document.getElementById("incidentDate");
        if (date && !date.value) {
            showFieldError(date);
            messages.push("Date of incident is required.");
            valid = false;
        }

        var state = document.getElementById("incidentState");
        if (state && !state.value) {
            showFieldError(state);
            messages.push("State is required.");
            valid = false;
        }

        if (descField) {
            var len = descField.value.trim().length;
            if (len < MIN_DESC) {
                showFieldError(descField);
                messages.push("Please describe the incident in at least " + MIN_DESC + " characters.");
                valid = false;
            }
        }

        ["confirmAccurate", "confirmFalseReporting", "consentProcessing"].forEach(function (id) {
            var cb = document.getElementById(id);
            if (cb && !cb.checked) {
                showFieldError(cb);
                valid = false;
            }
        });
        if (!document.getElementById("confirmAccurate").checked ||
            !document.getElementById("confirmFalseReporting").checked ||
            !document.getElementById("consentProcessing").checked) {
            messages.push("Please accept all confidentiality confirmations before submitting.");
        }

        return { valid: valid, messages: messages, spam: false };
    }

    function setLoading(isLoading) {
        if (!submitBtn) return;
        submitBtn.disabled = isLoading;
        submitBtn.innerHTML = isLoading
            ? '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Submitting…'
            : '<i class="fa fa-paper-plane me-2"></i>Submit Report';
    }

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        var result = validateForm();
        if (result.spam) return;

        var alertEl = document.getElementById("formValidationAlert");
        if (!result.valid) {
            if (alertEl) {
                alertEl.textContent = result.messages.join(" ");
                alertEl.classList.remove("d-none");
            }
            var firstInvalid = form.querySelector(".is-invalid");
            if (firstInvalid) firstInvalid.focus();
            return;
        }

        setLoading(true);
        if (successBox) successBox.classList.remove("show");

        // Simulated secure submit (frontend-only). Ready for backend CSRF + API.
        window.setTimeout(function () {
            var ref = generateReference();
            var payload = {
                reference: ref,
                status: "Submitted",
                submittedAt: new Date().toISOString(),
                incidentType: document.getElementById("incidentType").value,
                title: document.getElementById("incidentTitle").value.trim()
            };
            saveReport(ref, payload);

            if (refDisplay) refDisplay.textContent = ref;
            if (successBox) {
                successBox.classList.add("show");
                successBox.scrollIntoView({ behavior: "smooth", block: "center" });
            }

            form.reset();
            selectedFiles = [];
            syncFileInput();
            renderPreviews();
            updateCharCount();
            toggleAnonymousFields();
            setLoading(false);

            // Refresh CSRF placeholder for next submission
            var csrf = document.getElementById("csrfToken");
            if (csrf) csrf.value = "pending-" + Date.now();
        }, 1200);
    });

    // Track report
    var trackForm = document.getElementById("trackReportForm");
    if (trackForm) {
        trackForm.addEventListener("submit", function (e) {
            e.preventDefault();
            var input = document.getElementById("trackReference");
            var resultBox = document.getElementById("trackResultBox");
            var resultRef = document.getElementById("trackResultRef");
            var resultStatus = document.getElementById("trackResultStatus");
            var resultMeta = document.getElementById("trackResultMeta");
            var statusItems = document.querySelectorAll("#trackStatusList .status-item");

            if (!input || !input.value.trim()) {
                if (input) input.classList.add("is-invalid");
                return;
            }
            input.classList.remove("is-invalid");

            var ref = input.value.trim().toUpperCase();
            var stored = getStoredReports()[ref];
            var statuses = [
                "Submitted",
                "Under Review",
                "Investigation Ongoing",
                "Referred",
                "Resolved",
                "Closed"
            ];

            var currentStatus = "Under Review";
            var meta = "Demo tracking — connect a backend to show live case updates.";

            if (stored) {
                currentStatus = stored.status || "Submitted";
                meta = "Submitted: " + new Date(stored.submittedAt).toLocaleString() +
                    (stored.incidentType ? " · Type: " + stored.incidentType : "");
            } else if (/^SCVF-\d{4}-\d{6}$/.test(ref)) {
                // Deterministic sample status for valid-format unknown refs
                var idx = parseInt(ref.slice(-2), 10) % statuses.length;
                currentStatus = statuses[idx];
                meta = "Reference format recognized. Sample status shown for demonstration.";
            } else {
                if (resultBox) {
                    resultBox.classList.add("show");
                    if (resultRef) resultRef.textContent = ref;
                    if (resultStatus) resultStatus.textContent = "Not Found";
                    if (resultMeta) resultMeta.textContent = "No report matches this reference. Check the number and try again.";
                }
                statusItems.forEach(function (item) {
                    item.classList.remove("active", "done");
                });
                return;
            }

            if (resultRef) resultRef.textContent = ref;
            if (resultStatus) resultStatus.textContent = currentStatus;
            if (resultMeta) resultMeta.textContent = meta;

            var activeIndex = statuses.indexOf(currentStatus);
            statusItems.forEach(function (item, i) {
                item.classList.remove("active", "done");
                if (i < activeIndex) item.classList.add("done");
                if (i === activeIndex) item.classList.add("active");
            });

            if (resultBox) {
                resultBox.classList.add("show");
                resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener("change", function () {
            handleFiles(fileInput.files);
            // Reset so same file can be re-chosen after remove
            fileInput.value = "";
            syncFileInput();
        });
    }

    if (descField) {
        descField.addEventListener("input", updateCharCount);
        updateCharCount();
    }

    if (relationship) {
        relationship.addEventListener("change", toggleAnonymousFields);
        toggleAnonymousFields();
    }

    var detectBtn = document.getElementById("detectLocationBtn");
    var useCurrentBtn = document.getElementById("useCurrentLocationBtn");
    if (detectBtn) detectBtn.addEventListener("click", detectLocation);
    if (useCurrentBtn) useCurrentBtn.addEventListener("click", detectLocation);

    [latInput, lngInput].forEach(function (el) {
        if (!el) return;
        el.addEventListener("change", function () {
            if (latInput.value && lngInput.value) {
                updateMap(latInput.value, lngInput.value);
            }
        });
    });

    // Smooth scroll for hero CTAs
    document.querySelectorAll('[data-scroll-target]').forEach(function (btn) {
        btn.addEventListener("click", function (e) {
            var target = document.querySelector(btn.getAttribute("data-scroll-target"));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    });
})();
