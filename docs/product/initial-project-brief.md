PROJECT DEVELOPMENT BRIEF

Development of a Web-Based Digital Marketing Performance Analytics and Monitoring System for Educational Publishing Companies

1. Project Overview
   The proposed project is a web-based Digital Marketing Performance Analytics and Monitoring System designed specifically to support educational publishing companies in the structured management, analysis, monitoring, and presentation of digital marketing performance information.
   Educational publishing companies increasingly use digital channels such as social media, websites, email marketing, search engines, online advertising, and other digital platforms to promote educational products and communicate with their target audiences. These activities generate different forms of performance information. However, such information may be distributed across multiple platforms and records, making it difficult to obtain a consolidated view of digital marketing performance.
   The proposed system will provide a centralised web-based platform where authorised users can record, manage, analyse, monitor, and visualise selected digital marketing performance data. The system will transform entered performance records into meaningful summaries, comparisons, trends, charts, and dashboard information that can assist marketing personnel and management in monitoring digital marketing activities.
   The system is intended to function primarily as a digital marketing performance management, analytics, and monitoring platform, rather than as a replacement for existing social media, advertising, email, website analytics, or search engine platforms.

2. Project Goal
   The goal of the project is to develop a functional, user-friendly, database-driven web application that provides educational publishing companies with a centralised environment for:
   recording digital marketing performance data
   organising marketing performance information
   monitoring selected Key Performance Indicators (KPIs)
   analysing performance over defined periods
   comparing performance across marketing channels
   identifying performance trends
   presenting information through an interactive dashboard
   generating useful performance reports.

3. Target Users
   The system should be designed around the following primary user categories.
   3.1 System Administrator
   The Administrator will be responsible for the general management of the system.
   Key responsibilities should include:
   creating and managing user accounts
   assigning user roles
   activating or deactivating users
   managing system settings
   managing marketing channels
   managing KPI categories
   viewing system-wide information
   maintaining data integrity
   monitoring system activity where applicable.

3.2 Digital Marketing Officer/Personnel
The Digital Marketing Officer will be the primary operational user.
The user should be able to:
enter marketing campaign information
enter channel performance data
update authorised records
view performance dashboards
filter performance information
compare performance across periods
view trends
monitor KPIs
generate reports
review historical performance.

3.3 Marketing Manager/Management User
The Management user should primarily consume analysed information rather than perform routine data entry.
The user should be able to:
view the executive dashboard
monitor major KPIs
review channel performance
compare periods
examine performance trends
view campaign summaries
access reports
use the presented information to support managerial review and decision-making.

4. Core System Modules
   The system should contain the following major modules.
   4.1 Authentication and User Management Module
   The system should provide secure authentication for authorised users.
   Required functions should include:
   login
   logout
   password management
   user registration by administrator
   role-based access
   user activation/deactivation
   session management
   appropriate access restrictions.
   Users should only have access to functions permitted by their assigned roles.

4.2 Dashboard Module
The dashboard should be the central feature of the system.
It should provide a concise overview of digital marketing performance using appropriate visualisations and summary indicators.
The dashboard should display, where applicable:
total campaigns
total marketing channels
total reach
total impressions
total engagements
total clicks
engagement rate
conversion-related indicators where applicable
campaign expenditure where applicable
website traffic indicators where applicable
performance by channel
performance by campaign
performance by selected period
performance trends.
The dashboard should support filtering by:
date/period
marketing channel
campaign
platform
KPI
other relevant categories defined during system analysis.
The dashboard should be designed for quick interpretation rather than simply displaying large quantities of raw data.

5. Digital Marketing Channel Management
   The system should support the recording and monitoring of performance information from relevant digital marketing channels.
   The initial system should accommodate channels such as:
   Social Media Marketing
   Website/Content Marketing
   Email Marketing
   Search Engine Optimisation
   Online Advertising
   Other Digital Marketing Channels
   The Administrator should be able to add, edit, activate, or deactivate channels where necessary.

6. Campaign Management Module
   The system should allow authorised users to create and manage digital marketing campaigns.
   A campaign record should contain relevant information such as:
   campaign name
   campaign description
   campaign objective
   marketing channel
   platform
   target audience
   start date
   end date
   campaign status
   budget, where applicable
   responsible personnel; and
   relevant notes.
   Possible campaign statuses may include:
   Planned
   Active
   Completed
   Suspended
   Cancelled
   The system should allow users to retrieve and review campaign records.

