// script.js

// Global helpers for sanitizing hidden controls so the submit handler
// (which is attached outside DOMContentLoaded) can use them without scope errors.
function sanitizeHiddenControls(form) {
    const changed = [];
    const elements = Array.from((form && form.elements) || []);
    elements.forEach(el => {
        try {
            if (!el.name) return;

            const cs = window.getComputedStyle(el);
            let hidden = (el.offsetParent === null) || cs.display === 'none' || cs.visibility === 'hidden';

            let p = el.parentElement;
            while (!hidden && p) {
                const ps = window.getComputedStyle(p);
                if (ps.display === 'none' || ps.visibility === 'hidden') hidden = true;
                p = p.parentElement;
            }

            if (hidden) {
                const prev = {
                    el,
                    wasDisabled: el.disabled ? 'true' : 'false',
                    requiredWas: (el.hasAttribute && el.hasAttribute('required')) ? 'true' : 'false'
                };

                if (prev.requiredWas === 'true') {
                    try { el.removeAttribute('required'); } catch (e) { }
                    el.dataset.requiredWas = 'true';
                }

                // Do NOT disable hidden elements here — disabled elements are
                // excluded from FormData. We only remove/restore `required` so
                // browser constraint validation won't focus non-focusable inputs.
                el.dataset._sanitized = 'true';
                changed.push(prev);
            }
        } catch (err) {
            // ignore
        }
    });
    return changed;
}

function restoreSanitizedControls(changed) {
    changed.forEach(rec => {
        try {
            if (!rec || !rec.el) return;
            const el = rec.el;
            if (rec.requiredWas === 'true') {
                try { el.setAttribute('required', 'required'); } catch (e) { }
                if (el.dataset) delete el.dataset.requiredWas;
            }
            // We intentionally do NOT change disabled state here because
            // we never disabled elements when sanitizing (to preserve FormData).
            if (el.dataset) delete el.dataset._sanitized;
        } catch (err) { }
    });
}

