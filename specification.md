# Task Management System --- Implementation Specification

## 1. Project Overview

Build a simple **Task Management System** that allows authenticated
users to manage their own personal tasks.

The application must provide:

-   User registration
-   User login
-   JWT-based authentication
-   Logout
-   Protected task pages/routes
-   Task CRUD
-   Task status filtering
-   Responsive and clean UX
-   RESTful backend API

Each user's tasks must be private to that user. Tasks must not be shared
between users.

------------------------------------------------------------------------

## 2. Required Technology Stack

The implementation must follow the required stack from the technical
test.

  Area                Requirement
  ------------------- --------------------------------------------------------
  Backend             Node.js
  Backend Framework   Express.js recommended
  Frontend            Vue 3, Pinia state management
  Database            MySQL
  Authentication      JWT
  Password Security   bcrypt password hashing
  CSS/UI              Tailwind CSS, or vanilla CSS

### Frontend Requirements

If using Vue:

-   Use Vue 3.
-   Vuetify.
-   Composition API is recommended.

### Important Restriction

Do not use a full boilerplate that already provides ready-made
authentication and CRUD functionality.

Standard libraries such as Express, Mongoose, Axios, etc. are allowed.

------------------------------------------------------------------------

# 3. Functional Requirements

## 3.1 User Authentication

### Register

Provide a registration form containing:

-   Name
-   Email
-   Password

The backend must create a new user and securely hash the password using
bcrypt with refresh tokens.

### Login

Provide a login form containing:

-   Email
-   Password

On successful authentication:

1.  Validate the credentials.
2.  Generate a JWT.
3.  Return the JWT to the frontend.
4.  Store the authentication state/token on the client.
5.  Redirect the user to the task management page.

### Logout

The user must be able to log out.

Logout must remove the client-side authentication token/state.

### Route Protection

Only authenticated users may access the task management page.

The backend must also protect task API endpoints using JWT verification
middleware.

If the JWT is missing, invalid, or expired:

-   Reject the protected API request.
-   The frontend must handle the authentication error appropriately.

------------------------------------------------------------------------

# 4. Task Management

Each task belongs to exactly one user.

There must be no task sharing between users.

## 4.1 Task Attributes

The task entity must contain:

  Field           Type / Requirement                 Required
  --------------- ---------------------------------- ----------
  `id`            Auto-generated identifier          Yes
  `title`         String                             Yes
  `description`   Text                               No
  `status`        `pending`, `in-progress`, `done`   Yes
  `deadline`      Date                               No
  `user_id`       Relation to user                   Yes

The exact database implementation depends on whether MySQL or MongoDB is
selected.

### MySQL

Provide either:

-   `schema.sql`, or
-   database migrations.

------------------------------------------------------------------------

# 5. Task CRUD

## 5.1 Create Task

Provide a form for creating a new task.

Required input:

-   Title

Optional input:

-   Description
-   Deadline

Status must support:

-   `pending`
-   `in-progress`
-   `done`

The newly created task must belong to the currently authenticated user.

------------------------------------------------------------------------

## 5.2 Read Tasks

Display all tasks belonging to the currently authenticated user.

The API must never return another user's tasks.

The frontend must display the task list after successful login.

------------------------------------------------------------------------

## 5.3 Update Task

Allow the authenticated user to edit:

-   Title
-   Description
-   Status
-   Deadline

The user must only be able to update their own tasks.

------------------------------------------------------------------------

## 5.4 Delete Task

Allow the authenticated user to delete their own task.

Before deletion, display a simple confirmation.

The user must not be able to delete another user's task.

------------------------------------------------------------------------

# 6. Task Status Filter

The task list must provide a filter using buttons, tabs, or a select
component.

Supported filters:

-   All
-   Pending
-   In Progress
-   Done

The backend API must support status filtering through a query parameter.

Example:

``` http
GET /api/tasks?status=pending
```

