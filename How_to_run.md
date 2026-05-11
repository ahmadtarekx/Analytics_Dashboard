# 📊 AnalyticOS — Analytics Dashboard Platform

> An AI-powered business intelligence dashboard that unifies Sales, HR, Inventory, and Finance KPIs with natural language querying, automated reporting, and Python-based analytics.

---

## 👥 Team

| Name | Role |
|------|------|
| Ahmad Tarek Ahmad | Data Analysis & Database |
| Mo'men Mohsen Mashhout | Data Analysis & Database |
| Mohamed Amr Abdelfattah | AI Integration |
| Mohamed Maher Abdelfattah | Backend Development |
| Khaled Emad Ezz-Eldin | Frontend Development |

---

## 📋 Prerequisites

Make sure you have **all of the following installed** before proceeding:

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | v18 or higher | https://nodejs.org |
| **MySQL Workbench** | 8.0 or higher | https://dev.mysql.com/downloads/workbench |
| **Python** | 3.10 or higher | https://www.python.org/downloads |
| **Git** | Latest | https://git-scm.com |

---

## 🚀 Setup & Installation

### Step 1 — Clone the Repository

```bash
git clone 
cd 
```

---

### Step 2 — Set Up the Database (MySQL Workbench)

1. Open **MySQL Workbench**
2. Connect to your local MySQL server (default: `localhost:3306`, user: `root`)
3. In the top menu go to: **Server → Data Import**
4. Select **"Import from Self-Contained File"**
5. Click the `...` browse button and select the file:
   ```
   /database/mydb.sql
   ```
6. Under **"Adminstration"**, click **"Data Import/Restore"** and create a schema named:
   ```
   mydb
   ```
7. Click **"Start Import"** at the bottom right
8. Wait for the import to complete — you should see a success message in the log

> ✅ Your database is now ready with all tables and seed data.

---

### Step 3 — Install Backend Node Modules

Navigate to the Backend folder and install all dependencies:

```bash
cd Backend
npm install
```

This will install all required packages including:

| Package | Purpose |
|---------|---------|
| `express` | Web server & REST API framework |
| `mysql2` | MySQL database driver |
| `bcrypt` | Password hashing |
| `dotenv` | Environment variable loader |
| `cors` | Cross-origin request handling |
| `nodemailer` | Automated email dispatch |
| `nodemon` | Auto-restart server on file changes (dev) |
| `body-parser` | Parse incoming JSON request bodies |
| `node-fetch` | HTTP requests from server |
| `sql-escaper` | SQL injection prevention |
| `@vitalets/google-translate-api` | Translation support |
| `@types/node` | Node.js type definitions |

> All other packages in `node_modules` are installed automatically as dependencies of the above.

---

### Step 4 — Install Frontend Node Modules

Navigate to the Frontend folder and install all dependencies:

```bash
cd Frontend
npm install
```

This will install all required packages including:


> All other packages in `node_modules` are installed automatically as dependencies of the above.

---

### Step 5 — Configure the `.env` File

In the `Backend/` folder, open the `.env` file and fill in your values:

```env
# ─── Server ───────────────────────────────
PORT=3000

# ─── Database ─────────────────────────────
DB_HOST=localhost
DB_USER=root
DB_PASS=                        # ← Put your MySQL root password here (leave empty if none)
DB_NAME=mydb

# ─── Groq AI ──────────────────────────────
GROQ_API_KEY=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                   # ← Put your Groq API key here

# ─── Email (for automated reports) ────────
IT_EMAIL=it.entreprisex@gmail.com                       # ← Put the sender Gmail address here
IT_EMAIL_PASS=eeme uhuh qdpg mslp                  # ← Put the Gmail App Password here (not your regular password)

# ─── Python Analytics Path ────────────────
DATA_ANALYSIS_PATH=             # ← See Step 5 below
```


### Step 6 — Update File Paths in the Project

The project uses absolute paths for the Python analytics scripts. You need to update these to match **your machine**.

