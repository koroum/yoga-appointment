# ASCII Wireframes — yoga-v1

Mobile-first (375px). All screens shown at mobile width unless noted.

---

## 1. Public Instructor Profile  `/instructor/:username`

```
┌─────────────────────────────────┐
│  ≡  YogaBook                    │
├─────────────────────────────────┤
│                                 │
│     ┌─────────────────────┐     │
│     │                     │     │
│     │    [cover photo]    │     │
│     │                     │     │
│     └─────────────────────┘     │
│         ┌───────────┐           │
│         │  [avatar] │           │
│         └───────────┘           │
│                                 │
│     Sarah Johnson               │
│     ✦ Certified Yoga Instructor │
│                                 │
│  ┌─────────────────────────┐    │
│  │  "I believe yoga is..." │    │
│  │  ...bio text here...    │    │
│  └─────────────────────────┘    │
│                                 │
│  ── Photos ──────────────────   │
│  ┌──────┐ ┌──────┐ ┌──────┐    │
│  │ img1 │ │ img2 │ │ img3 │    │
│  └──────┘ └──────┘ └──────┘    │
│                                 │
│  ── Upcoming Classes ────────   │
│  ┌─────────────────────────┐   │
│  │ Morning Flow            │   │
│  │ Mon Mar 9 · 9:00 AM     │   │
│  │ 60 min · 4 spots left   │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ Evening Restore         │   │
│  │ Wed Mar 11 · 6:00 PM    │   │
│  │ 60 min · 1 spot left    │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │   Book a Class / Sign Up│   │
│  └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

---

## 2. Student Signup (via Instructor Profile)

```
┌─────────────────────────────────┐
│  ← Back to Sarah's Profile      │
├─────────────────────────────────┤
│                                 │
│  Create your account            │
│  You'll be linked to Sarah J.   │
│                                 │
│  Full Name                      │
│  ┌─────────────────────────┐   │
│  │                         │   │
│  └─────────────────────────┘   │
│                                 │
│  Email                          │
│  ┌─────────────────────────┐   │
│  │                         │   │
│  └─────────────────────────┘   │
│                                 │
│  Phone                          │
│  ┌─────────────────────────┐   │
│  │                         │   │
│  └─────────────────────────┘   │
│  Verify at least one ↑          │
│                                 │
│  ┌─────────────────────────┐   │
│  │   Create Account        │   │
│  └─────────────────────────┘   │
│                                 │
│  Already have an account?       │
│  Log in →                       │
│                                 │
└─────────────────────────────────┘
```

---

## 3. Student — Browse Classes

```
┌─────────────────────────────────┐
│  ≡  YogaBook        [account ▾] │
├─────────────────────────────────┤
│                                 │
│  Browse Classes                 │
│  With Sarah Johnson             │
│                                 │
│  [List ▪] [Calendar □]          │
│                                 │
│  ── This Week ───────────────   │
│  ┌─────────────────────────┐   │
│  │ Morning Flow            │   │
│  │ Mon Mar 9 · 9:00 AM     │   │
│  │ 60 min · ● 4 of 5 open  │   │
│  │              [Request] →│   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ Evening Restore         │   │
│  │ Wed Mar 11 · 6:00 PM    │   │
│  │ 60 min · ● 8 of 10 open │   │
│  │              [Request] →│   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ Private Session         │   │
│  │ Fri Mar 13 · 10:00 AM   │   │
│  │ 45 min · ● 1 of 1 open  │   │
│  │              [Request] →│   │
│  └─────────────────────────┘   │
│                                 │
│  ── Next Week ───────────────   │
│  ┌─────────────────────────┐   │
│  │ Morning Flow            │   │
│  │ Mon Mar 16 · 9:00 AM    │   │
│  │ 60 min · ● 5 of 5 open  │   │
│  │              [Request] →│   │
│  └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

---

## 4. Student — My Bookings

