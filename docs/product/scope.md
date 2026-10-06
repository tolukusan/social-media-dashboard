# Project Scope

**Project:** Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies  
**Document:** Scope Definition  
**Version:** 1.0  
**Status:** Approved  
**Phase:** Step 1 — Requirements Decomposition

## 1. Scope Principle

The project shall remain focused on building a functional, database-driven web application for recording, processing, analysing, visualising, monitoring and reporting digital marketing performance information.

The project should prioritise:

- functionality
- simplicity
- reliability
- usability
- demonstrability
- data integrity
- accurate calculations

The core system must be demonstrable as an academic PGD Information Technology project.

---

# 2. Core MVP Scope

The following capabilities are classified as **CORE** and must be implemented for the MVP.

## 2.1 Authentication and Access Control

- user login
- user logout
- password handling
- administrator-created user accounts
- role assignment
- activation and deactivation of users
- role-based access control
- authenticated session handling

## 2.2 Marketing Channel Management

- record marketing channels
- add channels
- edit channels
- activate channels
- deactivate channels
- support the initial channel categories required by the brief

## 2.3 Campaign Management

- create campaigns
- retrieve campaigns
- review campaigns
- update campaigns within authorised scope
- store campaign metadata
- manage campaign status
- associate campaigns with appropriate channel/platform context

Campaigns may use multiple marketing channels and multiple platforms. Platforms belong to marketing channels.

## 2.4 Performance Data

- enter performance data
- validate performance data
- associate performance with campaign/channel/platform/time context
- record performance at daily granularity
- aggregate daily records for weekly, monthly, quarterly and yearly analytics
- store performance records in a database
- retrieve historical records
- update authorised records
- maintain sufficient historical data for trends and comparisons

## 2.5 KPI Management and Calculation

- define selected KPIs
- support KPI targets where applicable
- calculate approved derived metrics
- compare actual performance to approved targets
- document formulas
- apply consistent calculation rules

## 2.6 Dashboard

- KPI summary cards
- campaign summaries
- channel summaries
- selected performance metrics
- trend visualisation
- campaign comparison
- channel comparison
- period-based views
- filter-driven updates

## 2.7 Analytics

- aggregation
- basic summary statistics
- selected rate calculations
- period comparison
- campaign comparison
- channel comparison
- descriptive trend analysis
- target-versus-actual comparison

## 2.8 Search and Filtering

- date / period filters
- campaign filters
- channel filters
- platform filters
- KPI filters where applicable
- user filtering for administrators where appropriate

## 2.9 Reporting

- generate performance summaries
- apply report filters
- include relevant KPI values
- include relevant comparisons
- include charts where appropriate
- include report-generation date
- provide at least one suitable export format where technically feasible

## 2.10 Testing

- functional testing
- integration testing
- validation testing
- usability testing
- basic performance testing
- documented test results

---

# 3. Conditional Scope

The following features are **CONDITIONAL**. They may be included where applicable to the selected MVP metrics, available data and approved design.

## 3.1 Campaign Budget and Spend

Budget and expenditure data should be supported where applicable.

## 3.2 Conversion Metrics

Conversion-related metrics should be included only where the marketing activity supplies meaningful conversion data.

## 3.3 Website Metrics

Website-related metrics should be included where applicable to the selected MVP metric catalogue.

## 3.4 Audit Records

Audit logging may be included if approved during architecture and security design.

The brief lists audit records as a possible database entity rather than an unconditional mandatory module.

## 3.5 Report Export Format

The brief allows PDF and/or CSV/Excel-compatible export.

PDF export is the required MVP report export. CSV may be added if it does not delay completion.

## 3.6 Notifications

Notifications are mentioned only as part of a possible dashboard header.

They are not currently a mandatory core requirement.

---

# 4. Explicit Future Enhancements

The following features are classified as **FUTURE** and must not delay the MVP.

- live marketing API integrations
- automated data synchronisation
- AI-generated marketing recommendations
- predictive analytics
- automated email reports
- advanced attribution modelling
- social media publishing
- automated campaign management
- mobile application
- advanced machine learning

Potential third-party integration targets may include:

- Google Analytics
- Meta / Facebook
- Instagram
- TikTok
- YouTube
- Google Ads
- email-marketing platforms
- other relevant marketing platforms

The architecture should permit future integration, but the MVP must not depend on these integrations.

---

# 5. Explicit Non-Goals for the MVP

Unless the scope is formally changed, the MVP is not intended to become:

- a social-media publishing suite
- a replacement for Meta Ads Manager
- a replacement for Google Ads
- a replacement for Google Analytics
- an email-marketing sending platform
- a search-engine optimisation crawler
- a machine-learning prediction platform
- an AI marketing strategist
- a complete customer relationship management platform
- an ecommerce platform
- a marketing automation platform
- a mobile-native application
- a full enterprise business-intelligence platform

---

# 6. Scope Control Rules

## SCOPE-RULE-001

No future enhancement shall be introduced into MVP implementation merely because it appears technically useful.

## SCOPE-RULE-002

A feature may move from FUTURE to CORE only after explicit approval and documentation.

## SCOPE-RULE-003

The implementation agent shall not invent new major product modules without approval.

## SCOPE-RULE-004

Architecture may be designed for extensibility without implementing future functionality prematurely.

## SCOPE-RULE-005

Where a requirement is ambiguous, implementation shall pause that decision and refer to the approved requirements, ADRs or open-question register rather than silently choosing behaviour.

## SCOPE-RULE-006

Academic deliverables are part of project completion and shall be produced alongside development rather than reconstructed after implementation.

---

# 7. MVP Success Boundary

The project shall be considered functionally complete when it can demonstrate that authorised users can:

1. authenticate
2. manage relevant campaigns and channels
3. enter selected digital marketing performance information
4. store that information reliably
5. calculate approved KPIs accurately
6. view performance through a dashboard
7. filter performance information
8. compare selected periods, channels and campaigns
9. review selected trends
10. generate useful performance reports
11. operate within appropriate access-control rules
12. complete the above reliably during testing

---

# 8. Approval Status

This scope document is **Approved v1.0**.

Critical scope decisions approved in Step 1:

- single organisation per deployment
- daily performance-data input granularity
- multi-channel and multi-platform campaigns
- seeded plus administrator-extensible platform catalogue
- fixed initial MVP metric set
- PDF as the required report export
- future integrations remain outside the MVP