When no status is supplied, return all tasks belonging to the
authenticated user.

------------------------------------------------------------------------

# 7. REST API

The backend must expose at least the following endpoints.

## Authentication

``` http
POST /api/auth/register
POST /api/auth/login
```

## Tasks

``` http
GET    /api/tasks
POST   /api/tasks
PUT    /api/tasks/:id
DELETE /api/tasks/:id
```

### Task Filtering

``` http
GET /api/tasks?status=pending
GET /api/tasks?status=in-progress
GET /api/tasks?status=done
```

Without the query parameter:

``` http
GET /api/tasks
```

returns all tasks owned by the authenticated user.

------------------------------------------------------------------------

# 8. Authentication Middleware

Implement JWT verification middleware for protected endpoints.

The middleware must:

1.  Read the JWT from the request.
2.  Verify the token.
3.  Determine the authenticated user.
4.  Make the authenticated user available to the request handler.
5.  Reject unauthorized requests.

The following endpoints require authentication:

``` text
GET    /api/tasks
POST   /api/tasks
PUT    /api/tasks/:id
DELETE /api/tasks/:id
```

Registration and login do not require an existing JWT.

------------------------------------------------------------------------

# 9. Data Ownership and Authorization

This is a critical requirement.

A user must only be able to access their own tasks.

For every task operation:

``` text
Authenticated User
        |
        v
JWT Verification
        |
        v
Get User ID
        |
        v
Find/Modify Task
        |
        v
Verify Task Belongs to User
```

The implementation must prevent users from manipulating tasks belonging
to another user by changing the task ID in the request.

For example:

``` http
PUT /api/tasks/123
DELETE /api/tasks/123
```

must verify that task `123` belongs to the authenticated user before
modifying or deleting it.

------------------------------------------------------------------------

# 10. Frontend Pages

The frontend must contain at least the following pages.

## 10.1 Login Page

Required:

-   Email input
-   Password input
-   Login button
-   Validation/error feedback
-   Navigation to registration

------------------------------------------------------------------------

## 10.2 Register Page

Required:

-   Name input
-   Email input
-   Password input
-   Register button
-   Validation/error feedback
-   Navigation to login

------------------------------------------------------------------------

## 10.3 Task Management Page

The main authenticated page must provide:

-   Task list
-   Status filter
-   Add task button
-   Edit action
-   Delete action
-   Logout button

Each task should display relevant information such as:

-   Title
-   Description
-   Status
-   Deadline

------------------------------------------------------------------------

# 11. Add/Edit Task Form

The task form may be implemented as:

-   Modal, or
-   Separate page

The form must support:

``` text
Title
Description
Status
Deadline
```

For creation, title is mandatory.

For editing, the existing task values must be populated into the form.

------------------------------------------------------------------------

# 12. Validation

## Backend Validation

Backend validation is listed as an additional-value feature, but it is
strongly recommended.

At minimum, validate:

-   Required title
-   Valid deadline format
-   Valid status value
-   Required registration fields
-   Valid email format where applicable

The backend must never rely exclusively on frontend validation.

## Frontend Validation

Provide user-friendly validation feedback for invalid input.

Examples:

-   Empty required title
-   Invalid email
-   Missing password
-   Invalid deadline

------------------------------------------------------------------------

# 13. Error Handling

The frontend must handle common API errors, including:

-   Invalid login credentials
-   Validation failure
-   Unauthorized request
-   Expired JWT
-   Failed task creation
-   Failed task update
-   Failed task deletion
-   Failed task retrieval

When authentication is no longer valid, the frontend should clear the
authentication state and prevent access to protected task functionality.

------------------------------------------------------------------------

# 14. Responsive UX

The UI does not need to be highly artistic.

Priority:

1.  Functional
2.  Clean
3.  Easy to understand
4.  Responsive

The application must work reasonably on desktop and smaller screen
sizes.

Any of the following may be used:

