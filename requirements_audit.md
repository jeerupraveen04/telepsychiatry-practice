# New Requirements Audit Report

> [!IMPORTANT]
> **11 items** are NOT implemented or only partially implemented. **12 items** are fully implemented.

---

## Summary Table

| # | Requirement Area | Status |
|---|-----------------|--------|
| 1 | Phone/Fax fields optional | ✅ Implemented |
| 2 | Date fields — "Date unknown" checkbox | ❌ Not Implemented |
| 3 | Medication dose labels "(if known)" | ✅ Implemented |
| 4 | Final Review Page before submission | ✅ Implemented |
| 5B | Current Psych Meds — screening question (Yes/No/Unsure) | ✅ Implemented |
| 5B | Current Psych Meds — helper text | ✅ Implemented |
| 5B | Logic 1 — "No" confirmation modal | ❌ Not Implemented |
| 5B | Logic 2 — blank fields reminder | ❌ Not Implemented |
| 6 | Past Psych Meds — screening question & helper text | ✅ Implemented |
| 6 | Logic 1 — "No" confirmation modal | ❌ Not Implemented |
| 6 | Logic 2 — blank fields reminder (HTML modal) | ✅ Implemented |
| 6 | Treatment length / reason stopped / side effects fields | ✅ Implemented |
| 8 | Remove pre-screens for Depression, OCD, OCPD, Borderline, ADHD, Autism | ❌ Not Implemented |
| 8 | Add "None of the above" to checklists w/o pre-screen | ⚠️ Partial |
| 8 | Pre-screen options include "Yes — but only under the influence…" | ❌ Not Implemented |
| 8 | Bipolar special logic (either pre-screen triggers checklist) | ⚠️ Needs Verification |
| 8 | PTSD — replace pre-screen question with new wording | ❌ Not Implemented |
| 8 | PTSD — remove symptom-category pre-screen questions | ❌ Not Implemented |
| 8 | PTSD — add "None of the above" to each symptom list | ❌ Not Implemented |
| 8 | Duplicate "Attention & Self-Image Patterns" section | ❌ Not Removed |
| 8 | Screening Review Reminder (85% negative logic) | ✅ Implemented |
| 9 | Remove "Prefer not to answer" from trauma checklist | ❌ Not Implemented |
| 9 | Replace trauma timing question ("When did the trauma occur?") | ❌ Not Implemented |
| 10 | Self-harm conditional details text box | ✅ Implemented |
| 11 | Kratom — past/present/details | ✅ Implemented |
| 11 | Opioids — past/present/details | ✅ Implemented |
| 11 | Stimulants — past/present/details | ✅ Implemented |
| 12 | OUD treatment — includes past treatment option | ✅ Implemented |
| 13 | Sex at birth — remove "My information is not captured" | ❌ Not Implemented |
| 13 | Non-psych medication fields required | ⚠️ Needs Verification |
| 14 | Perinatal — contraception logic fix | ⚠️ Needs Verification |
| 15 | Cognitive/neuro details — show on ANY "Yes" | ❌ Not Implemented |
| 17 | Remove duplicate "Family history of substance use disorder" question | ✅ Implemented |
| 18 | Childhood question — updated answer options | ✅ Implemented |

---

## Detailed Findings

### ❌ 1. Date Fields — "Date unknown" Checkbox (Req #2)
No `Date unknown` checkbox found anywhere in the form. Date fields for hospitalizations, labs, visits, etc., do not have an option to mark the date as unknown.

