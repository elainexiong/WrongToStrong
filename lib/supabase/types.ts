export type StudentProfile = {
  id: string;
  display_name: string;
  first_review_delay_days: number;
  second_review_delay_days: number;
  created_at: string;
  updated_at: string;
};

export type DbQuestion = {
  id: string;
  student_id: string;
  test_type: "SAT" | "ACT" | "SSAT" | "AP" | "AMC" | "Custom";
  source: string | null;
  test_name: string | null;
  section_module: string | null;
  question_number: string | null;
  screenshot_path: string;
  topic: string;
  subtopic: string | null;
  error_type: string;
  correct_answer: string;
  time_spent_seconds: number | null;
  correct_strategy: string | null;
  notes: string | null;
  logged_at: string;
  created_at: string;
  updated_at: string;
};

export type DbReview = {
  id: string;
  student_id: string;
  question_id: string;
  review_round: number;
  due_date: string;
  status: "scheduled" | "completed" | "canceled";
  result: "correct" | "wrong_again" | "still_slow" | "needs_review" | "skipped" | null;
  completed_at: string | null;
  keep_next_review: boolean | null;
  created_at: string;
  updated_at: string;
};

export type AdminStudentSummary = {
  student_id: string;
  email: string;
  display_name: string;
  created_at: string;
  total_questions: number;
  due_reviews: number;
  done_questions: number;
  last_logged_at: string | null;
  category_counts: Record<string, number>;
};
