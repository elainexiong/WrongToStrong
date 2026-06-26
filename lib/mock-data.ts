export type ReviewResult = "Correct" | "Wrong again" | "Still slow" | "Needs review";

export type Question = {
  id: string;
  reviewId?: string;
  screenshotPath?: string;
  screenshotUrl?: string;
  testType?: string;
  topic: string;
  subtopic?: string;
  errorType: string;
  correctAnswer: string;
  source?: string;
  testName?: string;
  section?: string;
  questionNumber?: string;
  loggedAt?: string;
  loggedDate: string;
  nextReview: string;
  reviewDueDate?: string;
  reviewRound: string;
  reviewTiming?: string;
  status: string;
  timeSpent?: string;
  correctStrategy?: string;
  notes?: string;
  screenshotLabel: string;
};

export const student = {
  name: "Demo Student",
  test: "SAT Math",
  firstReviewDelayDays: 10,
  secondReviewDelayDays: 20
};

export const metrics = [
  { label: "Accuracy", value: "72%", delta: "+6%", tone: "green" },
  { label: "Questions Logged", value: "84", delta: "+12", tone: "blue" },
  { label: "Reviews Completed", value: "39", delta: "+8", tone: "green" },
  { label: "Study Time", value: "11.5h", delta: "+2.1h", tone: "amber" }
];

export const domainProgress = [
  { label: "Algebra", value: 68, change: "+8%" },
  { label: "Advanced Math", value: 54, change: "+4%" },
  { label: "Problem-Solving & Data Analysis", value: 76, change: "+11%" },
  { label: "Geometry & Trigonometry", value: 61, change: "+5%" }
];

export const reviewQueue = [
  { label: "Due today", value: "6", tone: "blue" },
  { label: "Overdue", value: "2", tone: "coral" },
  { label: "Upcoming this week", value: "14", tone: "green" },
  { label: "Next review", value: "Tomorrow", tone: "neutral" }
];

export const weakTopics = [
  { label: "Linear equations", detail: "Algebra", missRate: 42 },
  { label: "Quadratics", detail: "Advanced Math", missRate: 38 },
  { label: "Percent", detail: "Problem-Solving", missRate: 31 },
  { label: "Circles", detail: "Geometry", missRate: 27 }
];

export const errorTypes = [
  { label: "Concept gap", value: 31 },
  { label: "Careless calculation", value: 24 },
  { label: "Wrong setup", value: 18 },
  { label: "Misread question", value: 14 },
  { label: "Too slow", value: 9 },
  { label: "Other", value: 4 }
];

export const reviewOutcomes = [
  { label: "Correct", value: 24, tone: "green" },
  { label: "Wrong again", value: 7, tone: "coral" },
  { label: "Still slow", value: 5, tone: "amber" },
  { label: "Needs review", value: 3, tone: "blue" }
];

export const questions: Question[] = [
  {
    id: "q-184",
    topic: "Algebra",
    subtopic: "Linear equations",
    testType: "SAT",
    errorType: "Wrong setup",
    correctAnswer: "B",
    source: "Bluebook",
    testName: "Practice Test 1",
    section: "Math Module 2",
    questionNumber: "18",
    loggedDate: "Jun 12",
    nextReview: "Today",
    reviewRound: "Review 1",
    status: "Due",
    timeSpent: "3m 20s",
    correctStrategy: "Define x before substituting values; isolate constants first.",
    notes: "Mistook the rate expression for the final answer.",
    screenshotLabel: "linear equation"
  },
  {
    id: "q-173",
    topic: "Advanced Math",
    subtopic: "Quadratics",
    testType: "SAT",
    errorType: "Concept gap",
    correctAnswer: "4",
    source: "Khan Academy",
    testName: "Practice Set",
    loggedDate: "Jun 7",
    nextReview: "Jun 27",
    reviewRound: "Review 2",
    status: "Scheduled",
    timeSpent: "4m 05s",
    correctStrategy: "Check vertex form before expanding.",
    notes: "First review correct, kept second review for confidence.",
    screenshotLabel: "quadratic graph"
  },
  {
    id: "q-161",
    topic: "Problem-Solving & Data Analysis",
    subtopic: "Percent",
    testType: "SAT",
    errorType: "Careless calculation",
    correctAnswer: "C",
    source: "College Board Question Bank",
    loggedDate: "May 31",
    nextReview: "Tomorrow",
    reviewRound: "Review 3",
    status: "Next review required",
    timeSpent: "2m 10s",
    correctStrategy: "Convert percent change to multiplier before comparing.",
    notes: "Wrong again on Review 2, so follow-up is required.",
    screenshotLabel: "percent table"
  },
  {
    id: "q-149",
    topic: "Geometry & Trigonometry",
    subtopic: "Circles",
    testType: "SAT",
    errorType: "Misread question",
    correctAnswer: "12",
    source: "Book",
    testName: "Chapter 9",
    section: "Practice Set",
    questionNumber: "12",
    loggedDate: "May 24",
    nextReview: "-",
    reviewRound: "Done",
    status: "Done",
    timeSpent: "2m 45s",
    correctStrategy: "Underline whether the question asks for diameter, radius, or area.",
    screenshotLabel: "circle diagram"
  }
];

export const recentActivity = [
  "Logged Algebra / Linear equations from Bluebook",
  "Completed Review 1 for Quadratics",
  "Scheduled required follow-up for Percent"
];

export const sourceMix = [
  { label: "Bluebook", value: 34 },
  { label: "Khan Academy", value: 26 },
  { label: "Question Bank", value: 21 },
  { label: "Book", value: 12 },
  { label: "Other", value: 7 }
];