// Guard to prevent double submission from multiple clicks
let submitInProgress = false;
document.addEventListener("DOMContentLoaded", () => {
    // Pagination Logic
    const sections = Array.from(document.querySelectorAll('.form-section'));
    let currentPage = 0;

    // Ensure we start with section 0
    const btnNext = document.getElementById('btn-next');
    const btnPrev = document.getElementById('btn-prev');
    const btnSubmit = document.getElementById('btn-submit');
    const formEl = document.getElementById('intakeForm');
    const progressText = document.getElementById('progress-text');
    const progressBar = document.getElementById('progress-bar');


    function updateView() {
        sections.forEach((sec, idx) => {
            const visible = (idx === currentPage);
            sec.style.display = visible ? 'block' : 'none';

            // When hiding sections, remove "required" from controls so
            // native browser validation cannot focus invisible inputs.
            // Store previous required state in a data attribute so we can
            // restore it when the section becomes visible again.
            const controls = sec.querySelectorAll('input, textarea, select');
            controls.forEach(ctrl => {
                try {
                    if (visible) {
                        if (ctrl.dataset && ctrl.dataset.requiredWas === 'true') {
                            ctrl.setAttribute('required', 'required');
                            delete ctrl.dataset.requiredWas;
                        }
                    } else {
                        if (ctrl.hasAttribute && ctrl.hasAttribute('required')) {
                            if (ctrl.dataset) ctrl.dataset.requiredWas = 'true';
                            ctrl.removeAttribute('required');
                        }
                    }
                } catch (err) {
                    // ignore any edge cases reading attributes on exotic controls
                }
            });
        });

        if (btnPrev) btnPrev.disabled = (currentPage === 0);

        if (currentPage === sections.length - 1) {
            if (btnNext) btnNext.style.display = 'none';
            if (btnSubmit) btnSubmit.style.display = 'inline-block';
        } else {
            if (btnNext) btnNext.style.display = 'inline-block';
            if (btnSubmit) btnSubmit.style.display = 'none';
        }

        const perc = Math.round(((currentPage) / (sections.length - 1)) * 100);

        if (progressBar && progressText) {
            progressBar.style.width = perc + '%';
            progressText.innerText = `Step ${currentPage + 1} of ${sections.length}`;
        }

        window.scrollTo(0, 0);
    }

    if (sections.length > 0) {
        updateView();
    }

    // Ensure the DOM form has noValidate set (double-safety for browsers)
    if (formEl) formEl.noValidate = true;

    // Helper: disable hidden form controls (returns array of affected elements)
    function disableHiddenControls(form) {
        const affected = [];
        const elements = Array.from(form.elements || []);
        elements.forEach(el => {
            try {
                if (!el.name) return;
                if (el.offsetParent === null && !el.disabled) {
                    el.dataset._wasDisabled = 'false';
                    el.disabled = true;
                    affected.push(el);
                }
            } catch (err) { }
        });
        return affected;
    }

    function restoreControls(list) {
        list.forEach(el => {
            try {
                if (el && el.dataset && typeof el.dataset._wasDisabled !== 'undefined') {
                    el.disabled = (el.dataset._wasDisabled === 'true');
                    delete el.dataset._wasDisabled;
                }
            } catch (err) { }
        });
    }

    // Use the global sanitizer we exposed above to avoid duplicate logic.
    function sanitizeHiddenControls(form) {
        return window.sanitizeHiddenControls(form);
    }

    function restoreSanitizedControls(changed) {
        changed.forEach(rec => {
            try {
                if (!rec || !rec.el) return;
                const el = rec.el;
                // restore required if it was present
                if (rec.requiredWas === 'true') {
                    try { el.setAttribute('required', 'required'); } catch (e) { }
                    if (el.dataset) delete el.dataset.requiredWas;
                }
                if (el.dataset && typeof el.dataset._wasDisabled !== 'undefined') {
                    el.disabled = (el.dataset._wasDisabled === 'true');
                    delete el.dataset._wasDisabled;
                } else {
                    el.disabled = (rec.wasDisabled === 'true');
                }
                if (el.dataset) delete el.dataset._sanitized;
            } catch (err) { }
        });
    }

    // Robust click -> submit binding: ensure clicking the Submit button triggers
    // the form's submit handler even in older browsers.
    if (btnSubmit && formEl) {
        btnSubmit.addEventListener('click', (ev) => {
            // Prevent multiple rapid clicks
            if (submitInProgress) return;
            submitInProgress = true;
            // Disable hidden controls first so any browser validation (if
            // accidentally triggered) won't try to focus them. Then dispatch
            // a synthetic submit event which invokes our JS submit handler
            // without running native validation.
            // Temporarily remove `required` from hidden controls so native
            // validation won't try to focus them. Do NOT disable elements
            // because disabled elements are excluded from FormData.
            const sanitized = sanitizeHiddenControls(formEl);

            // Prefer requestSubmit (respects form-associated buttons) when available
            // because it's less likely to trigger native validation in odd ways.
            if (typeof formEl.requestSubmit === 'function') {
                formEl.requestSubmit();
            } else {
                const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                formEl.dispatchEvent(submitEvent);
            }

            // Restore the required attributes shortly after. The submit handler
            // will also restore them in its finally block; this is a safety net
            // in case something prevents the submit handler from running.
            setTimeout(() => restoreSanitizedControls(sanitized), 200);
            // allow click again after a short delay; actual submit handler will
            // clear submitInProgress when finished
            setTimeout(() => { submitInProgress = false; }, 1000);
        });
    }

    window.navigateForm = function (direction) {
        if (direction === 1) {
            // basic validation of visible required fields
            const currentSection = sections[currentPage];
            const requiredFields = currentSection.querySelectorAll('[required]');
            let isValid = true;
            let firstInvalid = null;

            // Only validate elements that are part of a visible logical flow
            requiredFields.forEach(field => {
                // If the field or its parent conditional block is hidden, ignore validation
                if (field.offsetParent === null) return;

                if (field.type === 'radio' || field.type === 'checkbox') {
                    const groupName = field.name;
                    const checked = currentSection.querySelector(`input[name="${groupName}"]:checked`);
                    if (!checked) {
                        isValid = false;
                        if (!firstInvalid) firstInvalid = field;
                    }
                } else if (!field.value.trim()) {
                    isValid = false;
                    if (!firstInvalid) firstInvalid = field;
                }
            });

            if (!isValid) {
                alert('Please fill out all required fields marked with * before proceeding.');
                if (firstInvalid) firstInvalid.focus();
                return;
            }
        }

        currentPage += direction;

        // Skip Section 14 (Perinatal) if Male
        if (sections[currentPage] && sections[currentPage].id === 'section-14') {
            const sexVal = document.querySelector('input[name="sexAssigned"]:checked')?.value;
            if (sexVal === 'Male') {
                currentPage += direction; // skip it, continue in same direction
            }
        }

        if (currentPage < 0) currentPage = 0;
        if (currentPage >= sections.length) currentPage = sections.length - 1;

        updateView();
    };

    // Initialize PHQ-9 and GAD-7 listeners specifically if they are <select> or <input type="radio">
    // Since we output them as radios:
    const phq9Radios = document.querySelectorAll('input[name^="phq9_"]');
    phq9Radios.forEach(r => r.addEventListener('change', window.handlePhq9));

    const gad7Radios = document.querySelectorAll('input[name^="gad7_"]');
    gad7Radios.forEach(r => r.addEventListener('change', window.handleGad7));
});