7. Performance Data Management Module
   This module will allow authorised users to enter and manage performance information associated with digital marketing activities.
   The system should support relevant metrics depending on the selected channel.
   Examples of Social Media Metrics
   Reach
   Impressions
   Engagements
   Likes/Reactions
   Comments
   Shares
   Link Clicks
   Followers
   Engagement Rate
   Examples of Website Metrics
   Users/Visitors
   Sessions
   Page Views
   Engagement
   Traffic Source
   Landing Page Visits
   Conversions, where applicable
   Examples of Email Marketing Metrics
   Emails Sent
   Emails Delivered
   Open Rate
   Clicks
   Click-Through Rate
   Unsubscribe Count
   Conversion-related indicators, where applicable
   Examples of Online Advertising Metrics
   Impressions
   Reach
   Clicks
   Click-Through Rate
   Cost
   Cost per Click
   Conversions
   Conversion Rate
   Return-related indicators, where applicable
   SEO-related Metrics
   Where applicable, the system may support:
   Organic Traffic
   Search Impressions
   Search Clicks
   Click-Through Rate
   Average Search Position
   Keywords monitored
   Ranking-related indicators
   The final list of metrics should be determined during the system requirements and design stages so that the project remains technically manageable.

8. KPI Management
   The system should provide a mechanism for defining and monitoring selected Key Performance Indicators.
   Each KPI should have appropriate information such as:
   KPI name
   description
   measurement unit
   target value, where applicable
   reporting period
   associated marketing channel
   actual value; and
   status.
   Where appropriate, the system should compare actual performance against defined targets.
   For example:
   KPI: Engagement Rate
   Target: 5%
   Actual: 6.2%
   Status: Above Target
   The system should avoid presenting such status classifications as independent business judgments. They should be based on predefined organisational targets or rules entered into the system.

9. Analytics and Calculation Engine
   The system should provide basic analytical functionality for transforming stored performance records into useful information.
   The analytical component should support:
   aggregation of performance data
   calculation of selected rates
   period-to-period comparison
   channel comparison
   campaign comparison
   trend identification
   target-versus-actual comparison
   summary calculations.
   Where applicable, formulas may include:
   Engagement Rate
   [
   Engagement\ Rate = \frac{Total\ Engagements}{Reach} \times 100
   ]
   or another clearly defined formula appropriate to the selected platform and metric.
   Click-Through Rate
   [
   CTR = \frac{Clicks}{Impressions} \times 100
   ]
   Conversion Rate
   [
   Conversion\ Rate = \frac{Conversions}{Clicks} \times 100
   ]
   The development team should clearly document the formula used for each calculated KPI to ensure consistency and transparency.

10. Performance Comparison
    The system should allow users to compare performance across different dimensions.
    Possible comparisons include:
    Period Comparison
    Current month vs previous month
    Current quarter vs previous quarter
    Current year vs previous year
    Channel Comparison
    Social Media vs Website
    Email vs Social Media
    SEO vs Paid Advertising
    Campaign Comparison
    Campaign A vs Campaign B
    Product campaign vs institutional campaign
    Completed campaigns within a selected period
    The system should present comparisons through appropriate tables, charts, or summary indicators.

11. Trend Analysis
    The system should provide simple trend visualisation.
    Users should be able to observe changes in selected indicators over time.
    Examples include:
    engagement trend
    reach trend
    impressions trend
    website traffic trend
    email click trend
    advertising click trend
    campaign performance trend.
    Line charts should be used where appropriate for time-series information.
    The system is not required to implement advanced predictive analytics or artificial intelligence. The primary focus is descriptive and comparative analytics suitable for a PGD-level software development project.
12. Reporting Module
    The system should provide a reporting function through which users can generate performance summaries.
    Reports should be filterable by:
    date
    campaign
    marketing channel
    platform
    KPI
    other relevant parameters.
    Where technically feasible, reports should be exportable in formats such as:
    PDF; and/or
    CSV/Excel-compatible format.
    A report should contain relevant information such as:
    reporting period
    selected campaign/channel
    KPI values
    summary statistics
    comparisons
    charts where appropriate
    report generation date.

13. Data Visualisation Requirements
    The system should use appropriate visualisation methods rather than presenting all information as raw tables.
    Possible visualisations include:
    KPI cards
    bar charts
    line charts
    doughnut/pie charts where appropriate;
    tables
    trend indicators
    target-versus-actual indicators.
    Visualisations should be:
    clear
    readable
    responsive
    appropriately labelled
    consistent
    meaningful
    easy for non-technical users to understand.
    The dashboard should avoid unnecessary visual complexity.

