# Changelog

## 1.0.1

- Ignore '${something} already exists' error. This may happen if rInitial's of two or more services intersect.

## 1.0.0

- Wait for the indices to be created before calling rOnReady.

## 0.1.0

- Rethinkdbdash options: rOptions.
- Ensure certain dbs, tables, indices exist: rInitial.
- Event rOnReady.