// Global conditional logic handlers

window.togglePerinatalSection = function () {
    const sexVal = document.querySelector('input[name="sexAssigned"]:checked')?.value;
    const perinatalSection = document.getElementById('section-14');
    if (perinatalSection && sexVal === 'Male') {
        // Uncheck/clear any data in the perinatal section so it doesn't submit
        const inputs = perinatalSection.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            if (input.type === 'radio' || input.type === 'checkbox') input.checked = false;
            else input.value = '';
        });
    }
};

window.handlePerinatalStatusChange = function (event) {
    const pregnantCb = document.querySelector('input[name="perinatalStatus"][value="Currently Pregnant"]');
    const postpartumCb = document.querySelector('input[name="perinatalStatus"][value="Postpartum"]');
    const lactatingCb = document.querySelector('input[name="perinatalStatus"][value="Lactating"]');
    const planningCb = document.querySelector('input[name="perinatalStatus"][value="Planning pregnancy"]');
    const noneCb = document.querySelector('input[name="perinatalStatus"][value="None of the above"]');

    if (event && event.target === noneCb && noneCb.checked) {
        if (pregnantCb) pregnantCb.checked = false;
        if (postpartumCb) postpartumCb.checked = false;
        if (lactatingCb) lactatingCb.checked = false;
        if (planningCb) planningCb.checked = false;
    } else if (event && event.target !== noneCb && (pregnantCb?.checked || postpartumCb?.checked || lactatingCb?.checked || planningCb?.checked)) {
        if (noneCb) noneCb.checked = false;
    }

    const isPregnant = pregnantCb?.checked;
    const isPostpartum = postpartumCb?.checked;
    const isLactating = lactatingCb?.checked;
    const isPlanning = planningCb?.checked;

    const pregFields = document.getElementById('currentlyPregnantFields');
    if (pregFields) pregFields.style.display = isPregnant ? 'block' : 'none';
    const estDueDate = document.getElementById('estimatedDueDate');
    if (estDueDate) {
        isPregnant ? estDueDate.setAttribute('required', 'required') : estDueDate.removeAttribute('required');
    }

    const postFields = document.getElementById('postpartumFields');
    if (postFields) postFields.style.display = isPostpartum ? 'block' : 'none';
    const delDate = document.getElementById('deliveryDate');
    if (delDate) {
        isPostpartum ? delDate.setAttribute('required', 'required') : delDate.removeAttribute('required');
    }

    const lactFields = document.getElementById('lactatingFields');
    if (lactFields) lactFields.style.display = isLactating ? 'block' : 'none';

    const obgynFields = document.getElementById('obgynFields');
    if (obgynFields) obgynFields.style.display = (isPregnant || isPostpartum) ? 'block' : 'none';
    const obgynProv = document.getElementById('obgynProvider');
    if (obgynProv) {
        (isPregnant || isPostpartum) ? obgynProv.setAttribute('required', 'required') : obgynProv.removeAttribute('required');
    }

    const birthControlFields = document.getElementById('birthControlFields');
    if (birthControlFields) {
        const isShown = (!isPregnant && !isPlanning);
        birthControlFields.style.display = isShown ? 'block' : 'none';

        // Handle required for useContraception radio
        const bcRadios = birthControlFields.querySelectorAll('input[name="useContraception"]');
        bcRadios.forEach(r => {
            if (isShown) r.setAttribute('required', 'required');
            else r.removeAttribute('required');
        });
    }

    const pastMHYes = document.querySelector('input[name="pastPerinatalMentalHealth"][value="Yes"]')?.checked;
    const difficultyGrp = document.getElementById('difficultyConnectingGroup');
    if (difficultyGrp) {
        const isShown = (isPregnant || isPostpartum || pastMHYes);
        difficultyGrp.style.display = isShown ? 'block' : 'none';

        // Handle required for difficultyConnecting radio
        const dcRadios = difficultyGrp.querySelectorAll('input[name="difficultyConnecting"]');
        dcRadios.forEach(r => {
            if (isShown) r.setAttribute('required', 'required');
            else r.removeAttribute('required');
        });
    }

    // Evaluate if any child screening triggered the detail text block
    const checks = ['Memory problems', 'Trouble concentrating', 'Disorientation/confusion', 'Unusual perceptions (hallucinations, illusions)', 'History of seizures, TBI, stroke'];
    // Assuming Section 15 check below...
};