14. Search and Filtering
    Users should be able to locate relevant information efficiently.
    The system should provide appropriate search and filtering functions for:
    campaigns
    channels
    platforms
    dates
    KPIs
    performance records; and
    users, where applicable to the administrator.
    Filters should update the displayed information without requiring users to navigate through multiple unrelated pages.
15. Database Requirements
    The system should use a relational database or another suitable structured database solution.
    The database should be designed to minimise unnecessary duplication and maintain data integrity.
    Possible entities may include:
    Users
    Roles
    Marketing Channels
    Platforms
    Campaigns
    KPIs
    Performance Records
    Targets
    Reports
    Audit Records, where implemented
    The final database structure should be determined during system analysis and database design.
    Relationships between entities should be clearly defined and documented.

16. Data Entry Requirements
    Performance data entry should be simple and controlled.
    Forms should:
    use appropriate field labels
    identify required field
    validate numerical entries;
    validate dates
    prevent obviously invalid values
    provide meaningful error messages
    minimise duplicate records where possible
    provide confirmation after successful submission.
    For example, a user should not be able to submit a performance record with a missing campaign, invalid date, or non-numerical value in a numerical field.

17. Data Integrity
    The system should include mechanisms for maintaining reliable data.
    These should include:
    input validation
    appropriate database constraint
    unique identifiers
    controlled user permissions
    prevention of invalid record
    appropriate update/delete controls
    consistent calculation formulas.
    Deletion of important performance records should preferably require appropriate authorisation.

18. Security Requirements
    The system should implement basic web application security appropriate to the project.
    Minimum requirements should include:
    authenticated access
    password protection
    role-based authorisation
    secure password storage
    input validation
    session control
    protection against unauthorised access
    appropriate database access controls
    secure handling of user information.
    The development team should also consider common web application security risks during development.
19. User Interface Requirements
    The interface should be:
    professional
    clean
    responsive
    intuitive
    accessible
    consistent across modules
    suitable for desktop and laptop use, and
    reasonably usable on tablets and mobile devices.
    The system should use a consistent navigation structure.
    A suggested main navigation structure is:
    Dashboard | Campaigns | Performance Data | Analytics | Reports | Users | Settings
    The exact navigation should be refined during UI/UX design.

20. Suggested Dashboard Layout
    The main dashboard may follow the structure below:
    Header
    System name/logo
    Logged-in user
    Notifications, where applicable
    Logout
    KPI Summary Cards
    Total Campaigns
    Total Reach
    Total Engagement
    Total Clicks
    Average Engagement Rate
    Total Spend, where applicable
    Performance Charts
    Chart 1: Performance Trend Over Time
    Chart 2: Performance by Marketing Channel
    Chart 3: Campaign Performance Comparison
    Performance Table
    A table containing:
    Campaign
    Channel
    Period
    Reach
    Engagement
    Clicks
    Rate

Filters
Date range
Channel
Campaign
Platform
The dashboard should dynamically update based on selected filters.

21. Recommended System Workflow
    The general workflow should be:
    User Login
    ↓
    Dashboard
    ↓
    Create/Select Campaign
    ↓
    Select Marketing Channel
    ↓
    Enter Performance Data
    ↓
    Validate Data
    ↓
    Store in Database
    ↓
    Process/Calculate KPIs
    ↓
    Update Dashboard
    ↓
    View Analytics
    ↓
    Compare/Monitor Performance
    ↓
    Generate Report
    This workflow should be reflected in the system design documentation.

22. System Architecture
    The proposed system should preferably follow a structured web application architecture consisting of:
    Presentation Layer
    The user interface through which users interact with the application.
    Application/Business Logic Layer
    Responsible for:
    processing user requests
    validating data
    calculating KPIs
    processing analytics
    applying business rules
    controlling application workflows.
    Data Layer
    Responsible for:
    storing user information
    storing campaign records
    storing performance data
    retrieving records
    maintaining relationships
    enforcing data integrity.
    A three-tier architecture may therefore be adopted:
    Presentation Layer → Application Layer → Database Layer
    The development team should document the final architecture used.

23. Technology Stack
    The development team may select an appropriate modern technology stack based on available expertise and project requirements.
    A possible stack could include:
    Front End
    HTML5
    CSS3
    JavaScript
    Bootstrap or another responsive UI framework
    Chart.js or an equivalent charting library
    Back End
    One suitable server-side framework, such as:
    PHP/Laravel
    Python/Django
    Node.js/Express or
    another appropriate web framework.
    Database
    MySQL/MariaDB
    PostgreSQL
    or another suitable relational database.
    The final technology stack should be selected based on:
    ease of development
    maintainability
    security
    availability of development resources
    deployment requirements
    ability to demonstrate the required functionality.

