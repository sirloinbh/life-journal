# Translate the remaining Korean screen text to English (#236)

## Purpose

User requirement of 2026-11-26: no Korean text on any screen (project-standards#1129 makes the central check strict once every app is clean).

## Findings

- A search for Hangul in `frontend/src`, `backend/src`, `database`, `shared` and `e2e`, excluding tests, found none: labels, messages, placeholders, empty states, server errors, seed terms and the page language (`lang="en"`) are already English. Dates use `en-US`/`en-CA` formats; the only non-English character on screen is the won sign in prices (`₩12,500`), which is a currency symbol.
- Korean text remains only in tests (sample user data such as titles) and in the central managed files (`.standards/`, one line in `AGENTS.md`), which this repo does not edit.

## Changes

- `frontend/src/english-only.test.ts` fails when a non-test frontend or backend source file gets a Hangul letter, so the screens stay English.

## Verification

- `npm run check`: see the PR.
