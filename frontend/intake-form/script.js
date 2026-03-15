document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('intakeForm');
    const sections = Array.from(document.querySelectorAll('.form-section'));
    const btnNext = document.getElementById('btnNext');
    const btnPrev = document.getElementById('btnPrev');
    const btnSubmit = document.getElementById('btnSubmit');
    const progressBar = document.getElementById('progressBar');
    
    let currentSectionIndex = 0;

    // Initialize visibility
    updateView();

    btnNext.addEventListener('click', () => {
        if (validateSection(currentSectionIndex)) {
            if (currentSectionIndex < sections.length - 1) {
                currentSectionIndex++;
                updateView();
                window.scrollTo(0, 0);
            }
        }
    });

    btnPrev.addEventListener('click', () => {
        if (currentSectionIndex > 0) {
            currentSectionIndex--;
            updateView();
            window.scrollTo(0, 0);
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (validateSection(currentSectionIndex)) {
            // Run final form validations here (e.g. consistency checks)
            if (runConsistencyChecks()) {
                alert('Form submitted successfully. Information would be securely transmitted.');
                // In a real environment, submit form via fetch or native form submission
            }
        }
    });

    function updateView() {
        sections.forEach((sec, idx) => {
            sec.classList.toggle('active', idx === currentSectionIndex);
        });

        btnPrev.style.display = currentSectionIndex === 0 ? 'none' : 'block';
        
        if (currentSectionIndex === sections.length - 1) {
            btnNext.style.display = 'none';
            btnSubmit.style.display = 'block';
        } else {
            btnNext.style.display = 'block';
            btnSubmit.style.display = 'none';
        }

        const progressPercent = ((currentSectionIndex + 1) / sections.length) * 100;
        progressBar.style.width = `${progressPercent}%`;
    }

    function validateSection(index) {
        let isValid = true;
        const section = sections[index];
        const requiredElements = section.querySelectorAll('[required]');

        // Clear all previous error states
        section.querySelectorAll('.validation-error').forEach(el => el.style.display = 'none');
        section.querySelectorAll('.error-input').forEach(el => el.classList.remove('error-input'));

        // Basic HTML5 validation + custom visual cues
        requiredElements.forEach(el => {
            // Skip fields that are hidden by conditional logic
            if (el.closest('.conditional-field') && el.closest('.conditional-field').style.display === 'none') {
                return; 
            }
            if (!el.checkValidity()) {
                isValid = false;
                el.classList.add('error-input');
                let errorMsg = el.closest('.field-group').querySelector('.validation-error');
                if (!errorMsg) {
                    errorMsg = document.createElement('div');
                    errorMsg.className = 'validation-error';
                    errorMsg.innerText = 'This field is required.';
                    el.closest('.field-group').appendChild(errorMsg);
                }
                errorMsg.style.display = 'block';
            }
        });

        return isValid;
    }

    // CONDITIONAL LOGIC HANDLER
    form.addEventListener('change', (e) => {
        handleConditionalLogic(e.target);
        updateRiskLevel();
    });

    function handleConditionalLogic(target) {
        if (target.type === 'radio') {
            const name = target.name;
            const ifYesBox = document.getElementById(name + '_details');
            if (ifYesBox) {
                if (target.value === 'Yes' || target.value === 'yes') {
                    ifYesBox.style.display = 'block';
                    const input = ifYesBox.querySelector('textarea, input');
                    if (input) input.setAttribute('required', 'true');
                } else {
                    ifYesBox.style.display = 'none';
                    const input = ifYesBox.querySelector('textarea, input');
                    if (input) {
                        input.removeAttribute('required');
                        input.value = '';
                    }
                }
            }
        }

        if (target.name === 'sexAssignedAtBirth') {
            const perinatalSectionWrapper = document.getElementById('perinatalSectionWrapper');
            if (target.value === 'Female' || target.value === 'Intersex') {
                perinatalSectionWrapper.style.display = 'block';
            } else {
                perinatalSectionWrapper.style.display = 'none';
            }
        }
    }

    function updateRiskLevel() {
        const suicidalThoughtsEl = document.querySelector('input[name="suicidalThoughts"]:checked');
        const currentThoughtsEl = document.querySelector('input[name="currentThoughts"]:checked');
        
        let riskLevel = 'none';

        if (suicidalThoughtsEl && suicidalThoughtsEl.value === 'Yes — currently') {
            if (currentThoughtsEl) {
                if (currentThoughtsEl.value === 'Passive thoughts') {
                    riskLevel = 'passive';
                } else if (currentThoughtsEl.value === 'Active thoughts of suicide but without a plan and intent') {
                    riskLevel = 'active_no_plan';
                } else if (currentThoughtsEl.value === 'Active thoughts of suicide with a plan or intent') {
                    riskLevel = 'active_plan';
                }
            }
        }

        const supportResources = document.getElementById('supportResourcesAlert');
        const meansSafetySection = document.getElementById('meansSafetySection');

        if (riskLevel === 'active_no_plan' || riskLevel === 'active_plan') {
            if (supportResources) supportResources.style.display = 'block';
            if (meansSafetySection) meansSafetySection.style.display = 'block';
        } else {
            if (supportResources) supportResources.style.display = 'none';
            if (meansSafetySection) meansSafetySection.style.display = 'none';
        }
    }

    function runConsistencyChecks() {
        const dsmCheckboxes = document.querySelectorAll('.dsm-screening-checkbox');
        if (dsmCheckboxes.length > 0) {
            let total = dsmCheckboxes.length;
            let checked = document.querySelectorAll('.dsm-screening-checkbox:checked').length;
            if (checked === 0) { 
                const confirmSubmit = confirm('You indicated few or no symptoms across most of the screening questions. These questions ask about experiences at any point in your life. \n\nIf your responses are accurate, you may continue, otherwise you can review your answers.');
                if (!confirmSubmit) return false;
            }
        }
        return true;
    }
});