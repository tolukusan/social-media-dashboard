# Use Case Catalogue

**Project:** Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies  
**Document:** Use Case Catalogue  
**Version:** 1.0  
**Status:** Approved  
**Phase:** Step 3 — Roles, Permissions & Workflows

## 1. Purpose

This catalogue provides concise use cases that can later be converted into the project's academic use-case diagram and test cases.

---

# 2. Administrator Use Cases

| ID | Use Case |
|---|---|
| UC-A01 | Log in |
| UC-A02 | Log out |
| UC-A03 | Change own password |
| UC-A04 | Create user |
| UC-A05 | Update user |
| UC-A06 | Assign role |
| UC-A07 | Activate user |
| UC-A08 | Deactivate user |
| UC-A09 | Reset user password |
| UC-A10 | View users |
| UC-A11 | Create marketing channel |
| UC-A12 | Update marketing channel |
| UC-A13 | Activate/deactivate marketing channel |
| UC-A14 | Create platform |
| UC-A15 | Update platform |
| UC-A16 | Activate/deactivate platform |
| UC-A17 | Create campaign |
| UC-A18 | Update campaign |
| UC-A19 | Archive campaign |
| UC-A20 | Enter performance data |
| UC-A21 | Update performance data |
| UC-A22 | Archive performance record |
| UC-A23 | View dashboard |
| UC-A24 | Filter dashboard |
| UC-A25 | View analytics |
| UC-A26 | Compare periods |
| UC-A27 | Compare channels |
| UC-A28 | Compare campaigns |
| UC-A29 | View trends |
| UC-A30 | View KPI targets |
| UC-A31 | Manage KPI targets |
| UC-A32 | Generate report |
| UC-A33 | Export PDF report |

---

# 3. Marketing Officer Use Cases

| ID | Use Case |
|---|---|
| UC-MO01 | Log in |
| UC-MO02 | Log out |
| UC-MO03 | Change own password |
| UC-MO04 | View campaigns |
| UC-MO05 | Create campaign |
| UC-MO06 | Update campaign |
| UC-MO07 | View channels/platforms |
| UC-MO08 | Enter performance data |
| UC-MO09 | Update performance data |
| UC-MO10 | Review historical performance |
| UC-MO11 | View dashboard |
| UC-MO12 | Filter dashboard |
| UC-MO13 | View analytics |
| UC-MO14 | Compare periods |
| UC-MO15 | Compare channels |
| UC-MO16 | Compare campaigns |
| UC-MO17 | View trends |
| UC-MO18 | View KPI targets |
| UC-MO19 | Generate report |
| UC-MO20 | Export PDF report |

---

# 4. Management Use Cases

| ID | Use Case |
|---|---|
| UC-MG01 | Log in |
| UC-MG02 | Log out |
| UC-MG03 | Change own password |
| UC-MG04 | View campaigns |
| UC-MG05 | View performance information |
| UC-MG06 | View dashboard |
| UC-MG07 | Filter dashboard |
| UC-MG08 | View KPIs |
| UC-MG09 | View KPI targets |
| UC-MG10 | View analytics |
| UC-MG11 | Compare periods |
| UC-MG12 | Compare channels |
| UC-MG13 | Compare campaigns |
| UC-MG14 | View trends |
| UC-MG15 | Generate report |
| UC-MG16 | Export PDF report |

---

# 5. Use Case Diagram Input

A later academic use-case diagram should show three actors:

```text
Administrator
Digital Marketing Officer
Marketing Manager / Management User
```

Shared use cases may be grouped around:

```text
Authentication
Campaigns
Performance Data
Dashboard
Analytics
Reports
```

Administrator-only use cases may be grouped around:

```text
User Management
Channel Management
Platform Management
Archival / Administration
KPI Target Management
```

---

# 6. Traceability

These use cases should later map to:

- requirements IDs
- workflow IDs
- route/page implementation
- automated tests
- project demonstration steps
