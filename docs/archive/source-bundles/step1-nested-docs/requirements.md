# Requirements Specification

**Project:** Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies  
**Document:** Requirements Specification  
**Version:** 1.0  
**Status:** Approved  
**Source:** Approved project development brief  
**Phase:** Step 1 — Requirements Decomposition

## 1. Purpose

This document converts the project development brief into a structured catalogue of functional and non-functional requirements.

The system is a web-based, database-driven Digital Marketing Performance Analytics and Monitoring System designed for educational publishing companies. Its core purpose is to centralise digital marketing performance information and transform recorded data into organised summaries, calculations, comparisons, trends, dashboards and reports.

The system is not intended to replace existing social media, advertising, email, website analytics or search-engine platforms.

## 2. Core Product Flow

The system shall support the following high-level flow:

**Performance Data → Data Processing → Analytics → Dashboard → Monitoring → Reporting**

## 3. Primary User Roles

### ROLE-01 — System Administrator

The Administrator is responsible for system-wide management and configuration.

Expected capabilities include:

- create and manage user accounts
- assign user roles
- activate and deactivate users
- manage system settings
- manage marketing channels
- manage KPI categories
- view system-wide information
- maintain data integrity
- monitor system activity where implemented

### ROLE-02 — Digital Marketing Officer

The Digital Marketing Officer is the primary operational user.

Expected capabilities include:

- create and manage campaign information within authorised scope
- enter marketing performance data
- update authorised records
- view dashboards
- filter performance information
- compare periods
- compare channels and campaigns where supported
- monitor KPIs
- view trends
- generate reports
- review historical performance

### ROLE-03 — Marketing Manager / Management User

The Management user primarily consumes analysed information.

Expected capabilities include:

- view executive dashboards
- monitor major KPIs
- review channel performance
- compare periods
- review performance trends
- view campaign summaries
- access reports

Whether this role is strictly read-only remains unresolved and is tracked in `open-questions.md`.

---

# 4. System Requirements

## 4.1 System-Level Requirements

### SYS-001
The system shall provide a centralised environment for recording, organising, processing, analysing, monitoring, visualising and reporting digital marketing performance information.

### SYS-002
The initial version shall remain functional without live third-party marketing API integrations.

### SYS-003
The initial version shall support reliable manual or structured performance-data entry.

### SYS-004
The system architecture shall permit future integration with third-party analytics and marketing platforms without requiring the core MVP to depend on those integrations.

### SYS-005
The system shall be designed primarily for desktop and laptop use while remaining reasonably usable on tablets and mobile devices.

### SYS-006
The system shall prioritise functionality, simplicity, reliability, usability and demonstrability over unnecessary technical complexity.

### SYS-007
The MVP shall be designed for one educational publishing organisation per deployment.

### SYS-008
Multi-tenant organisation isolation is outside the MVP.

---

## 4.2 Authentication and User Management

### AUTH-001
Only authenticated users shall be allowed to access protected application functionality.

### AUTH-002
The system shall provide login functionality.

### AUTH-003
The system shall provide logout functionality.

### AUTH-004
The system shall provide password-management functionality.

### AUTH-005
Administrators shall be able to create user accounts.

### AUTH-006
Administrators shall be able to assign users to roles.

### AUTH-007
Administrators shall be able to activate user accounts.

### AUTH-008
Administrators shall be able to deactivate user accounts.

### AUTH-009
The system shall restrict functionality according to the authenticated user's assigned role and permissions.

### AUTH-010
The system shall maintain authenticated sessions securely.

### AUTH-011
The system shall prevent deactivated users from accessing protected functionality.

---

## 4.3 Marketing Channel Management

### CHN-001
The system shall store and manage digital marketing channels.

### CHN-002
The initial system shall accommodate the following channel categories:

- Social Media Marketing
- Website / Content Marketing
- Email Marketing
- Search Engine Optimisation
- Online Advertising
- Other Digital Marketing Channels

### CHN-003
Administrators shall be able to add marketing channels.

### CHN-004
Administrators shall be able to edit marketing channels.

### CHN-005
Administrators shall be able to activate marketing channels.

### CHN-006
Administrators shall be able to deactivate marketing channels.

### CHN-007
Historical performance information shall remain interpretable when a channel is deactivated.

The exact data-retention behaviour for deactivated channels is to be finalised during data-model design.

