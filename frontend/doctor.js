document.addEventListener('DOMContentLoaded', async () => {
    const patientListContainer = document.getElementById('patientListContainer');
    const patientViewer = document.getElementById('patientViewer');
    
    // Fetch patients
    try {
        const response = await fetch('/api/patients');
        if (!response.ok) throw new Error('Failed to fetch patients');
        const patients = await response.json();
        
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
            
            let headerHtml = `
                <div class="viewer-header">
                    <div>
                        <h1 style="margin-bottom:0.5rem; color:var(--primary-color);">${escapeHTML(summary.name)}</h1>
                        <div style="color:var(--text-secondary);">Submitted: ${submitDate}</div>
                    </div>
                    <button class="btn btn-secondary" onclick="window.print()">Print / Save PDF</button>
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
});