window.checkSection15Logic = function() {
    const memory = document.querySelector('input[name="cogMemory"][value="Yes"]')?.checked;
    const conc = document.querySelector('input[name="cogConcentrating"][value="Yes"]')?.checked;
    const conf = document.querySelector('input[name="cogConfusion"][value="Yes"]')?.checked;
    const perc = document.querySelector('input[name="cogPerceptions"][value="Yes"]')?.checked;
    const neuro = document.querySelector('input[name="cogHistoryNeuro"][value="Yes"]')?.checked;
    const grp = document.getElementById('neuroHistoryDetailsGroup');
    if (grp) {
        grp.style.display = (memory || conc || conf || perc || neuro) ? 'block' : 'none';
        const txt = grp.querySelector('textarea');
        if (txt) {
            (memory || conc || conf || perc || neuro) ? txt.setAttribute('required', 'required') : txt.removeAttribute('required');
        }
    }
};

window.togglePerinatalSection = function () {
    const sexVal = document.querySelector('input[name="sexAssigned"]:checked')?.value;
    const perinatalSection = document.getElementById('section-14');
    if (perinatalSection && sexVal === 'Male') {
        // Uncheck/clear any data in the perinatal section so it doesn't submit
        const inputs = perinatalSection.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            if (input.type === 'radio' || input.type === 'checkbox') input.checked = false;
            else input.value = '';
        });
    }
};

window.handlePhq9 = function () {
    let total = 0;
    for (let i = 1; i <= 9; i++) {
        const checked = document.querySelector(`input[name="phq9_${i}"]:checked`);
        if (checked) {
            total += parseInt(checked.value);
        }
    }
    const scoreEl = document.getElementById('phq9-score');
    if (scoreEl) scoreEl.innerText = total;
};

window.handleGad7 = function () {
    let total = 0;
    for (let i = 1; i <= 7; i++) {
        const checked = document.querySelector(`input[name="gad7_${i}"]:checked`);
        if (checked) {
            total += parseInt(checked.value);
        }
    }
    const scoreEl = document.getElementById('gad7-score');
    if (scoreEl) scoreEl.innerText = total;
};

window.toggleSudDetails = function () {
    const sudScreenYes = document.querySelector('input[name="sudScreen"][value="Yes"]')?.checked;
    const sympCheckboxes = document.querySelectorAll('input[name="sudSymp"]:checked');
    const conditionalGroup = document.getElementById('sudConditionalGroup');
    const hasAnyChecked = sympCheckboxes.length > 0;

    // Show conditional group if "Yes" is selected AND at least one symptom is checked
    if (conditionalGroup) {
        const isShown = sudScreenYes && hasAnyChecked;
        conditionalGroup.style.display = isShown ? 'block' : 'none';

        // Handle required state for fields in the conditional group
        const requiredFields = conditionalGroup.querySelectorAll('input[type="radio"], input[name="sudSubstances"]');
        requiredFields.forEach(f => {
            if (isShown) {
                if (f.name === 'sudSubstances') {
                    // For checkboxes, we often set required on the first one as a hint/validation trigger
                    // But standard HTML required on checkboxes means THAT checkbox MUST be checked.
                    // Better to handle this in custom validation if needed. 
                    // For now, I'll use the radio pattern for radio groups.
                } else {
                    f.setAttribute('required', 'required');
                }
            } else {
                f.removeAttribute('required');
            }
        });
    }
};

window.handleSafetyLogic = function () {
    const suicidalThoughts = document.querySelector('input[name="suicidalThoughts"]:checked')?.value;
    const currentThoughtsDetail = document.querySelector('input[name="currentThoughtsDetail"]:checked')?.value;

    const currentThoughtsSection = document.getElementById('currentThoughtsSection');
    const alert = document.getElementById('supportResourcesAlert');
    const meansSafety = document.getElementById('meansSafetySection');

    if (currentThoughtsSection) {
        currentThoughtsSection.style.display = (suicidalThoughts === 'Yes - currently') ? 'block' : 'none';

        // Update required attribute for currentThoughtsDetail
        const radios = currentThoughtsSection.querySelectorAll('input[name="currentThoughtsDetail"]');
        radios.forEach(r => {
            if (suicidalThoughts === 'Yes - currently') {
                r.setAttribute('required', 'required');
            } else {
                r.removeAttribute('required');
            }
        });
    }

    // Calculate Risk Level (derived from current thoughts)
    let riskLevel = 'none';
    if (suicidalThoughts === 'Yes - currently') {
        if (currentThoughtsDetail === 'Passive thoughts') {
            riskLevel = 'passive';
        } else if (currentThoughtsDetail === 'Active thoughts of suicide but without a plan and intent') {
            riskLevel = 'active_no_plan';
        } else if (currentThoughtsDetail === 'Active thoughts of suicide with a plan or intent') {
            riskLevel = 'active_plan';
        }
    }

    // Toggle Support Resources and Means Safety based on risk level
    const showResources = (riskLevel === 'active_no_plan' || riskLevel === 'active_plan');
    const showMeansSafety = (riskLevel === 'active_no_plan' || riskLevel === 'active_plan');

    if (alert) alert.style.display = showResources ? 'block' : 'none';
    if (meansSafety) {
        meansSafety.style.display = showMeansSafety ? 'block' : 'none';

        // Handle required fields within Means Safety if shown
        const requiredInputs = meansSafety.querySelectorAll('input[name="firearmsAccess"], input[name="otherHarmItems"]');
        requiredInputs.forEach(input => {
            if (showMeansSafety) input.setAttribute('required', 'required');
            else input.removeAttribute('required');
        });
    }
};

