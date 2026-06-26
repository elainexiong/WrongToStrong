# WrongToStrong Product Decisions

WrongToStrong is a student-owned error-log app for standardized test prep. The first version is built around delayed recall: students log wrong questions when they find them, then review after enough time has passed for memory to fade.

## User Model

- Each student registers and logs in with their own account.
- Each student uploads and manages only their own questions.
- Each student configures their own review windows.
- Parent/guardian sharing is not part of the MVP. It can be added later with a linking table.

## Error Log Fields

Required:

- Student
- Test type
- Screenshot upload
- Topic
- Subtopic
- Error type

Optional:

- Source
- Test name
- Section/module
- Question number
- Time spent
- Correct strategy
- Notes

Removed from MVP:

- Priority
- Difficulty
- Why missed

## Review Rules

Default review windows:

- Review 1: 10 days after logging
- Review 2: 20 days after logging

Each student can change these defaults in Review Settings.

Review result rules:

- Correct: student may stop or keep the next review.
- Wrong again, still slow, or needs review: next review is required.
- If a later review fails, the app schedules another round.

## UI Structure

- Dashboard: progress, review queue, weak topics, error patterns, recent activity.
- Add Error: screenshot upload and simple required/optional fields.
- Question Bank: filter, inspect, and edit logged questions.
- Reviews: daily review workflow and result marking.
- Analytics: topic patterns and review effectiveness.
- Review Settings: per-student review windows and review rules.