### ❌ 2. Section 5B — Medication Confirmation Logic (Req Logic 1 & 2)
- **Logic 1**: When patient selects "No" to currently taking meds, there is **no confirmation dialog** reminding them to check if they receive meds from a PCP.
- **Logic 2**: When patient selects "Yes/Unsure" but leaves medication fields blank, there is **no reminder** prompting them to list medications.
- The `toggleCurrentMedsList` function referenced in the HTML is **not defined** in [script.js](file:///home/praveen/Desktop/TEAMAST/telepsychiatry%20practice/frontend/script.js).

### ❌ 3. Section 6 — "No" Confirmation Modal (Req Logic 1)
No "Medication History Confirmation" modal exists for when the patient selects "No" to past medications. (The Logic 2 "Medication History Reminder" modal IS implemented.)

### ❌ 4. Section 8 — Pre-screen Questions Not Removed
Depression still has a pre-screen question (`screenMDD`, [line 1506](file:///home/praveen/Desktop/TEAMAST/telepsychiatry%20practice/frontend/index.html#L1506)). Per requirement, Depression, OCD, OCPD, Borderline, ADHD, and Autism should **not** have pre-screen questions — their symptom checklists should show directly with a "None of the above" option.

### ❌ 5. Section 8 — Pre-screen Options Missing "Yes — but only under the influence…"
The retained pre-screens (Bipolar, GAD, Panic, Social Anxiety, PTSD, etc.) currently use:
- Yes / No / "Yes — but only while using substances…"

The requirement specifies the wording should be:
- **"Yes — but only under the influence of alcohol, cannabis, or other substances"**

Additionally, "Unsure" is required as a 4th option but many pre-screens currently only have 3 options.

### ❌ 6. PTSD Screening — Multiple Issues
- **Pre-screen question** still reads: *"Have you experienced or witnessed an event involving actual or threatened death…"* → Should be: *"Have you experienced something in your life that continues to cause distressing memories, avoidance, nightmares, or emotional reactions?"*
- **Symptom-category pre-screen questions** (e.g., "Have you experienced intrusion symptoms?" at [line 2097](file:///home/praveen/Desktop/TEAMAST/telepsychiatry%20practice/frontend/index.html#L2097)) **still exist** — should be removed. Symptom lists should appear directly.
- **"None of the above"** is missing from each PTSD symptom checklist.
- **"Unsure" triggers hide** instead of show ([line 2088](file:///home/praveen/Desktop/TEAMAST/telepsychiatry%20practice/frontend/index.html#L2088)).

### ❌ 7. Duplicate "Attention & Self-Image Patterns"
Section appears twice at [line 3243](file:///home/praveen/Desktop/TEAMAST/telepsychiatry%20practice/frontend/index.html#L3243) ("5. Attention & Self-Image Patterns") and [line 3259](file:///home/praveen/Desktop/TEAMAST/telepsychiatry%20practice/frontend/index.html#L3259) ("6. Attention & Self-Image Patterns"). Only one should remain.

### ❌ 8. Trauma History — "Prefer not to answer" Not Removed
"Prefer not to answer" is still a selectable option in the trauma checklist at [line 3420](file:///home/praveen/Desktop/TEAMAST/telepsychiatry%20practice/frontend/index.html#L3420). It should be removed.

### ❌ 9. Trauma Timing Question Not Updated
The trauma timing question *"When did the trauma occur? (Select all that apply)"* with options (Early childhood, Childhood 6–12, Adolescence 13–17, etc.) is **completely missing**.

### ❌ 10. Section 13 — "My information is not captured" Still Present
At [line 4336](file:///home/praveen/Desktop/TEAMAST/telepsychiatry%20practice/frontend/index.html#L4336), the sex-at-birth question still includes *"My information is not captured by these options"*. Per requirement, only Female, Male, Intersex should remain.

### ❌ 11. Section 15 — Conditional Logic for Details Field
The details text field at [line 5131](file:///home/praveen/Desktop/TEAMAST/telepsychiatry%20practice/frontend/index.html#L5131) currently only shows when "History of seizures, TBI, stroke = Yes". Per requirement, it should show when **ANY** of the 5 cognitive questions (Memory, Concentration, Confusion, Unusual perceptions, Seizures/TBI/Stroke) is answered "Yes".