let forceSubmit = false;

window.closeConsistencyModal = function () {
    const modal = document.getElementById('consistencyReminderModal');
    if (modal) modal.style.display = 'none';
};

window.confirmConsistencyAndSubmit = function () {
    forceSubmit = true;
    window.closeConsistencyModal();
    document.getElementById('intakeForm')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
};

window.closeMedicationModal = function () {
    const modal = document.getElementById('medicationHistoryReminderModal');
    if (modal) modal.style.display = 'none';
};

window.confirmMedicationAndSubmit = function () {
    forceSubmit = true;
    window.closeMedicationModal();
    document.getElementById('intakeForm')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
};

function checkSection6Consistency() {
    if (forceSubmit) return true;

    const screeningVal = document.querySelector('input[name="pastPsychMedsScreen"]:checked')?.value;
    if (screeningVal === 'Yes' || screeningVal === 'Unsure') {
        const checkedMeds = document.querySelectorAll('.past-med-cb:checked');
        const hasCheckedMeds = (checkedMeds.length > 0);

        const otherMedsText = document.querySelector('textarea[name="otherPastPsychMedsText"]')?.value.trim();
        const hasTextMeds = (otherMedsText && otherMedsText.length > 0);

        if (!hasCheckedMeds && !hasTextMeds) {
            const modal = document.getElementById('medicationHistoryReminderModal');
            if (modal) {
                modal.style.display = 'flex';
                return false;
            }
        }
    }
    return true;
}

function checkSection8Consistency() {
    if (forceSubmit) return true;

    // Screening radio groups in Section 8 (16 groups)
    const screeningFields = [
        { name: 'bipolarProb', neg: ['No', 'Substance'] },
        { name: 'bipolarPeriod', neg: ['No', 'Substance'] },
        { name: 'gadWorry', neg: ['No', 'Substance'] },
        { name: 'gadMultiple', neg: ['No', 'Substance'] },
        { name: 'panicScreen', neg: ['No', 'Substance'] },
        { name: 'socialAnxScreen', neg: ['No', 'Substance'] },
        { name: 'ptsdScreen', neg: ['No', 'Substance'] },
        { name: 'psychosisScreen', neg: ['No', 'Substance'] },
        { name: 'eatingScreen', neg: ['No', 'Substance'] },
        { name: 'sudScreen', neg: ['No', 'Unsure'] }
    ];

    let negativeCount = 0;
    screeningFields.forEach(field => {
        const val = document.querySelector(`input[name="${field.name}"]:checked`)?.value;
        // Consider unanswered or negative responses
        if (!val || field.neg.includes(val) || val.includes('No')) {
            negativeCount++;
        }
    });

    // Personality Patterns Checkbox Group (Count as 1 screener)
    const perPatterns = document.querySelectorAll('input[name="perPattern"]:checked');
    const hasPersonalityPatterns = perPatterns.length > 0 && Array.from(perPatterns).every(p => !p.classList.contains('none-option'));

    if (!hasPersonalityPatterns) {
        negativeCount++;
    }

    const totalItems = screeningFields.length + 1; // 17 items
    const negPercentage = (negativeCount / totalItems) * 100;

    // Threshold: more than 85% negative
    if (negPercentage >= 85) {
        const modal = document.getElementById('consistencyReminderModal');
        if (modal) {
            modal.style.display = 'flex';
            return false;
        }
    }

    return true;
}