---

## 4.4 Platform Management

The brief references platform-level filtering and campaign/platform associations but does not explicitly define platform administration.

### PLT-001
The system shall associate relevant campaign and performance information with a marketing platform where applicable.

### PLT-002
The system shall support filtering by platform.

### PLT-003
The platform catalogue shall use a hybrid model: the system shall provide seeded default platforms and Administrators shall be able to add, edit, activate and deactivate additional platforms.

---

## 4.5 Campaign Management

### CAM-001
Authorised users shall be able to create campaign records.

### CAM-002
Authorised users shall be able to retrieve campaign records.

### CAM-003
Authorised users shall be able to review campaign records.

### CAM-004
A campaign shall have a campaign name.

### CAM-005
A campaign may have a description.

### CAM-006
A campaign shall contain or reference a campaign objective.

### CAM-007
A campaign may use multiple marketing channels.

### CAM-007A
A campaign may use multiple platforms.

### CAM-007B
Platforms shall belong to a marketing channel.

### CAM-007C
Campaign-to-channel and campaign-to-platform relationships shall be modelled so that multi-channel campaigns are supported without duplicating the campaign itself.

### CAM-008
A campaign shall support target-audience information.

### CAM-009
A campaign shall have a start date.

### CAM-010
A campaign shall have an end date where applicable.

### CAM-011
The system shall validate campaign dates.

### CAM-012
A campaign shall have a status.

### CAM-013
Initial supported campaign statuses shall include:

- Planned
- Active
- Completed
- Suspended
- Cancelled

### CAM-014
A campaign may contain a budget.

### CAM-015
A campaign may identify responsible personnel.

### CAM-016
A campaign may contain notes.

### CAM-017
The system shall allow authorised users to update campaign records subject to access-control rules.

### CAM-018
Campaign deletion, archival or soft-deletion behaviour shall be explicitly defined before implementation.

---

## 4.6 Performance Data Management

### PERF-001
Authorised users shall be able to record digital marketing performance information.

### PERF-002
Performance records shall be associated with sufficient context to identify the campaign, channel, platform and reporting period where applicable.

### PERF-003
The system shall support channel-specific metrics.

### PERF-004
The system shall validate numerical performance values.

### PERF-005
The system shall validate required performance-record fields.

### PERF-006
The system shall validate dates and reporting periods.

### PERF-007
The system shall prevent obviously invalid values.

### PERF-008
The system shall provide meaningful validation error messages.

### PERF-009
The system shall minimise accidental duplicate performance records where practical.

### PERF-010
The system shall confirm successful performance-data submission.

### PERF-011
The system shall support authorised updates to previously entered performance data.

### PERF-012
The system shall maintain sufficient historical information to support comparisons and trend analysis.

### PERF-013
The MVP shall record performance at daily granularity using a calendar `recordDate`.

### PERF-014
Weekly, monthly, quarterly and yearly analytics shall be derived by aggregating daily records.

### PERF-015
Arbitrary multi-day source summaries are outside the MVP input model and may be introduced later if required.

---

## 4.7 Approved MVP Metric Catalogue

The MVP shall use the following initial metric catalogue. Raw values are entered or imported manually. Derived rates are calculated by the system.

### Social Media

Raw:
- Reach
- Impressions
- Engagements
- Link Clicks
- Followers Gained

Derived:
- Engagement Rate
- Click-Through Rate

### Website / Content

Raw:
- Users
- Sessions
- Page Views
- Conversions

Derived:
- Conversion Rate

### Email Marketing

Raw:
- Emails Sent
- Emails Delivered
- Opens
- Clicks
- Unsubscribes
- Conversions

Derived:
- Open Rate
- Click-Through Rate
- Conversion Rate

### Online Advertising

Raw:
- Impressions
- Reach
- Clicks
- Spend
- Conversions

Derived:
- Click-Through Rate
- Cost per Click
- Conversion Rate

### SEO

Raw:
- Organic Traffic
- Search Impressions
- Search Clicks
- Average Search Position

Derived:
- Search Click-Through Rate

### Metric Rules

- Raw metrics shall be persisted.
- Derived rates shall be calculated from raw values rather than manually entered.
- Return-on-ad-spend and revenue-based metrics are outside the initial MVP unless revenue data is later added.
- Every metric shall have a stable code, unit, applicable channel and aggregation rule documented in `kpi-catalog.md`.

