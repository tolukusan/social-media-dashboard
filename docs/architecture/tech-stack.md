# Technology Stack

**Version:** 1.0  
**Status:** Approved  
**Phase:** Step 5

| Concern                           | Selected Technology / Approach                           |
| --------------------------------- | -------------------------------------------------------- |
| Runtime                           | Node.js 24 LTS                                           |
| Language                          | TypeScript                                               |
| Frontend                          | Next.js + React                                          |
| Frontend routing                  | Next.js App Router                                       |
| Styling                           | Tailwind CSS                                             |
| Server-state fetching             | TanStack Query                                           |
| Forms                             | React Hook Form                                          |
| Optional client schema validation | Zod                                                      |
| Charts                            | Recharts                                                 |
| Backend                           | NestJS                                                   |
| API                               | REST / JSON                                              |
| API documentation                 | OpenAPI / Swagger                                        |
| Database                          | PostgreSQL 18 baseline                                   |
| ORM                               | Prisma ORM 7                                             |
| Authentication                    | Opaque DB-backed sessions in secure HttpOnly cookies     |
| Authorization                     | Backend RBAC guards/policies                             |
| Repository                        | Git monorepo                                             |
| Workspace                         | pnpm workspaces                                          |
| Reporting                         | Backend-owned PDF generation, rendering library deferred |
| Deployment topology               | Web + API + PostgreSQL, exact hosting deferred           |
| Analytics                         | Backend application services over PostgreSQL             |
| Third-party marketing APIs        | Future scope                                             |

## Selection Principles

The stack is selected for:

- maintainability
- clear separation of concerns
- relational-data strength
- type safety
- straightforward local development
- straightforward testing
- reasonable deployment complexity
- academic demonstrability
- compatibility with future marketing API integrations

## Version Discipline

Major framework/library versions are not upgraded automatically during implementation.

A major upgrade requires:

1. reason for upgrade
2. compatibility review
3. migration impact review
4. full relevant test run
5. explicit approval