document.getElementById('intakeForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();

    // Check Section 6 consistency first
    if (!checkSection6Consistency()) {
        return;
    }

    // Check Section 8 consistency before proceeding
    if (!checkSection8Consistency()) {
        return;
    }

    // Disable submit button and show loading state
    const submitBtn = document.getElementById('btn-submit');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Submitting...';
    }
    // Sanitize hidden controls: remove `required` and disable them so
    // native browser validation cannot try to focus non-focusable inputs.
    const formEl = e.target;
    const sanitized = sanitizeHiddenControls(formEl);

    try {
        const formData = new FormData(e.target);

        // Convert FormData to JSON object, handling multiple checkboxes
        const jsonObject = {};
        for (const [key, value] of formData.entries()) {
            if (jsonObject[key] !== undefined) {
                if (!Array.isArray(jsonObject[key])) {
                    jsonObject[key] = [jsonObject[key]];
                }
                jsonObject[key].push(value);
            } else {
                jsonObject[key] = value;
            }
        }

        const response = await fetch('/api/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(jsonObject)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // Show a friendly thank-you message and submission id instead of reloading
            const wrapper = document.querySelector('.form-wrapper');
            if (wrapper) {
                wrapper.innerHTML = `
                        <div style="text-align:center;padding:3rem 1rem;">
                            <h2 style="color:var(--primary-color)">Thank you — form submitted</h2>
                            <p>Your submission ID: <strong>${result.id}</strong></p>
                            <p>We have received your intake questionnaire and will contact you with next steps.</p>
                        </div>`;
            } else {
                alert("Form submitted successfully! Your information has been securely saved. Reference ID: " + result.id);
            }
        } else {
            console.error('Submission failed:', result);
            alert("There was an issue submitting your form. Please try again or contact the clinic.");
        }
    } catch (error) {
        console.error('Network error during submission:', error);
        alert("A network error occurred while submitting. Please check your connection and try again.");
    } finally {
        // Restore disabled/required state for elements we temporarily modified
        try {
            restoreSanitizedControls(sanitized);
        } catch (ignore) { }

        // Clear in-progress guard so another submit can proceed later
        submitInProgress = false;

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Submit Questionnaire';
        }
    }
});

// Handle "None of the above" behavior for checkboxes
document.addEventListener('change', function (e) {
    if (e.target.classList.contains('none-option') && e.target.checked) {
        const group = e.target.closest('.options-list');
        if (group) {
            group.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                if (cb !== e.target) cb.checked = false;
            });
        }
    } else if (e.target.type === 'checkbox' && !e.target.classList.contains('none-option') && e.target.checked) {
        const group = e.target.closest('.options-list');
        const noneOpt = group ? group.querySelector('.none-option') : null;
        if (noneOpt) noneOpt.checked = false;
    }

    // Auto-trigger medication details update for any checkbox in section 6
    if (e.target.closest('#section-6') && e.target.type === 'checkbox') {
        window.toggleMedDetails();
    }
});