#### 6a. In the `.env` file:

Set `DATA_ANALYSIS_PATH` to the full path of the `Data_Analysis` folder on your machine:

**Windows example:**
```
DATA_ANALYSIS_PATH=C:\Users\YourName\Desktop\COMP_Graduation_Project\Data_Analysis
```

**Mac/Linux example:**
```
DATA_ANALYSIS_PATH=/home/yourname/COMP_Graduation_Project/Data_Analysis
```

#### 6b. In the Controllers:

Open each controller file that calls Python scripts (located in `Backend/controllers/`) and check for any hardcoded paths like:

```javascript
// ❌ Old hardcoded path — change this
const scriptPath = "C:\\Users\\moham\\Desktop\\COMP_Graduation_Project\\Data_Analysis\\script.py";

// ✅ Replace with environment variable
// do the samne as step 6A
```

> **Search tip:** In VS Code, press `Ctrl+Shift+F` (or `Cmd+Shift+F` on Mac) and search for `C:\\Users\\moham` to find all hardcoded paths that need replacing.

---

### Step 7 — Install Python Dependencies

```bash
pip install pandas plotly sqlalchemy python-dotenv
```

---

### Step 8 — Run the Application

From inside the project folder:

// you will find the run_project.bat run it and then take the local link 



## 🔐 Test Accounts

Use the following accounts to log in and explore the platform:



Manager {
   
1    mahmoud.ibrahim@gmail.com         Dark909!
2    nour.soliman@gmail.com            Lite111*
3    esraa.nabil@gmail.com             Cool222&
4    ayman.metwally@gmail.com         Warm333#
5       malak.ezzat@gmail.com            Cold444@
}

Admin {
mohamed.ezzat@gmail.com             Smart77!
salma.mansour@gmail.com           Bold404#
}

Employees {
1 ,      nader.mahdi@gmail.com,             King121#
2,       habiba.shawky@gmail.com,            Side666!
3,      seif.radwan@gmail.com,               Shut323$
4,       nader.metwally@gmail.com,              Fast878!
5,       basma.helmy@gmail.com,             Short40$
}

Leaders(only in sales) (2 accounts are given for testing but there are 10 in total) { 
         ahmed.galal@gmail.com,              Pass123#
         mazen.fathy@gmail.com,             Fast771@
}
---

## 📁 Project Structure

```
COMP_Graduation_Project/
├── Backend/
│   ├── controllers/        ← Route handler logic
│   ├── routes/             ← Express route definitions
│   ├── middleware/         ← Auth & role guards
│   ├── models/             ← Database query functions
│   ├── server.js           ← App entry point
│   ├── .env                ← Environment config (never commit this)
│   └── package.json        ← Node dependencies
│
├── Frontend/
│   ├── src/
│   │   ├── components/     ← Reusable UI components
│   │   ├── pages/          ← Dashboard, Login, AI Chat, etc.
│   │   └── services/       ← Axios API calls
│   └── package.json
│
├── Data_Analysis/
│   ├── forecast.py         ← Sales/stock forecasting
│   ├── anomaly.py          ← Outlier detection
│   ├── trends.py           ← Trend chart generation
│   └── requirements.txt    ← Python dependencies
│
└── database/
    └── analyticos_db.sql   ← Full database dump for import
```

---

## 🐛 Common Issues

| Problem | Fix |
|---------|-----|
| `Error: connect ECONNREFUSED 127.0.0.1:3306` | MySQL is not running — open MySQL Workbench and start the server |
| `Access denied for user 'root'` | Wrong password in `.env` → double-check `DB_PASS` |
| `Cannot find module 'express'` | Run `npm install` inside the `Backend/` folder |
| `Python not found` | Make sure Python is installed and added to your system PATH |
| `GROQ_API_KEY missing` | Add your Groq API key to the `.env` file |
| Port 3000 already in use | Change `PORT=3001` in `.env` and restart |

---

