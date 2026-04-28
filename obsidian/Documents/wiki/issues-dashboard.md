# Issues Dashboard

## Backlog

```dataview
TABLE status, project, tags, created
FROM "issues"
WHERE status = "backlog"
SORT project ASC, created ASC
```

## In Progress

```dataview
TABLE status, project, tags, created
FROM "issues"
WHERE status = "in-progress"
SORT project ASC, created ASC
```

## Done

```dataview
TABLE status, project, tags, created
FROM "issues"
WHERE status = "done"
SORT project ASC, created DESC
```

## Blocked

```dataview
TABLE project, status, blocked-by AS "Blocked By"
FROM "issues"
WHERE blocked-by
SORT project ASC, status ASC
```

## By Project

```dataview
TABLE rows.status, rows.tags, rows.created
FROM "issues"
SORT project ASC, created ASC
GROUP BY project
```
