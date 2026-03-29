Smart Pharmacy Management System (Dev Version)
Project Status: Development & Local Integration
This repository contains the full-stack source code for the Smart Pharmacy Management System. 
The project is currently optimized for Local Development across the team, with a planned migration to Azure Cloud Services for the final production release.

Tech Stack & Environment
- Frontend: React.js (Node.js v18+)
- Backend: .NET 8 Web API
- Database: SQL Server (LocalDB / MSSQLLocalDB)
- API Protocol: RESTful JSON with Case-Resilient Mapping

Core Features (Phase 1 Implementation)
1. Predictive Inventory Engine
   A smart logic layer that monitors medication stability. It automatically identifies "At-Risk" stock (expiring within 30 days) and suggests dynamic discount tiers ($10\%$, $20\%$, $40\%$) to ensure inventory velocity and minimize waste.
2. Clinical Interaction Guard
   A real-time safety interceptor. Before a sale is finalized, the system cross-references the active ingredients of all items in the cart via the backend clinical database. If a contraindication is found, a high-priority safety alert is triggered.
3. Role-Based Workspace (RBAC)
   Staff/Pharmacist: Full access to inventory CRUD, supplier procurement, and patient sales history.
   Client: Access to the "Smart Store" view, personal order tracking, and interaction-safe browsing.
4. Integrated Analytics
   Trending Products: Real-time calculation of top-selling medications.
   Stock Health: Automatic visual cues for low-stock items and expiring batches.

Future Roadmap (Production & Expansion)

Phase 2: Cloud Integration (Upcoming)
Karim Mostafa: Cloud Infrastructure & DevOps Lead 
* Responsibilities:
[ 1] Data Migration: Transitioning from LocalDB to Azure SQL Database for 24/7 availability.
[2 ] API Hosting: Deploying the .NET 8 Backend to Azure App Service.
[ 3] Static Web Hosting: Hosting the React Frontend on Azure Static Web Apps.
[4 ] CI/CD Pipeline: Setting up GitHub Actions to automatically test code every time the team pushes.

Phase 3 Roadmap: 
E-Commerce & AnalyticsFinancial & Order Logic 
(Led by Moheb R.)
[ 1] Dynamic Order State Machine: Tracking orders from Pending $\rightarrow$ Preparing $\rightarrow$ Delivered.
[2 ] Inventory Rollback System: Automated stock restoration for cancelled or failed transactions.
[ 3] Geospatial Shipping Engine: Location-based fee calculation for various Cairo districts.
[4 ] Digital Payment Bridge: Secure API integration for online transaction tokens.

Phase 4 Roadmap: 
Advanced Analytics 
(Led by Abanoub M.)
Executive Pharmacist Dashboard
[ 1] Inventory Velocity Analytics: Interactive Bar Charts (Chart.js/Recharts) visualizing top-selling medications to optimize re-ordering cycles.
[2 ] Expiry Risk Heatmap: Donut Charts categorizing stock by shelf-life status (Safe, Warning, Critical) linked to the Smart Pricing Engine.
[ 3] Financial KPI Cards: High-level summary of Daily/Monthly Sales, Predicted Profit Margins, and "Waste Metrics" (Revenue lost to expired stock).

Phase 4 Roadmap: 
Advanced Clinical Intelligence (Led by Mina S.)
1. Multi-Ingredient Interaction Matrix (N-Tier)
 Unlike standard systems that check drug-to-drug, this engine performs a deep scan of active ingredients.
 - Recursive Scanning: Checks interactions for $N$ number of drugs in a single cart.
 - Component-Level Safety: If a drug contains three ingredients (e.g., Cold & Flu medicine), the engine cross-references each individual component against the patient's current medication profile.
2. Smart Alternative & Substitution Engine
 A tiered matching algorithm to provide pharmacists with safe alternatives when a specific brand is out of stock:
 - Level 1 (Bio-Equivalent): Identical active ingredients and concentration (Generic vs. Brand).
 - Level 2 (Therapeutic Match): Same primary ingredient with minor secondary variations.
 - Level 3 (Class Match): Different chemical structure but same therapeutic class (e.g., switching between different NSAIDs).
3. Relational Integrity & Performance
 Implementation of SQL Indexing for high-speed ingredient lookups.
 - Many-to-Many Mapping: Managing the complex relationship between Products and Active_Ingredients to ensure zero data redundancy.

Team Collaboration Setup
1. Clone the Repo: git clone https://github.com/EsraaMIbrahim/Smart-Pharmacy-Management-System.git
2. Database Setup: Run the provided SQL migration scripts in your local SQL Server Management Studio (SSMS).
3. Connection Strings: The appsettings.json is currently configured for (localdb)\\mssqllocaldb.
4. Frontend Sync: Run npm install inside the pharmacy-frontend folder to sync all professional UI libraries.

Academic Supervision
Project Supervisor: Dr. Sara Saad

Leadership & Contributions
Project Lead: Esraa M. Ibrahim
Collaborators: A. Mokhles, K. Mostafa, M. Shenouda, M. Rofail, S. Saadeldeen.