```
┌─────────────────────────────────┐
│  ≡  YogaBook        [account ▾] │
├─────────────────────────────────┤
│                                 │
│  My Bookings                    │
│                                 │
│  [Upcoming] [Past]              │
│   ────────                      │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Morning Flow            │   │
│  │ Mon Mar 9 · 9:00 AM     │   │
│  │ ● CONFIRMED             │   │
│  │              [Cancel] ↓ │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Evening Restore         │   │
│  │ Wed Mar 11 · 6:00 PM    │   │
│  │ ◌ PENDING               │   │
│  │         Awaiting instructor   │   │
│  │              [Cancel] ↓ │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Private Session         │   │
│  │ Fri Mar 6 · 10:00 AM    │   │
│  │ ✕ CANCELLED             │   │
│  └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

---

## 5. Instructor — Dashboard / Calendar

```
┌─────────────────────────────────┐
│  ≡  YogaBook        [Sarah ▾]   │
├─────────────────────────────────┤
│                                 │
│  Dashboard                      │
│  [◄ Feb]  March 2026  [Apr ►]  │
│                                 │
│  Mo Tu We Th Fr Sa Su           │
│   2  3  4  5  6  7  8           │
│   9 10 11 12 13 14 15           │
│  16 17 18 19 20 21 22           │
│  23 24 25 26 27 28 29           │
│  30 31                          │
│                                 │
│  Legend:                        │
│  ● Available  ◌ Pending         │
│  ▪ Confirmed  ✕ Unavailable     │
│                                 │
│  ── Mon Mar 9 ───────────────   │
│  ┌─────────────────────────┐   │
│  │ 9:00 AM · Morning Flow  │   │
│  │ 3 confirmed · 1 pending │   │
│  │ 1 open of 5             │   │
│  │                [View] → │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ + Add slot              │   │
│  └─────────────────────────┘   │
│                                 │
│  ── Quick Actions ───────────   │
│  [Requests (2)] [Availability]  │
│  [Students]     [Profile]       │
│                                 │
└─────────────────────────────────┘
```

---

## 6. Instructor — Booking Requests

```
┌─────────────────────────────────┐
│  ← Dashboard                   │
├─────────────────────────────────┤
│                                 │
│  Booking Requests (2)           │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Priya Sharma            │   │
│  │ Morning Flow            │   │
│  │ Mon Mar 9 · 9:00 AM     │   │
│  │                         │   │
│  │ [Accept ✓] [Reject ✕]  │   │
│  │ [Propose alternate ↻]   │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Maya Patel              │   │
│  │ Evening Restore         │   │
│  │ Wed Mar 11 · 6:00 PM    │   │
│  │                         │   │
│  │ [Accept ✓] [Reject ✕]  │   │
│  │ [Propose alternate ↻]   │   │
│  └─────────────────────────┘   │
│                                 │
│  ── Cancellation Requests ───   │
│  ┌─────────────────────────┐   │
│  │ ⚠ Late cancellation     │   │
│  │ Anita K · Morning Flow  │   │
│  │ Mon Mar 9 · < 24h away  │   │
│  │                         │   │
│  │ [Accept] [Propose new]  │   │
│  └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

---

## 7. Instructor — Availability Management

```
┌─────────────────────────────────┐
│  ← Dashboard                   │
├─────────────────────────────────┤
│                                 │
│  Manage Availability            │
│                                 │
│  ── Recurring Schedule ──────   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Monday                  │   │
│  │ 9:00 AM · Morning Flow  │   │
│  │ 60 min · max 5          │   │
│  │              [Edit] [✕] │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ Wednesday               │   │
│  │ 6:00 PM · Eve Restore   │   │
│  │ 60 min · max 10         │   │
│  │              [Edit] [✕] │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ Friday                  │   │
│  │ 10:00 AM · Private      │   │
│  │ 45 min · max 1          │   │
│  │              [Edit] [✕] │   │
│  └─────────────────────────┘   │
│                                 │
│  [+ Add recurring slot]         │
│                                 │
│  ── Override Specific Days ──   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Select date:            │   │
│  │ [Mar 23, 2026    ▾]     │   │
│  │ Mark as: [Unavailable ▾]│   │
│  │              [Apply]    │   │
│  └─────────────────────────┘   │
│                                 │
│  Upcoming overrides:            │
│  ✕ Mar 23 · Unavailable  [✕]   │
│  ✕ Apr 4  · Unavailable  [✕]   │
│                                 │
└─────────────────────────────────┘
```

