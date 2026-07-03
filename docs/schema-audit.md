# Schema Audit Checklist

## Purpose

Confirm the current Supabase tables before adding real data-backed employee hub modules.

## Current Tables To Confirm

### user_profiles

Current app expects:

- id
- full_name
- email
- role
- status
- home_store_id
- must_reset_password

Checklist:

- [ ] Table exists in production.
- [ ] Columns match app expectations.
- [ ] Role values match frontend types.
- [ ] Status values match frontend types.
- [ ] Store relationship is clear.

### stores

Current app expects:

- id
- ace_store_number
- pos_store_number
- store_name
- email
- address_line1
- address_line2
- city
- state
- postal_code
- country
- date_opened
- sort_order
- timezone
- status

Checklist:

- [ ] Table exists in production.
- [ ] Columns match app expectations.
- [ ] All four Skye ACE stores exist.
- [ ] ACE and POS store numbers are populated.
- [ ] Store soft delete behavior is confirmed.

### user_store_access

Current docs reference:

- id
- user_id
- store_id
- assigned_by
- created_at

Checklist:

- [ ] Table exists in production.
- [ ] Intended use is clear.
- [ ] Relationship to home_store_id is clear.
- [ ] Multi-store access behavior is clear.

## New Modules Need Models

Before building database-backed modules, define models for:

- communications
- documents
- media
- tasks
- department walks
- departments

## Required Policy Review

Confirm access rules for:

- admins
- managers
- department leads
- employees
- future public pages

## Current Decision

Do not add new migrations until this audit is complete.