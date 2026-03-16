document.addEventListener('DOMContentLoaded', async () => {
    const patientListContainer = document.getElementById('patientListContainer');
    const patientViewer = document.getElementById('patientViewer');
    
    // Fetch patients
    try {
        const response = await fetch('/api/patients');
        if (!response.ok) throw new Error('Failed to fetch patients');
        const patients = await response.json();
        // Cache the fetched patients so we can print all later
        window.__patientsList = patients || [];
        
        if (patients.length === 0) {
            patientListContainer.innerHTML = '<div style="padding:1.5rem;color:var(--text-secondary);text-align:center;">No patients found.</div>';
            return;
        }
        
            patientListContainer.innerHTML = '';
            patients.forEach(p => {
            const dateStr = new Date(p.submitted_at).toLocaleString();
            
            const card = document.createElement('div');
            card.className = 'patient-card';
            card.innerHTML = `
                <div class="patient-name">${escapeHTML(p.name)}</div>
                <div class="patient-meta">${dateStr}</div>
                <div class="patient-meta" style="margin-top:0.2rem;">${escapeHTML(p.email || 'No email')} | ${escapeHTML(p.phone || 'No phone')}</div>
            `;
            
            card.addEventListener('click', () => {
                // remove active class from all
                document.querySelectorAll('.patient-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                loadPatientDetails(p.id, p);
            });
            
            patientListContainer.appendChild(card);
        });
        
    } catch (err) {
        console.error(err);
        patientListContainer.innerHTML = '<div style="padding:1.5rem;color:var(--error-color);">Error loading patients. Check server connection.</div>';
    }
    
    // We cache the form template so we don't fetch it every time
    let cachedFormHtml = null;
    // currently selected patient (summary + fetched form data)
    let currentPatient = null;

    async function getFormTemplate() {
        if (cachedFormHtml) return cachedFormHtml;
        try {
            const resp = await fetch('index.html');
            const text = await resp.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const formObj = doc.getElementById('intakeForm');
            if (formObj) {
                cachedFormHtml = formObj.innerHTML;
                return cachedFormHtml;
            }
        } catch (e) {
            console.error("Failed to load form template", e);
        }
        return null; // fallback
    }

    async function loadPatientDetails(id, summary) {
        patientViewer.innerHTML = '<div class="loading-spinner">Loading intake form template...</div>';
        
        try {
            const [patientRes, formTemplate] = await Promise.all([
                fetch(`/api/patients/${id}`),
                getFormTemplate()
            ]);
            
            if (!patientRes.ok) throw new Error('Error fetching specific patient data');
            const data = await patientRes.json();
            const formData = data.form_data;
            const submitDate = new Date(summary.submitted_at).toLocaleString();
            // store currently selected patient (summary + fetched form data)
            currentPatient = { summary, formData, submitDate };
            
            let headerHtml = `
                <div class="viewer-header">
                    <div>
                        <h1 style="margin-bottom:0.5rem; color:var(--primary-color);">${escapeHTML(summary.name)}</h1>
                        <div style="color:var(--text-secondary);">Submitted: ${submitDate}</div>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center">
                        <button class="btn btn-secondary" onclick="window.printCurrentPatient()">Print / Save PDF</button>
                        <button class="btn btn-secondary" onclick="window.printAllPatients()">Print All</button>
                    </div>
                </div>
            `;
            
            // If we successfully fetched the index.html form template
            if (formTemplate) {
                patientViewer.innerHTML = headerHtml + `<div class="form-wrapper" id="readonlyFormWrapper">${formTemplate}</div>`;
                
                const wrapper = document.getElementById('readonlyFormWrapper');
                
                // Show all sections at once for the doctor (no pagination)
                const sections = wrapper.querySelectorAll('.form-section');
                sections.forEach(sec => sec.style.display = 'block');
                
                // Remove navigation buttons and submit button
                const navButtons = wrapper.querySelector('.navigation-buttons');
                if (navButtons) navButtons.remove();
                
                // Remove any progress bars
                const progressContainer = wrapper.querySelector('.progress-container');
                if (progressContainer) progressContainer.remove();

                // Map data to fields
                Object.keys(formData).forEach(key => {
                    let val = formData[key];
                    if (val === null || val === undefined) return;
                    
                    // Could be an array of selections (checkboxes)
                    const isArray = Array.isArray(val);
                    const values = isArray ? val : [val];
                    
                    values.forEach(v => {
                        const strVal = v.toString();
                        // Find inputs by name and value (for radios/checkboxes)
                        const cbx = wrapper.querySelector(`input[name="${key}"][value="${strVal.replace(/"/g, '\\"')}"]`);
                        if (cbx && (cbx.type === 'radio' || cbx.type === 'checkbox')) {
                            cbx.checked = true;
                            // Trigger onclick if they have custom logic (e.g. showing "Other" textboxes)
                            if (cbx.onclick) {
                                try { cbx.onclick(); } catch(e){}
                            }
                        } else {
                            // Find standard inputs/textareas
                            const inp = wrapper.querySelector(`[name="${key}"]`);
                            if (inp && (inp.type !== 'radio' && inp.type !== 'checkbox')) {
                                inp.value = strVal;
                            }
                        }
                    });
                });
                
                // Force all conditional blocks to show if they have values (fallback if onclick didn't trigger)
                // Actually, the easiest way for a doctor review is just to expand conditional fields that have non-empty inputs
                const hiddenDivs = wrapper.querySelectorAll('div[style*="display: none"]');
                hiddenDivs.forEach(div => {
                   const inputsInDiv = div.querySelectorAll('input, select, textarea');
                   let hasValue = false;
                   inputsInDiv.forEach(inp => {
                       if (inp.type === 'radio' || inp.type === 'checkbox') {
                           if (inp.checked) hasValue = true;
                       } else if (inp.value && inp.value.trim() !== '') {
                           hasValue = true;
                       }
                   });
                   if (hasValue) {
                       div.style.display = 'block';
                   }
                });

                // Disable all inputs so doctor can't edit
                wrapper.querySelectorAll('input, select, textarea').forEach(el => {
                    el.readOnly = true;
                    if (el.type === 'radio' || el.type === 'checkbox') {
                        el.disabled = true; // readonly doesn't prevent radio/checkbox toggling
                    }
                });
                
            } else {
                // Fallback to simple key-value rendering if template failed
                let html = headerHtml;
                Object.keys(formData).forEach(key => {
                    const val = formData[key];
                    if (!val || val === '') return;
                    let displayVal = Array.isArray(val) ? val.map(v => `<div class="array-value">${escapeHTML(v)}</div>`).join('') : escapeHTML(val.toString());
                    const niceKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    html += `
                        <div class="data-grid">
                            <div class="data-key">${escapeHTML(niceKey)}</div>
                            <div class="data-value">${displayVal}</div>
                        </div>
                    `;
                });
                patientViewer.innerHTML = html;
            }
            
        } catch (err) {
            console.error(err);
            patientViewer.innerHTML = '<div style="padding:2rem;color:var(--error-color);">Error loading patient details.</div>';
        }
    }
    
    function escapeHTML(str) {
        return String(str).replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    // Print only the currently selected patient using the original form HTML/template.
    // This will include styles and scripts from index.html so conditional logic runs and layout matches.
    window.printCurrentPatient = async function() {
        if (!currentPatient) {
            alert('No patient selected to print.');
            return;
        }

        const { summary, formData, submitDate } = currentPatient;

        try {
            // Use the cached form innerHTML if available, else load it
            const formInner = await getFormTemplate();

            // Build an off-DOM wrapper and inject values
            const wrapper = document.createElement('div');
            wrapper.innerHTML = formInner || '';

            // Show all sections and remove navigation/progress
            wrapper.querySelectorAll('.form-section').forEach(sec => sec.style.display = 'block');
            const navButtons = wrapper.querySelector('.navigation-buttons'); if (navButtons) navButtons.remove();
            const progressContainer = wrapper.querySelector('.progress-container'); if (progressContainer) progressContainer.remove();

            // Inject values into cloned form
            Object.keys(formData || {}).forEach(key => {
                let val = formData[key];
                if (val === null || val === undefined) return;

                const isArray = Array.isArray(val);
                const values = isArray ? val : [val];

                values.forEach(v => {
                    const strVal = v.toString();
                    const cbx = wrapper.querySelector(`input[name="${key}"][value="${strVal.replace(/"/g, '\\"')}"]`);
                    if (cbx && (cbx.type === 'radio' || cbx.type === 'checkbox')) {
                        cbx.checked = true;
                        cbx.setAttribute('checked', 'checked');
                        if (cbx.onclick) { try { cbx.onclick(); } catch(e){} }
                    } else {
                        const inp = wrapper.querySelector(`[name="${key}"]`);
                        if (inp && (inp.type !== 'radio' && inp.type !== 'checkbox')) {
                            inp.value = strVal;
                            if (inp.tagName === 'TEXTAREA') inp.textContent = strVal;
                            else inp.setAttribute('value', strVal);
                        }
                    }
                });
            });

            // Expand conditionals that have values
            wrapper.querySelectorAll('div[style*="display: none"]').forEach(div => {
                const inputsInDiv = div.querySelectorAll('input, select, textarea');
                let hasValue = false;
                inputsInDiv.forEach(inp => {
                    if (inp.type === 'radio' || inp.type === 'checkbox') {
                        if (inp.checked) hasValue = true;
                    } else if ((inp.value && inp.value.toString().trim() !== '') || inp.textContent.trim() !== '') {
                        hasValue = true;
                    }
                });
                if (hasValue) div.style.display = 'block';
            });

            // Ensure inputs reflect state and are readonly/disabled
            wrapper.querySelectorAll('input, select, textarea').forEach(el => {
                if (el.type === 'radio' || el.type === 'checkbox') {
                    if (el.checked) el.setAttribute('checked', 'checked'); else el.removeAttribute('checked');
                    el.disabled = true;
                } else if (el.tagName === 'TEXTAREA') {
                    el.setAttribute('readonly', 'readonly');
                } else {
                    el.setAttribute('value', el.value || '');
                    el.setAttribute('readonly', 'readonly');
                }
            });

            // Prepare printable HTML: include base href so relative assets resolve, include styles and script,
            // add print-specific CSS (margins, page-breaks), and an inline script to force all sections visible after scripts run.
            const baseHref = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
            const headExtras = `
                <base href="${baseHref}">
                <link rel="stylesheet" href="styles.css">
                <style>
                    @page { margin: 18mm; }
                    @media print { .form-section { page-break-after: always; } .form-section:last-child { page-break-after: auto; } }
                    .form-wrapper{max-width:900px;margin:0 auto}
                </style>
            `;

            const scriptIncludes = `
                <script src="script.js"></script>
                <script>document.addEventListener('DOMContentLoaded', function(){ try { document.querySelectorAll('.form-section').forEach(s=>s.style.display='block'); const nav=document.querySelector('.navigation-buttons'); if(nav) nav.remove(); const prog=document.querySelector('.progress-container'); if(prog) prog.remove(); } catch(e){} });</script>
            `;

            const printableHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(summary.name || 'Patient Record')}</title>${headExtras}</head><body>` +
                `<div class="print-header" style="margin-bottom:16px;"><h1 style="margin:0">${escapeHTML(summary.name || 'Unknown')}</h1><div style="color:#666">${escapeHTML(submitDate || '')}</div></div>` +
                `<div class="form-wrapper">${wrapper.innerHTML}</div>` + scriptIncludes + `</body></html>`;

            const w = window.open('', '_blank');
            w.document.write(printableHtml);
            w.document.close();
            w.focus();
            setTimeout(() => { try { w.print(); } catch(e) { console.error(e); } }, 500);
        } catch (e) {
            console.error('Error preparing printable document for current patient', e);
            alert('Failed to generate printable document. Check console for details.');
        }
    };

    // Print all cached patients in a printable window. Exposed on window so header inline onclick works.
    window.printAllPatients = async function() {
        const patientsList = window.__patientsList || [];
        if (!patientsList.length) {
            alert('No patients to print.');
            return;
        }

        try {
            const fetches = patientsList.map(p => fetch(`/api/patients/${p.id}`).then(r => r.ok ? r.json() : null).catch(() => null));
            const allDetails = await Promise.all(fetches);

            // base and print styles
            const baseHref = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
            const headExtras = `
                <base href="${baseHref}">
                <link rel="stylesheet" href="styles.css">
                <style>@page{margin:18mm} @media print{.patient-section{page-break-after:always}.patient-section:last-child{page-break-after:auto}}</style>
            `;

            let html = `<!doctype html><html><head><meta charset="utf-8"><title>Patient Records</title>${headExtras}</head><body>`;

            allDetails.forEach((detail, idx) => {
                if (!detail) return;
                const summary = patientsList[idx] || {};
                const formData = detail.form_data || {};
                const submitDate = summary.submitted_at ? new Date(summary.submitted_at).toLocaleString() : '';

                html += `<div class="patient-section">`;
                html += `<div class="patient-header"><h2>${escapeHTML(summary.name || 'Unknown')}</h2><div>${escapeHTML(submitDate)}</div></div>`;

                Object.keys(formData).forEach(key => {
                    const val = formData[key];
                    if (val === null || val === undefined) return;
                    if (typeof val === 'string' && val.trim() === '') return;
                    let displayVal = '';
                    if (Array.isArray(val)) {
                        displayVal = val.map(v => `<span class="array-value">${escapeHTML(v)}</span>`).join('');
                    } else {
                        displayVal = escapeHTML(String(val));
                    }
                    const niceKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                    html += `<div class="data-grid"><div class="data-key">${escapeHTML(niceKey)}</div><div class="data-value">${displayVal}</div></div>`;
                });

                html += `</div>`; // patient-section
            });

            html += `</body></html>`;

            const w = window.open('', '_blank');
            w.document.write(html);
            w.document.close();
            w.focus();
            setTimeout(() => { try { w.print(); } catch(e) { console.error(e); } }, 400);
        } catch (e) {
            console.error('Error preparing printable document', e);
            alert('Failed to generate printable document. Check console for details.');
        }
    };
});