-   Tailwind CSS
-   Vanilla CSS
-   Another appropriate styling approach

------------------------------------------------------------------------

# 15. Suggested Project Structure

The repository must contain both backend and frontend.

Recommended structure:

``` text
task-management-system/
├── backend/
│   ├── src/
│   ├── package.json
│   ├── .env.example
│   └── ...
│
├── frontend/
│   ├── src/
│   ├── package.json
│   └── ...
│
├── README.md
└── .gitignore
```

A monorepo is allowed as long as the backend and frontend structure is
clear.

------------------------------------------------------------------------

# 16. Environment Configuration

Backend configuration must use environment variables.

Provide:

``` text
.env.example
```

Do not commit real secrets.

The `.gitignore` must exclude at minimum:

``` text
node_modules/
.env
```

Also ignore other sensitive files when applicable.

------------------------------------------------------------------------

# 17. Database Requirements

## MySQL Option

If MySQL is selected:

-   Define the user structure.
-   Define the task structure.
-   Define the relationship between users and tasks.
-   Provide `schema.sql` or migrations.

Conceptually:

``` text
users
  |
  | 1:N
  |
tasks
```

A task must contain a reference to its owner.

## MongoDB Option

If MongoDB is selected:

-   Create a User model.
-   Create a Task model.
-   Store the task owner relationship.
-   Use Mongoose.

------------------------------------------------------------------------

# 18. Additional Features --- Bonus

The following features are optional and can be implemented if time
permits.

## 18.1 Task Search

Allow users to search tasks by title.

Possible implementations:

-   Live search
-   Search button

------------------------------------------------------------------------

## 18.2 Pagination

Implement either:

-   Pagination, or
-   Infinite scroll
-   make each users has 20 to 30 tasks, total users = 12

for the task list.

------------------------------------------------------------------------

## 18.3 API Documentation

Provide API documentation using either:

-   Postman Collection
-   Swagger/OpenAPI

------------------------------------------------------------------------

## 18.4 Unit Test

Provide at least one simple test for:

-   An API endpoint, or
-   A frontend component

------------------------------------------------------------------------

## 18.5 Docker Support

Provide Docker support for:

-   Backend
-   Frontend
-   Database

A `docker-compose` configuration may be used to run the application and
database.

------------------------------------------------------------------------

## 18.6 Deployment

Deployment to a free platform is optional.

Examples mentioned in the test:

-   Render
-   Railway
-   Vercel for frontend with backend hosted separately

------------------------------------------------------------------------

# 19. API Documentation Expectations

At minimum, document:

  Endpoint               Method   Auth   Purpose
  ---------------------- -------- ------ --------------------------
  `/api/auth/register`   POST     No     Register user
  `/api/auth/login`      POST     No     Authenticate user
  `/api/tasks`           GET      Yes    Get current user's tasks
  `/api/tasks`           POST     Yes    Create task
  `/api/tasks/:id`       PUT      Yes    Update own task
  `/api/tasks/:id`       DELETE   Yes    Delete own task

Also document the status filter:

``` http
GET /api/tasks?status=pending
```

------------------------------------------------------------------------

# 20. README Requirements

The repository must include a `README.md`.

The README must contain:

## Application Description

Briefly explain what the application does.

## Backend Setup

Document:

-   Required Node.js version, if applicable
-   Dependency installation
-   Database setup
-   Environment variables
-   How to start the backend

## Frontend Setup

Document:

-   Dependency installation
-   Environment configuration, if applicable
-   How to start the frontend

## Database Setup

Explain how to:

-   Create the database, if MySQL is selected.
-   Apply schema/migrations, if applicable.
-   Configure MongoDB, if MongoDB is selected.

## Screenshots

Screenshots are optional but recommended.

## API Documentation

Provide the documentation location if Postman or Swagger/OpenAPI is
implemented.

------------------------------------------------------------------------

# 21. Deliverables

The final submission must contain:

-   Public GitHub or GitLab repository
-   `README.md`
-   Backend source code
-   Frontend source code
-   Database schema/migration/model
-   `.env.example`
-   `.gitignore`


Submit:

``` text
Repository URL
```

------------------------------------------------------------------------

# 22. Demo Video Checklist

The demo video should demonstrate the implemented functionality.

Recommended demonstration flow:

1.  Show the application.
2.  Register a new account.
3.  Log in.
4.  Show the protected task page.
5.  Create a task.
6.  Create tasks with different statuses.
7.  Filter tasks by status.
8.  Edit a task.
9.  Delete a task.
10. Log out.
11. Demonstrate that protected functionality is no longer accessible.
12. Briefly explain the project structure and technology choices.
13. If bonus features were implemented, demonstrate them.

The video must not exceed 15 minutes.

------------------------------------------------------------------------

# 23. Acceptance Criteria

The implementation is considered complete when all of the following are
satisfied.

## Authentication

-   [ ] User can register with name, email, and password.
-   [ ] Password is hashed using bcrypt.
-   [ ] User can log in with email and password.
-   [ ] Successful login returns a JWT.
-   [ ] Client stores authentication state/token.
-   [ ] User can log out.
-   [ ] Logout removes the client authentication state/token.
-   [ ] Protected task pages cannot be accessed by unauthenticated
    users.
-   [ ] Protected task API endpoints require valid JWT authentication.

## Task Management

-   [ ] User can create a task.
-   [ ] Task title is required.
-   [ ] User can view their own tasks.
-   [ ] User can edit task title.
-   [ ] User can edit task description.
-   [ ] User can edit task status.
-   [ ] User can edit task deadline.
-   [ ] User can delete a task.
-   [ ] Delete requires simple confirmation.
-   [ ] A task belongs to exactly one user.
-   [ ] Users cannot access another user's tasks.

## Status Filtering

-   [ ] User can view all tasks.
-   [ ] User can filter `pending`.
-   [ ] User can filter `in-progress`.
-   [ ] User can filter `done`.
-   [ ] Backend supports `?status=...`.

## Frontend

-   [ ] Login page exists.
-   [ ] Register page exists.
-   [ ] Task list page exists.
-   [ ] Add task functionality exists.
-   [ ] Edit task functionality exists.
-   [ ] Delete task functionality exists.
-   [ ] Logout button exists.
-   [ ] Error states are handled.
-   [ ] UI is responsive.
-   [ ] UI is functional and clean.

## Backend

-   [ ] RESTful API is implemented.
-   [ ] JWT middleware is implemented.
-   [ ] Database connection works.
-   [ ] Database schema/model is included.
-   [ ] `.env.example` exists.
-   [ ] Sensitive files are ignored by Git.

## Documentation

-   [ ] README exists.
-   [ ] Backend setup is documented.
-   [ ] Frontend setup is documented.
-   [ ] Database setup is documented.
-   [ ] Environment variables are documented.
-   [ ] Repository can be run locally without errors.

------------------------------------------------------------------------

# 24. Quality Priorities

When implementation time is limited, prioritize the requirements in this
order:

1.  Application runs successfully.
2.  Authentication works.
3.  JWT route protection works.
4.  User/task ownership is enforced.
5.  Task CRUD works.
6.  Status filtering works.
7.  Frontend error handling works.
8.  Responsive and clean UI.
9.  README and setup documentation.
10. Bonus features.

The technical test explicitly states that running successfully in the
local environment is the highest priority.

------------------------------------------------------------------------

# 25. Final Implementation Rule

Do not over-engineer the application.

The target is a clean, functional Task Management System that
demonstrates:

-   Fullstack development ability
-   REST API design
-   Authentication
-   Database relationships
-   Authorization
-   CRUD implementation
-   Frontend state handling
-   Basic UX
-   Error handling
-   Project documentation

Implement the required MVP first. Only implement bonus features after
the complete MVP is stable.