24. API Integration
    The initial version of the project should not depend entirely on live third-party API integrations unless the development team can obtain and maintain the required API credentials and permissions.
    The system should initially support reliable manual or structured data entry.
    However, the architecture should be designed in a way that allows future integration with platforms such as:
    Google Analytics
    Meta/Facebook
    Instagram
    TikTok
    YouTube
    Google Ads
    email marketing platforms, and
    other relevant marketing platforms.
    Where API integration is not implemented in the project, it should be clearly documented as a potential future enhancement rather than presented as an implemented feature.

25. Testing Requirements
    The completed system should undergo systematic testing.
    Testing should include:
    Functional Testing
    Verify that individual functions work correctly.
    Examples:
    login
    user creation
    campaign creation
    data entry
    KPI calculation
    dashboard filtering
    report generation.
    Integration Testing
    Verify that different modules work together correctly.
    For example:
    Performance Data → Database → Analytics → Dashboard
    Usability Testing
    Assess whether intended users can:
    navigate the system
    enter information
    retrieve records
    understand dashboard information; and
    generate reports.

Validation Testing
Test invalid or incomplete inputs and confirm that the system responds appropriately.
Performance Testing
Assess basic system response and behaviour under normal expected usage.

26. Evaluation Criteria
    The completed system should be evaluated against clearly defined criteria, including:
    functionality
    accuracy of calculations
    data integrity
    usability
    accessibility
    reliability
    responsiveness
    security
    dashboard clarity
    reporting effectiveness.
    The evaluation results should be documented and used to determine whether the system satisfies its stated objectives.

27. Expected System Deliverables
    At the end of development, the development team should provide:
    Fully functional web application
    Source code
    Database schema/database
    System architecture documentation
    Use-case diagram
    System flowcharts
    Entity Relationship Diagram (ERD)
    Database design documentation
    User interface designs/screens
    Test plan and test results
    User guide
    Technical/developer documentation
    System demonstration
    Deployment instructions
    Project screenshots for academic documentation

28. Minimum Viable Product (MVP)
    To keep the project achievable within the academic project period, the minimum viable version of the system should contain:
    Essential
    User authentication
    Role-based access
    Dashboard
    Campaign management
    Marketing channel management
    Performance data entry
    Database storage
    KPI calculations
    Performance charts
    Date/channel/campaign filtering
    Basic analytics
    Performance comparison
    Report generation
    Testing
    Optional/Future Enhancement
    Live API integrations
    Automated data synchronisation
    AI-generated marketing recommendations
    Predictive analytics
    Automated email reports
    Advanced attribution modelling
    Social media publishing
    Automated campaign management
    Mobile application
    Advanced machine learning
    The optional features should not be allowed to delay the completion of the core system.

29. Key Development Principle
    The development team should prioritise functionality, simplicity, reliability, usability, and demonstrability over unnecessary technical complexity.
    The system is being developed as an academic PGD Information Technology project. Therefore, every major feature should have a clear relationship with the project's approved objectives and should be demonstrable during project evaluation and defence.
    The development should follow the principle:
    Analyse → Design → Develop → Test → Evaluate
    The final system must demonstrate a clear connection between the problem identified in the project, the system requirements, the implemented solution, and the evaluation result.
30. Project Success Criteria
    The project will be considered successful when the completed system can demonstrate that it:
    provides authenticated access to authorised users;
    allows relevant digital marketing campaigns and channels to be managed;
    allows selected performance information to be captured and stored;
    processes defined performance indicators accurately;
    presents performance information through an interactive dashboard;
    allows users to filter and compare performance information;
    displays selected performance trends;
    generates useful performance reports;
    maintains appropriate data integrity and access controls;
    performs its specified functions reliably during testing; and
    provides a practical centralised environment for digital marketing performance monitoring within the educational publishing context.
    Final Product Description
    The final product should be a functional, database-driven web application that transforms digital marketing performance records into organised, accessible, and visual performance information for monitoring and reporting purposes.
    It should provide educational publishing companies with a structured platform through which authorised users can move from:
    Performance Data → Data Processing → Analytics → Dashboard → Monitoring → Reporting
    The system should remain focused on this core purpose throughout development.
