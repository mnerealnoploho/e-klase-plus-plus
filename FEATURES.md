# Website inventory and implementation scope

Version 0.2 uses the original family portal as the main interface. The companion-handling column below describes the earlier 0.1 implementation inventory; it is retained as a record of what was inspected. The original website, rather than that old report picker, now handles account screens. Real account sign-in and end-to-end compatibility still require verification on the test host.

Inspected in the authorized family portal on 2026-11-10. No account values or personal identifiers are included.

| Area | Observed website features | Companion handling |
| --- | --- | --- |
| Home | Evaluations, teacher remarks, behavior entries, absences, lessons, homework, school news | Read-only routes, snapshots, personal plans |
| Diary | Week navigation, dates, rooms, topics, homework, attachments, lesson times, download control | Diary renderer and structured responses; personal Calendar export |
| Homework | Upcoming tasks, attachments, task links | Read-only list/detail routes; separate personal plans |
| Tests | Future tests by month and subject | Read-only schedule route; study planning |
| Rankings | Class and parallel-class comparisons, grade/percentage views, subject filters, semester/year/custom periods, class average, rank | Experimental read route; separate calibrated chart calculator |
| Journals | Subjects, teachers, period filters, grade/percentage averages, class comparisons, attendance, lesson rows | Experimental journal routes; snapshots |
| Assessment | Timestamps, task points, task ranks, averages, thresholds, totals, percentages, test rank | Experimental evaluation/test-report routes |
| Attendance | Statistics, justified/unjustified breakdown, dated excuses | Experimental read-only routes |
| Report card | Period selection and report generation | Official website |
| Communication | Inbox, unread, important, deleted, drafts, sent, compose, author filtering, surveys, video | Read-only explorer; official site for changes |
| Profile | Username, phone, email, password, family, notifications, subscription | Official site for changes |
| Appearance | Light, dark, high contrast, system | Independent appearance controls |
| Notifications | SMS, email, official mobile push settings | Calendar exports for personal reminders |

The historical endpoint catalog references public September 2026 research. Version 0.2 no longer uses that catalog or the removed form-parsing adapter for login. The original client runs through the restricted proxy; a successful real account login is still required before claiming complete compatibility.