// Dynamic Medication Details for Section 6
window.toggleMedDetails = function () {
    const container = document.getElementById('dynamicMedDetailsContainer');
    if (!container) return;

    const section6 = document.getElementById('section-6');
    const trialSummary = document.getElementById('trialDetailsSummary');

    // Find all checked medication checkboxes that are NOT "None of the above"
    const checkedMeds = Array.from(section6.querySelectorAll('.past-med-cb:checked'))
        .filter(cb => !cb.value.includes('None of the Above'));

    // Update Trial Summary visibility: show if any med is selected
    if (trialSummary) {
        trialSummary.style.display = (checkedMeds.length > 0) ? 'block' : 'none';
    }

    const medsData = checkedMeds.map(cb => {
        let id = cb.value;
        let name = cb.value;
        // Check for "Other" text inputs associated with checkboxes
        const parent = cb.parentElement;
        const otherInput = parent.querySelector('input[type="text"]');
        if (otherInput && otherInput.value.trim()) {
            name = otherInput.value.trim();
        }
        return { id: id, name: name };
    });

    const existingBlocks = Array.from(container.querySelectorAll('.med-detail-block'));
    const newIds = medsData.map(m => m.id);

    // Remove old blocks
    existingBlocks.forEach(block => {
        if (!newIds.includes(block.dataset.medId)) {
            block.remove();
        }
    });

    // Add or update blocks using the template
    const template = document.getElementById('medFollowupTemplate');

    medsData.forEach(med => {
        let block = container.querySelector(`.med-detail-block[data-med-id="${med.id}"]`);
        if (!block && template) {
            const clone = template.content.cloneNode(true);
            const wrapper = document.createElement('div');
            wrapper.className = 'med-detail-block';
            wrapper.dataset.medId = med.id;
            wrapper.style.border = '1px solid #ddd';
            wrapper.style.padding = '15px';
            wrapper.style.marginTop = '15px';
            wrapper.style.borderRadius = '5px';
            wrapper.style.backgroundColor = '#fcfcfc';
            wrapper.appendChild(clone);

            // Set unique names for inputs within the block to ensure they are submitted correctly
            const safeId = med.id.replace(/[^a-zA-Z0-9]/g, '_');
            wrapper.querySelector('.med-title-placeholder').innerText = med.name;

            // Current taking radios
            wrapper.querySelectorAll('.current-radio-yes, .current-radio-no').forEach(r => {
                r.name = `med_current_${safeId}`;
                r.setAttribute('required', 'required');
            });

            // Help / benefit radios
            wrapper.querySelectorAll('.help-radio-yes, .help-radio-no, .help-radio-partial, .help-radio-unsure').forEach(r => {
                r.name = `med_help_${safeId}`;
                r.setAttribute('required', 'required');
            });

            // Length radios (required)
            wrapper.querySelectorAll('.length-radio').forEach(r => {
                r.name = `med_length_${safeId}`;
                r.setAttribute('required', 'required');
            });
            const lengthOtherRadio = wrapper.querySelector('.length-other-radio');
            const lengthOtherInput = wrapper.querySelector('.length-other-input');
            if (lengthOtherRadio && lengthOtherInput) {
                lengthOtherRadio.addEventListener('change', () => { lengthOtherInput.style.display = 'inline-block'; lengthOtherInput.setAttribute('required','required'); });
                // Hide/clear when other not selected
                wrapper.querySelectorAll('.length-radio').forEach(r => { if (r !== lengthOtherRadio) r.addEventListener('change', () => { lengthOtherInput.style.display = 'none'; lengthOtherInput.removeAttribute('required'); lengthOtherInput.value = ''; }); });
                lengthOtherInput.style.display = 'none';
                lengthOtherInput.name = `med_length_other_${safeId}`;
            }

            // Dose
            const doseEl = wrapper.querySelector('.med-dose');
            if (doseEl) doseEl.name = `med_dose_${safeId}`;

            // Reasons (checkboxes) - allow multiple, name as array
            const stopReasons = wrapper.querySelectorAll('.med-stop-reason');
            stopReasons.forEach(cb => {
                cb.name = `med_stop_${safeId}[]`;
            });

            // 'Other' text for stop reasons
            const stopOtherCb = wrapper.querySelector('.med-stop-reason-other');
            const stopOtherText = wrapper.querySelector('.med-stop-reason-other-text');
            if (stopOtherCb && stopOtherText) {
                stopOtherCb.addEventListener('change', () => {
                    if (stopOtherCb.checked) { stopOtherText.style.display = 'inline-block'; stopOtherText.name = `med_stop_other_${safeId}`; stopOtherText.setAttribute('required','required'); }
                    else { stopOtherText.style.display = 'none'; stopOtherText.removeAttribute('name'); stopOtherText.removeAttribute('required'); stopOtherText.value = ''; }
                });
                stopOtherText.style.display = 'none';
            }

            // Side effects options - hidden unless 'Intolerable side effects' selected
            const seOptions = wrapper.querySelectorAll('.med-se-option');
            seOptions.forEach(cb => { cb.name = `med_se_${safeId}[]`; });
            const seOtherCb = wrapper.querySelector('.med-se-other');
            const seOtherText = wrapper.querySelector('.med-se-other-text');
            if (seOtherCb && seOtherText) {
                seOtherCb.addEventListener('change', () => {
                    if (seOtherCb.checked) { seOtherText.style.display = 'inline-block'; seOtherText.name = `med_se_other_${safeId}`; seOtherText.setAttribute('required','required'); }
                    else { seOtherText.style.display = 'none'; seOtherText.removeAttribute('name'); seOtherText.removeAttribute('required'); seOtherText.value = ''; }
                });
                seOtherText.style.display = 'none';
            }

            // Show/hide side-effects container when intolerable reason checked
            const sideEffectsContainer = wrapper.querySelector('.side-effects-container');
            const intolerableCb = Array.from(stopReasons).find(c => (c.value && c.value.toLowerCase().includes('intolerable')) );
            const updateSeVisibility = () => {
                if (intolerableCb && intolerableCb.checked) { if (sideEffectsContainer) sideEffectsContainer.style.display = 'block'; }
                else { if (sideEffectsContainer) sideEffectsContainer.style.display = 'none'; }
            };
            stopReasons.forEach(cb => cb.addEventListener('change', updateSeVisibility));
            // initialize
            updateSeVisibility();

            // Additional notes
            const notes = wrapper.querySelector('.med-additional-notes');
            if (notes) notes.name = `med_notes_${safeId}`;

            container.appendChild(wrapper);
        } else if (block) {
            const titleSpan = block.querySelector('.med-title-placeholder');
            if (titleSpan) titleSpan.innerText = med.name;
        }
    });

    if (medsData.length === 0) {
        container.innerHTML = '';
    }
};

