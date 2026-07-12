# TransitOps

Centralized transport-operations platform: vehicle registry, driver management,
trip dispatching, maintenance workflow, fuel & expense tracking, reports/ROI,
a rule-based AI insights engine, and a hash-chained audit ledger.

## 1. Prerequisites

- Node.js 18+
- A running MongoDB instance — local (`mongod`) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

## 2. Setup

```bash
cd transitops
npm install
cp .env.example .env
```

Edit `.env`:

```
MONGODB_URI=mongodb://127.0.0.1:27017/transitops   # or your Atlas connection string
JWT_SECRET=some_long_random_string
PORT=5000
```

## 3. Run

```bash
npm start          # production
npm run dev         # auto-restart on changes (requires devDependency nodemon, already declared)
```

Open **http://localhost:5000** — the Express server serves both the API (`/api/...`) and the web app.

On first boot the server creates a genesis block for the audit ledger automatically; no seed data is required.

## 4. Using the app — feature checklist

| Area | How to verify |
|---|---|
| **Auth + RBAC** | Register 4 accounts, one per role (Fleet Manager, Driver/Dispatcher, Safety Officer, Financial Analyst). Vehicle/driver create-and-manage actions are restricted by role on the server, so logging in as `Driver` and trying to register a vehicle will be rejected even if someone bypasses the UI. |
| **Dashboard** | KPIs update live. Use the Type / Status / Region filters above the KPI grid to scope the dashboard to a subset of the fleet (spec 3.2); "Reset" clears them. |
| **Vehicles** | Register a vehicle (unique reg. number enforced both client- and server-side). Search, filter by status, and click any column header to sort. "Retire" removes it from dispatch pools. |
| **Drivers** | Add a driver. Suspend/Reinstate and Off Duty/On Duty toggles are available per row; suspended or expired-license drivers are blocked from trip assignment. |
| **Trips** | Create a Draft trip (vehicle/driver dropdowns only list eligible, Available options). Dispatch it — vehicle & driver flip to "On Trip". Complete it with final odometer/fuel/revenue — both flip back to Available and the vehicle's odometer updates. Cancel is available from Draft or Dispatched. |
| **Maintenance** | Opening a record immediately sets the vehicle to "In Shop" and removes it from trip/dispatch selection. Closing it restores "Available" (unless the vehicle was separately retired). |
| **Fuel & Expenses** | Log fuel (liters/cost) and expenses (toll/fine/parking/other) per vehicle; both feed the Reports tab. |
| **Reports** | Fuel efficiency (km/L), operational cost (fuel + maintenance), revenue, and ROI % per vehicle, plus a bar chart. "Export CSV" downloads the same data. |
| **AI Insights** | Rule-based engine flags: overdue maintenance (odometer since last service), fuel-efficiency anomalies vs. fleet average, expiring/expired licenses, low safety scores, and fleet under-utilization. Click "Refresh" to recompute. |
| **Blockchain Ledger** | Every dispatch / completion / cancellation / maintenance open-close event is appended as a SHA-256 hash-chained block. "Verify Chain Integrity" recomputes every hash and reports the first broken block if the underlying data was ever edited directly in the database. |
| **Dark mode** | Toggle in the sidebar; preference persists across sessions. |
| **Responsive layout** | Sidebar collapses to a horizontal bar and filter/table layouts stack on narrow viewports. |

## 5. Mandatory business rules — where they're enforced

All of the following are enforced **server-side** in `server.js` (never trust the client alone):

- Vehicle registration number is unique (checked on create, unique index in `models.js` as a backstop).
- Retired or In Shop vehicles are excluded from trip creation and dispatch.
- Suspended drivers or drivers with an expired license cannot be assigned or dispatched.
- A vehicle or driver already `On Trip` cannot be assigned to a second trip.
- Cargo weight is validated against the vehicle's max load capacity on both trip creation and dispatch.
- Dispatch flips vehicle + driver to `On Trip`; Complete flips both back to `Available` and updates odometer; Cancel restores `Available` if the trip had been dispatched.
- Opening a maintenance record flips the vehicle to `In Shop`; closing it restores `Available` unless the vehicle is Retired.

The UI additionally pre-filters dropdowns to eligible options so invalid actions are rare, but the API is the actual source of truth.

## 6. Project structure

```
transitops/
├── server.js        # Express API, business rules, blockchain ledger, AI insights
├── models.js         # Mongoose schemas (User, Vehicle, Driver, Trip, Maintenance, FuelLog, Expense, Block)
├── package.json
├── .env.example
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

## 7. Known limitations / not implemented

The spec's core requirements (section 3–4) and most bonus items (charts, CSV export,
search/filter/sort, dark mode) are implemented. Not included, since they need extra
infrastructure the brief marks optional: PDF export, outbound email reminders for
expiring licenses (the AI Insights tab surfaces the same information in-app instead),
and vehicle document/file uploads.
