# House Listings Demo Checklist

Use this quick runbook before demos to validate end-to-end house listing flows.

## 1. Admin: Create Listing
- Open `recampus-admin` and login as admin.
- Go to `House Listings`.
- Create a listing with title, rent, location, owner name, owner phone.
- Upload 1-3 images and publish.
- Expected: success alert and new row appears in `Listed Houses Management`.

## 2. Admin: Search, Filter, Pagination
- Search by title, owner name, phone, and location.
- Switch filter: `All`, `Live`, `Hidden`, `Archived`.
- Move through pages using `Prev/Next`.
- Expected: results, counts, and pages update correctly.

## 3. Admin: Edit Listing Modal
- Click edit icon for any house row.
- Update details and save.
- Optional: replace images in modal.
- Expected: row data refreshes with updated values.

## 4. Admin: Archive and Restore
- Click archive (trash) icon for a live listing.
- Confirm archive action.
- Check `Archived` filter and verify listing is present there.
- Click restore icon.
- Expected: listing returns to live list and appears on user website.

## 5. User: Browse Houses
- Login to user app and open `Home Renting`.
- Verify archived listings are NOT visible.
- Verify restored/live listings are visible.

## 6. User: Like + Unlock Payment Simulation
- Like/unlike a listing and verify counter updates.
- Click unlock and complete simulated payment.
- Expected: owner phone unlocks, wallet balance reduces, payment success shown.

## 7. Admin: Revenue Verification
- Return to admin `House Listings`.
- Check `House Unlock Payments` cards and table update.
- Check `Money Got` column for listing-level earnings.

## 8. Guardrails / Validation
- Try invalid owner phone (non 10-15 digits) while create/edit.
- Try invalid rent (0 or negative).
- Expected: backend returns validation message and no save occurs.

## 9. Build Verification
- Run `npm run build` in `recampus-admin`.
- Run `npm run build` in `frontend`.
- Expected: both builds complete successfully.
