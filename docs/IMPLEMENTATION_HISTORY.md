# Implementation history and report continuity

Wrapchik is the same campus food-ordering project described in the submitted Software Engineering mid-term report. Keep that report as the authoritative description of the mid-term snapshot. Do not backdate end-term additions or present current-code features as mid-term work unless the submitted report explicitly includes them.

## Mid-term implementation

The submitted report is not stored in this repository, so this document does not reconstruct its feature list or claim historical implementation dates.

## Post-mid-term and final code

The current repository contains the original React Native/Expo, Express, MongoDB/Mongoose, and three-tier client-server foundation, together with later code for email OTP, server-verified Google identity, cash and outlet-verified UPI checkout, live order updates, coupons, scheduled pickup, support, administration, and group ordering. After the mid-term submission, group ordering was extended with server-priced shared-order checkout, per-member item snapshots, integer-paise contribution allocation, explicit host-pays behavior, admin verification of UPI/cash contributions, and reconciliation against the single saved order total. These additions are end-term work and must not be backdated into the mid-term report.

This section describes current code capabilities; it does not assert when each feature was added. Update it only from reviewed code and project records, and keep mid-term claims separate from end-term implementation results.
