# Frontend Architecture

## Folders

- `app/`: Next.js App Router entrypoints, route groups, layouts, boundaries, and pages.
- `features/`: Product feature modules (`auth`, `workspace`, `repository`, `chat`, `settings`) with colocated components/hooks/services/types/schemas.
- `shared/`: Cross-feature reusable UI and behavioral primitives.
- `entities/`: Domain entity contracts shared by features and API layer.
- `widgets/`: Composed UI blocks (app shell, navigation, menus) built from `shared` + `features`.
- `lib/`: Framework-agnostic utilities and API integration layer.
- `hooks/`: Global reusable hooks used across features/widgets.
- `providers/`: Root providers and application contexts (theme, auth, query).
- `styles/`: Design tokens and global style primitives.

## Scalability Principles

- Feature-first module boundaries keep business logic isolated and easy to extend.
- Shared primitives remove duplicated UI logic and keep interaction patterns consistent.
- API access is centralized in `lib/api` to enforce transport consistency and token handling.
- Entity contracts provide a stable typed foundation between API client and UI.
- Widgets compose reusable navigation/layout blocks to keep route files thin.