## 4.8 KPI Management

### KPI-001
The system shall support defined Key Performance Indicators.

### KPI-002
A KPI definition shall have a name.

### KPI-003
A KPI definition may have a description.

### KPI-004
A KPI definition shall identify a measurement unit where applicable.

### KPI-005
A KPI may have a target value.

### KPI-006
KPI targets shall support the following reporting periods where applicable: daily, weekly, monthly, quarterly, yearly and campaign-lifetime.

### KPI-007
A KPI may be associated with a marketing channel or platform where appropriate.

### KPI-008
The system shall determine or display an actual KPI value.

### KPI-009
Where a target exists, the system shall support target-versus-actual comparison.

### KPI-010
KPI status classifications shall be derived from predefined organisational targets or rules.

### KPI-011
The system shall not independently classify business performance as good or bad without an explicit rule or target.

### KPI-012
Each calculated KPI shall have a documented formula.

### KPI-013
Zero-denominator, null-data, aggregation and rounding rules shall be defined in `kpi-catalog.md` before KPI implementation.

### KPI-014
Derived rate aggregation shall aggregate the raw numerator and denominator first and calculate the rate afterward. The system shall not average row-level percentages unless a KPI explicitly requires that method.

### KPI-015
Derived KPI values shall be calculated from stored raw metrics rather than persisted as the primary source of truth.

---

## 4.9 Analytics and Calculation Engine

### ANL-001
The system shall aggregate performance data.

### ANL-002
The system shall calculate selected rates and derived metrics.

### ANL-003
The system shall support period-to-period comparison.

### ANL-004
The system shall support channel comparison.

### ANL-005
The system shall support campaign comparison.

### ANL-006
The system shall support trend identification and visualisation.

### ANL-007
The system shall support target-versus-actual comparison.

### ANL-008
The system shall provide relevant summary calculations.

### ANL-009
The system shall focus on descriptive and comparative analytics for the MVP.

### ANL-010
Advanced predictive analytics and machine-learning analytics shall not be required for the MVP.

### ANL-011
Calculation logic shall be documented and consistently applied.

---

## 4.10 Initial KPI Formula Candidates

The project brief provides the following candidate formulas, subject to final KPI-semantics approval.

### Engagement Rate

`Engagement Rate = (Total Engagements / Reach) × 100`

The project brief also allows another clearly defined formula where a platform or metric requires it.

### Click-Through Rate

`CTR = (Clicks / Impressions) × 100`

### Conversion Rate

`Conversion Rate = (Conversions / Clicks) × 100`

These formulas shall not be implemented until denominator behaviour, aggregation method, precision and applicability are defined in the KPI catalogue.

---

## 4.11 Dashboard

### DASH-001
The dashboard shall be a central feature of the application.

### DASH-002
The dashboard shall prioritise quick interpretation rather than displaying large quantities of raw data.

### DASH-003
The dashboard shall display total campaigns where applicable.

### DASH-004
The dashboard shall display total marketing channels where applicable.

### DASH-005
The dashboard shall display total reach where applicable.

### DASH-006
The dashboard shall display total impressions where applicable.

### DASH-007
The dashboard shall display total engagements where applicable.

### DASH-008
The dashboard shall display total clicks where applicable.

### DASH-009
The dashboard shall display engagement-rate information where applicable.

### DASH-010
The dashboard shall display conversion-related indicators where applicable.

### DASH-011
The dashboard shall display campaign expenditure where applicable.

### DASH-012
The dashboard shall display website-traffic indicators where applicable.

### DASH-013
The dashboard shall display performance by channel.

### DASH-014
The dashboard shall display performance by campaign.

### DASH-015
The dashboard shall display performance by selected period.

### DASH-016
The dashboard shall display performance trends.

### DASH-017
The dashboard shall support filtering by date or period.

### DASH-018
The dashboard shall support filtering by marketing channel.

### DASH-019
The dashboard shall support filtering by campaign.

### DASH-020
The dashboard shall support filtering by platform.

### DASH-021
The dashboard shall support filtering by KPI where applicable.

### DASH-022
Dashboard summaries and visualisations shall update according to selected filters.

---

## 4.12 Performance Comparison

### CMP-001
Users shall be able to compare selected performance across periods.

### CMP-002
Period comparisons may include:

- current month versus previous month
- current quarter versus previous quarter
- current year versus previous year

### CMP-003
Users shall be able to compare selected performance across channels.

### CMP-004
Users shall be able to compare selected performance across campaigns.

### CMP-005
The system shall present comparisons through appropriate tables, charts or summary indicators.

---

## 4.13 Trend Analysis

### TRD-001
The system shall provide simple historical trend visualisation.

### TRD-002
Users shall be able to observe changes in selected indicators over time.

### TRD-003
Trend visualisations may include:

- engagement
- reach
- impressions
- website traffic
- email clicks
- advertising clicks
- campaign performance

### TRD-004
Time-series information should use line charts where appropriate.

### TRD-005
Predictive forecasting is not required for the MVP.

---

## 4.14 Reporting

### REP-001
The system shall generate digital marketing performance summaries.

### REP-002
Reports shall support date or period filtering.

### REP-003
Reports shall support campaign filtering.

### REP-004
Reports shall support marketing-channel filtering.

### REP-005
Reports shall support platform filtering.

### REP-006
Reports shall support KPI filtering where applicable.

### REP-007
Reports shall include the reporting period.

### REP-008
Reports shall identify the selected campaign, channel or scope where applicable.

### REP-009
Reports shall contain relevant KPI values.

### REP-010
Reports shall contain relevant summary statistics.

### REP-011
Reports shall contain comparisons where appropriate.

### REP-012
Reports shall contain charts where appropriate.

### REP-013
Reports shall contain the report-generation date.

### REP-014
Where technically feasible, reports shall be exportable in at least one suitable portable or spreadsheet-compatible format.

### REP-015
The exact export formats required for the MVP shall be resolved before implementation.

---

## 4.15 Search and Filtering

### SRCH-001
The system shall provide appropriate search and/or filtering for campaigns.

### SRCH-002
The system shall provide appropriate search and/or filtering for channels.

### SRCH-003
The system shall provide appropriate search and/or filtering for platforms.

### SRCH-004
The system shall support date-based filtering.

### SRCH-005
The system shall support KPI filtering where applicable.

### SRCH-006
The system shall support filtering of performance records.

### SRCH-007
Administrators shall be able to locate and filter users where appropriate.

### SRCH-008
Relevant filters shall update information without requiring navigation through unrelated pages.

---

## 4.16 Data Integrity and Validation

### DATA-001
Records shall use unique identifiers.

### DATA-002
The database shall minimise unnecessary duplication.

### DATA-003
Relationships shall be clearly defined and enforced where appropriate.

### DATA-004
Required fields shall be validated.

### DATA-005
Numerical fields shall reject invalid non-numerical input.

### DATA-006
Dates shall be validated.

### DATA-007
The system shall prevent obviously invalid records.

### DATA-008
The system shall provide meaningful errors for invalid submissions.

### DATA-009
The system shall minimise duplicate records where practical.

### DATA-010
The system shall use controlled permissions for update and delete operations.

### DATA-011
Calculation formulas shall be applied consistently.

### DATA-012
Important performance records shall not be destructively deleted without an explicit authorisation and retention strategy.

### DATA-013
The system shall preserve historical interpretability where records reference deactivated users, channels or other entities.

---

## 4.17 Security Requirements

### SEC-001
The system shall require authenticated access for protected functionality.

### SEC-002
Passwords shall be stored securely.

### SEC-003
The system shall enforce role-based authorisation.

### SEC-004
The system shall validate externally supplied input.

### SEC-005
The system shall control authenticated sessions securely.

### SEC-006
The system shall protect against unauthorised access.

### SEC-007
Database access shall follow appropriate access-control practices.

### SEC-008
User information shall be handled securely.

### SEC-009
The implementation shall consider common web-application security risks.

Concrete security controls shall be defined during the architecture/security step.

---

## 4.18 User Interface Requirements

### UI-001
The interface shall be professional.

### UI-002
The interface shall be clean and visually consistent.

### UI-003
The interface shall be responsive.

### UI-004
The interface shall be intuitive.

### UI-005
The interface shall support reasonable accessibility.

### UI-006
Navigation shall be consistent across modules.

### UI-007
The primary user experience shall be suitable for desktop and laptop use.

### UI-008
The application shall remain reasonably usable on tablets and mobile devices.

