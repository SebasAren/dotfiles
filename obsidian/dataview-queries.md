# Issue Tracker — Dataview Queries

Paste these into any note in your vault to render Kanban-style issue boards.
Each query filters by status and groups by project.

## Backlog

```dataview
TABLE rows.file.link as "Issue", rows.tags as "Tags", rows.created as "Created", rows.blocked-by as "Blocked By"
FROM "issues"
WHERE status = "backlog"
SORT project ASC, created ASC
GROUP BY project
```

## In Progress

```dataview
TABLE rows.file.link as "Issue", rows.tags as "Tags", rows.created as "Created", rows.blocked-by as "Blocked By"
FROM "issues"
WHERE status = "in-progress"
SORT project ASC, created ASC
GROUP BY project
```

## Done

```dataview
TABLE rows.file.link as "Issue", rows.tags as "Tags", rows.created as "Created", rows.blocked-by as "Blocked By"
FROM "issues"
WHERE status = "done"
SORT project ASC, created DESC
GROUP BY project
```

---

## Combined View (All Statuses)

For a single-page overview of all issues sorted by status:

```dataview
TABLE status, project, tags, created, blocked-by as "Blocked By"
FROM "issues"
SORT status ASC, project ASC, created ASC
```

## Issues Blocking Others

Shows issues that have a `blocked-by` set:

```dataview
TABLE project, status, blocked-by as "Blocked By"
FROM "issues"
WHERE blocked-by
SORT project ASC, status ASC
```
