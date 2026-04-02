relational csv starter pack

these csvs are intentionally simple, interrelated, and ready for staged supabase import.

suggested import order:
1) countries
2) states
3) counties
4) addresses
5) roles
6) people
7) partner-stations
8) progress-conditions
9) z-codes
10) people-contactinfo
11) partner-roles
12) people-role-assignments
13) referrals

relationship notes:
- `people-role-assignments` bridges people <-> roles (many-to-many).
- `partner-roles` bridges partner_stations <-> roles (many-to-many).
- `referrals` links a person to a station, z-code, and progress condition.
- location hierarchy is country -> state -> county -> address.