---

## 8. Instructor — Students Roster

```
┌─────────────────────────────────┐
│  ← Dashboard                   │
├─────────────────────────────────┤
│                                 │
│  Students (8)                   │
│                                 │
│  [+ Invite student]             │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Priya Sharma            │   │
│  │ priya@email.com         │   │
│  │ +1 (555) 000-0001       │   │
│  │ Reminders: ON  [toggle] │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ Maya Patel              │   │
│  │ maya@email.com          │   │
│  │ +1 (555) 000-0002       │   │
│  │ Reminders: OFF [toggle] │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ Anita Kumar             │   │
│  │ anita@email.com         │   │
│  │ No phone                │   │
│  │ Reminders: ON  [toggle] │   │
│  └─────────────────────────┘   │
│                                 │
│  ── Failed Notifications ────   │
│  ⚠ 1 notification failed       │
│  Priya S · reminder_28h        │
│  Mar 7 · SMS failed  [Retry]   │
│                                 │
└─────────────────────────────────┘
```

---

## 9. Instructor — Edit Profile

```
┌─────────────────────────────────┐
│  ← Dashboard                   │
├─────────────────────────────────┤
│                                 │
│  Edit Profile                   │
│                                 │
│  Profile URL:                   │
│  yogabook.com/instructor/sarah        │
│  [Copy link]                    │
│                                 │
│  Name                           │
│  ┌─────────────────────────┐   │
│  │ Sarah Johnson           │   │
│  └─────────────────────────┘   │
│                                 │
│  Bio                            │
│  ┌─────────────────────────┐   │
│  │                         │   │
│  │                         │   │
│  └─────────────────────────┘   │
│                                 │
│  My Passion                     │
│  ┌─────────────────────────┐   │
│  │                         │   │
│  └─────────────────────────┘   │
│                                 │
│  Photos                         │
│  ┌──────┐ ┌──────┐ ┌──────┐   │
│  │ img1 │ │ img2 │ │  +   │   │
│  │  [✕] │ │  [✕] │ │      │   │
│  └──────┘ └──────┘ └──────┘   │
│  Max 5MB · auto-compressed      │
│                                 │
│  ┌─────────────────────────┐   │
│  │   Save Profile          │   │
│  └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

---

## 10. Booking Request Flow (Modal)

```
┌─────────────────────────────────┐
│  Request Booking                │
│                              ✕  │
├─────────────────────────────────┤
│                                 │
│  Morning Flow                   │
│  Monday, Mar 9 · 9:00 AM        │
│  60 min · with Sarah Johnson    │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 4 of 5 spots available  │   │
│  └─────────────────────────┘   │
│                                 │
│  Note to instructor (optional)        │
│  ┌─────────────────────────┐   │
│  │                         │   │
│  └─────────────────────────┘   │
│                                 │
│  You will receive an email      │
│  and SMS when confirmed.        │
│                                 │
│  ┌─────────────────────────┐   │
│  │   Send Request          │   │
│  └─────────────────────────┘   │
│  [Cancel]                       │
│                                 │
└─────────────────────────────────┘
```

---

## Status Badge Legend (used across all screens)

```
● AVAILABLE      green
◌ PENDING        yellow
▪ CONFIRMED      blue
✕ UNAVAILABLE    gray
⚠ CANCEL REQ     orange
✓ CANCELLED      red (muted)
```