### UI-009
Visualisations shall be clearly labelled and understandable to non-technical users.

### UI-010
The dashboard shall avoid unnecessary visual complexity.

### UI-011
Suggested main navigation may include:

- Dashboard
- Campaigns
- Performance Data
- Analytics
- Reports
- Users
- Settings

Final navigation shall be refined during UI/UX design.

---

## 4.19 Visualisation Requirements

### VIS-001
The system shall use visualisations where appropriate instead of relying entirely on raw tables.

### VIS-002
Supported visualisation types may include:

- KPI cards
- bar charts
- line charts
- doughnut or pie charts where appropriate
- tables
- trend indicators
- target-versus-actual indicators

### VIS-003
Visualisations shall be readable.

### VIS-004
Visualisations shall be responsive.

### VIS-005
Visualisations shall use meaningful labels.

### VIS-006
Visualisations shall be consistent.

### VIS-007
Visualisations shall be understandable to non-technical users.

---

## 4.20 Testing Requirements

### TEST-001
The system shall undergo functional testing.

### TEST-002
Functional testing shall include major features such as:

- login
- user creation
- campaign creation
- performance-data entry
- KPI calculation
- dashboard filtering
- report generation

### TEST-003
The system shall undergo integration testing.

### TEST-004
Integration testing shall verify data flow across major modules, including:

**Performance Data → Database → Analytics → Dashboard**

### TEST-005
The system shall undergo usability testing with intended user tasks.

### TEST-006
The system shall undergo invalid-input and validation testing.

### TEST-007
The system shall undergo basic performance testing under expected normal usage.

### TEST-008
Evaluation results shall be documented.

---

## 4.21 Quality and Evaluation Requirements

### QUAL-001
The completed system shall be evaluated for functionality.

### QUAL-002
The completed system shall be evaluated for calculation accuracy.

### QUAL-003
The completed system shall be evaluated for data integrity.

### QUAL-004
The completed system shall be evaluated for usability.

### QUAL-005
The completed system shall be evaluated for accessibility.

### QUAL-006
The completed system shall be evaluated for reliability.

### QUAL-007
The completed system shall be evaluated for responsiveness.

### QUAL-008
The completed system shall be evaluated for security.

### QUAL-009
The completed system shall be evaluated for dashboard clarity.

### QUAL-010
The completed system shall be evaluated for reporting effectiveness.

---

## 4.22 Required Project Deliverables

### DEL-001
Fully functional web application.

### DEL-002
Source code.

### DEL-003
Database schema and/or database.

### DEL-004
System architecture documentation.

### DEL-005
Use-case diagram.

### DEL-006
System flowcharts.

### DEL-007
Entity Relationship Diagram.

### DEL-008
Database design documentation.

### DEL-009
User-interface designs or screens.

### DEL-010
Test plan and test results.

### DEL-011
User guide.

### DEL-012
Technical/developer documentation.

### DEL-013
System demonstration.

### DEL-014
Deployment instructions.

### DEL-015
Project screenshots suitable for academic documentation.

---

# 5. MVP Requirements

The MVP shall contain, at minimum:

- user authentication
- role-based access
- dashboard
- campaign management
- marketing-channel management
- performance-data entry
- database storage
- KPI calculations
- performance charts
- date/channel/campaign filtering
- basic analytics
- performance comparison
- report generation
- testing

Features classified as future enhancements are documented in `scope.md`.

---

# 6. Requirement Traceability Principle

Every implemented major feature should be traceable to:

1. an approved project objective or requirement
2. an implementation component
3. one or more verification or testing activities
4. evidence suitable for final project evaluation and defence

No major functionality should be introduced solely because the implementation tool or coding agent considers it useful.

---

# 7. Approval Status

This document is **Approved v1.0** for use as the Step 1 requirements baseline.

The following critical decisions are approved:

- one organisation per deployment for the MVP
- daily performance-record granularity
- multi-channel campaigns
- multi-platform campaigns
- platforms belong to channels
- seeded and administrator-extensible platform catalogue
- approved initial MVP metric catalogue
- raw metrics stored and derived KPIs calculated
- rate aggregation uses aggregate numerator/denominator before calculation
- KPI targets may use daily, weekly, monthly, quarterly, yearly or campaign-lifetime periods

Questions that remain open are intentionally deferred to later design steps and are recorded in `open-questions.md`.
