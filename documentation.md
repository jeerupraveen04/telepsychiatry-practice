# ThriveLine Psychiatric Intake Form Documentation

This folder contains the complete HTML, CSS, JavaScript, and Node.js implementation of the ThriveLine Intake Questionnaire.

## Files Included

### Frontend (Patient Form)
1. **`index.html`**: The main structure. It contains all 26 sections exactly mirroring the clinical PDF, complete with corresponding wording and logical groupings. It also includes the persistent sidebar progress tracker.
2. **`styles.css`**: The modern, responsive CSS stylesheet tailored for optimal mobile usability, featuring gradients, clean fonts, large touch targets, and beautiful micro-interactions.
3. **`script.js`**: Drives the frontend validation, handles complex section skipping (e.g. bypassing Perinatal if Sex Assigned at Birth is Male), paginates the form via the sidebar, and dynamically sends form data to the backend.

### Backend (Node.js & PostgreSQL)
4. **`server.js`**: An Express server that exposes two endpoints (`/api/submit` for receiving data, and `/api/patients` for the doctor view). It persists the form into a PostgreSQL JSONB column securely.
5. **`.env`**: Contains the connection credentials for the Postgres database. **Please configure this file to match your local database settings before running the server.**
6. **`package.json`**: Specifies the dependencies (`express`, `pg`, `cors`, `dotenv`).

### Doctor Portal
7. **`doctor.html`**: A separate clinical dashboard where doctors can view form submissions.
8. **`doctor.js`**: Fetches the patient list from the backend and elegantly renders the verbose clinical JSON data dynamically on the screen.

---

## Form Structure & Pagination
The form is divided into `div` containers with the class `.form-section`. The JavaScript builds out the `aside` sidebar dynamically based on these sections. It only allows the user to progress forward if all visible `[required]` fields in the active `<form-section>` are completely filled out. 

## Conditional Logic
- Many underlying elements are toggled inline or via logic in `script.js`.
- If a patient answers "Unsure" or "No", the dynamically tracked section remains hidden, preventing clutter and keeping the interface clean.
- The `JSONB` document architecture ensures that whatever fields the patient leaves blank or conditional branches they avoid are simply omitted from the final database record.

## Running the Full Stack Setup
To run the server and test the integration yourself locally:

1. Ensure you have Node.js and PostgreSQL installed.
2. In PostgreSQL, create a database named `telepsychiatry` (or match whatever name you put in `.env`).
```bash
createdb telepsychiatry
```
3. Open a terminal in the folder and install the dependencies:
```bash
npm install
```
4. Start the server (which will automatically create the required database tables):
```bash
node server.js
```
5. Open your browser and navigate to `http://localhost:3000/frontend/index.html` to act as the patient.
6. Submit the form, then navigate to `http://localhost:3000/frontend/doctor.html` to see the resulting intake data formatted seamlessly in the doctor portal.