window.handleNoneOption = function (noneCb) {
    if (noneCb.checked) {
        const group = noneCb.closest('.options-list');
        group.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (cb !== noneCb) {
                cb.checked = false;
            }
        });
        window.toggleMedDetails();
    }
};

// Also listen for "Other" text input changes to update titles dynamically
document.addEventListener('input', function (e) {
    if (e.target.closest('#section-6') && e.target.type === 'text' && e.target.classList.contains('past-med-cb') === false) {
        // Find the adjacent checkbox
        const checkbox = e.target.previousElementSibling ? e.target.previousElementSibling.previousElementSibling : null;
        if (checkbox && checkbox.type === 'checkbox' && checkbox.checked) {
            window.toggleMedDetails();
        }
    }
});

// ========== NEW FUNCTIONS FOR REQUIREMENTS ==========

// Section 5B: Toggle medication fields based on Yes/No/Unsure
window.toggleCurrentMedsList = function () {
    const val = document.querySelector('input[name="takingCurrentMeds"]:checked')?.value;
    const container = document.getElementById('currentMedsContainer');
    if (container) {
        container.style.display = (val === 'Yes' || val === 'Unsure') ? 'block' : 'none';
    }
};

// Section 5B: Check if "No" or blank fields need confirmation
window.checkSection5bConsistency = function () {
    const val = document.querySelector('input[name="takingCurrentMeds"]:checked')?.value;
    if (val === 'No') {
        const modal = document.getElementById('currentMedsConfirmationModal');
        if (modal) {
            modal.style.display = 'flex';
            return false;
        }
    }
    if (val === 'Yes' || val === 'Unsure') {
        const medNames = document.querySelectorAll('.current-med-name');
        let hasAnyMed = false;
        medNames.forEach(input => {
            if (input.value && input.value.trim()) hasAnyMed = true;
        });
        if (!hasAnyMed) {
            const modal = document.getElementById('currentMedsReminderModal');
            if (modal) {
                modal.style.display = 'flex';
                return false;
            }
        }
    }
    return true;
};

// Section 6: Check if "No" selected needs confirmation 
window.checkSection6NoConfirmation = function () {
    const val = document.querySelector('input[name="pastPsychMedsScreen"]:checked')?.value;
    if (val === 'No') {
        const modal = document.getElementById('pastMedsConfirmationModal');
        if (modal) {
            modal.style.display = 'flex';
            return false;
        }
    }
    return true;
};

// Section 5B/6 confirmation callbacks
window.confirmCurrentMedsNo = function () {
    // Confirmed - just allow proceed
};
window.confirmCurrentMedsBlank = function () {
    // Confirmed - just allow proceed
};
window.confirmPastMedsNo = function () {
    // Confirmed - just allow proceed
};

// Section 15: Show details field when ANY cognitive question is Yes
window.showCogDetails = function () {
    const memory = document.querySelector('input[name="cogMemory"][value="Yes"]')?.checked;
    const conc = document.querySelector('input[name="cogConcentrating"][value="Yes"]')?.checked;
    const conf = document.querySelector('input[name="cogConfusion"][value="Yes"]')?.checked;
    const perc = document.querySelector('input[name="cogPerceptions"][value="Yes"]')?.checked;
    const neuro = document.querySelector('input[name="cogHistoryNeuro"][value="Yes"]')?.checked;
    const grp = document.getElementById('neuroHistoryDetailsGroup');
    if (grp) {
        grp.style.display = (memory || conc || conf || perc || neuro) ? 'block' : 'none';
    }
};

// Trauma timing toggle: show timing question when ANY trauma type is checked (except "No trauma history")
document.addEventListener('change', function (e) {
    if (e.target.name === 'traumaHistory') {
        const timingGroup = document.getElementById('traumaTimingGroup');
        if (!timingGroup) return;
        const checkedTraumas = document.querySelectorAll('input[name="traumaHistory"]:checked');
        let hasTrauma = false;
        checkedTraumas.forEach(cb => {
            if (cb.value !== 'No trauma history') hasTrauma = true;
        });
        timingGroup.style.display = hasTrauma ? 'block' : 'none';
    }
});

// "None of the above" handler for PTSD symptom categories 
window.handleNoneOption = window.handleNoneOption || function (noneCb) {
    if (noneCb.checked) {
        const group = noneCb.closest('.options-list');
        group.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (cb !== noneCb) cb.checked = false;
        });
    }
};
