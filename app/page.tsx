"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  BarChart3,
  BookOpenCheck,
  CalendarCheck,
  ChevronDown,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Plus,
  Search,
  SlidersHorizontal,
  Upload
} from "lucide-react";
import clsx from "clsx";
import {
  type Question,
  domainProgress,
  errorTypes,
  metrics,
  questions,
  recentActivity,
  reviewOutcomes,
  reviewQueue,
  sourceMix,
  student as demoStudent,
  weakTopics
} from "@/lib/mock-data";
import { reviewRuleSummary } from "@/lib/review-rules";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { DbQuestion, DbReview, StudentProfile } from "@/lib/supabase/types";
import type { User } from "@supabase/supabase-js";

type Screen = "dashboard" | "add" | "bank" | "reviews" | "analytics" | "settings";
type DateRange = "7 days" | "30 days" | "90 days";
type ReviewSettings = {
  firstReviewDelayDays: number;
  secondReviewDelayDays: number;
};
type DashboardMetric = {
  label: string;
  value: string;
  delta: string;
  tone: string;
};
type ProgressStat = {
  label: string;
  value: number;
  change?: string;
  missRate?: number;
};
type QueueStat = {
  label: string;
  value: string;
  tone: string;
};
type AddQuestionPayload = {
  file: File | null;
  form: {
    testType: string;
    topic: string;
    subtopic: string;
    errorType: string;
    correctAnswer: string;
    source: string;
    testName: string;
    sectionModule: string;
    questionNumber: string;
    timeSpent: string;
    correctStrategy: string;
    notes: string;
  };
};
type LastQuestionSelections = Pick<AddQuestionPayload["form"], "testType" | "sectionModule" | "topic" | "subtopic">;

const emptyQuestion: Question = {
  id: "",
  topic: "No question selected",
  subtopic: "Add or select a logged question",
  errorType: "Not set",
  correctAnswer: "",
  loggedDate: "-",
  nextReview: "-",
  reviewRound: "-",
  status: "-",
  screenshotLabel: "empty"
};

const defaultReviewSettings: ReviewSettings = {
  firstReviewDelayDays: 10,
  secondReviewDelayDays: 20
};

const BOOT_TIMEOUT_MS = 30000;
const DATA_TIMEOUT_MS = 30000;
const LAST_ADD_SELECTIONS_STORAGE_PREFIX = "wrong-to-strong:last-add-selections";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "add", label: "Add Question", icon: Plus, featured: true },
  { id: "bank", label: "Question Bank", icon: ClipboardList, featured: true },
  { id: "reviews", label: "Reviews", icon: CalendarCheck },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Review Settings", icon: SlidersHorizontal }
] satisfies Array<{ id: Screen; label: string; icon: typeof LayoutDashboard; featured?: boolean }>;

const testTypeOptions = ["SAT", "ACT", "SSAT", "AP", "AMC", "Custom"];
const sectionOptions = [
  "Math",
  "Reading & Writing",
  "English",
  "Reading",
  "Science",
  "Quantitative",
  "Verbal",
  "Custom"
];
const mathCategories = [
  "Algebra",
  "Advanced Math",
  "Geometry & Trigonometry",
  "Data Analysis",
  "Number Sense",
  "Word Problems"
];
const readingCategories = [
  "Reading Comprehension",
  "Vocabulary in Context",
  "Inference",
  "Main Idea",
  "Evidence Support",
  "Author Purpose",
  "Text Structure"
];
const writingCategories = [
  "Grammar",
  "Punctuation",
  "Sentence Structure",
  "Transitions",
  "Rhetorical Skills",
  "Organization",
  "Style & Tone"
];
const scienceCategories = [
  "Science Reasoning",
  "Data Interpretation",
  "Experimental Design",
  "Conflicting Viewpoints"
];
const categoryOptionsBySection: Record<string, string[]> = {
  Math: mathCategories,
  Quantitative: mathCategories,
  "Reading & Writing": [...readingCategories, ...writingCategories],
  English: writingCategories,
  Reading: readingCategories,
  Verbal: ["Vocabulary in Context", "Sentence Completion", "Analogies", "Reading Comprehension"],
  Science: scienceCategories,
  Custom: ["Other"]
};
const subcategoryOptionsByCategory: Record<string, string[]> = {
  Algebra: ["Linear equations", "Systems of equations", "Inequalities", "Functions", "Exponents", "Expressions"],
  "Advanced Math": ["Quadratics", "Polynomials", "Rational expressions", "Exponential functions", "Nonlinear equations"],
  "Geometry & Trigonometry": ["Triangles", "Circles", "Angles", "Area and volume", "Coordinate geometry", "Right-triangle trig"],
  "Data Analysis": ["Percent", "Ratios and proportions", "Probability", "Tables", "Scatterplots", "Mean/median"],
  "Number Sense": ["Fractions", "Decimals", "Integer properties", "Units", "Estimation"],
  "Word Problems": ["Rates", "Work problems", "Mixtures", "Multi-step translation"],
  Grammar: ["Subject-verb agreement", "Pronouns", "Verb tense", "Modifiers", "Parallel structure"],
  Punctuation: ["Commas", "Semicolons", "Colons", "Apostrophes", "Dashes"],
  "Sentence Structure": ["Fragments", "Run-ons", "Coordination", "Subordination"],
  Transitions: ["Contrast", "Cause and effect", "Sequence", "Addition"],
  "Rhetorical Skills": ["Add/delete sentence", "Sentence placement", "Concision", "Precision"],
  Organization: ["Paragraph order", "Introductions", "Conclusions", "Logical flow"],
  "Style & Tone": ["Tone", "Formality", "Word choice", "Redundancy"],
  "Reading Comprehension": ["Detail", "Inference", "Main idea", "Purpose", "Paired passages"],
  "Vocabulary in Context": ["Context clue", "Tone-based meaning", "Academic vocabulary"],
  Inference: ["Local inference", "Global inference", "Evidence-based inference"],
  "Main Idea": ["Central claim", "Summary", "Theme"],
  "Evidence Support": ["Best evidence", "Data support", "Quote support"],
  "Author Purpose": ["Purpose", "Point of view", "Function"],
  "Text Structure": ["Compare/contrast", "Cause/effect", "Problem/solution"],
  "Sentence Completion": ["Two-blank", "Context logic", "Contrast clue"],
  Analogies: ["Relationship type", "Vocabulary bridge"],
  "Science Reasoning": ["Graph reading", "Trend analysis", "Scientific claims"],
  "Data Interpretation": ["Tables", "Charts", "Scatterplots", "Units"],
  "Experimental Design": ["Variables", "Controls", "Hypothesis", "Procedure"],
  "Conflicting Viewpoints": ["Compare claims", "Evidence disagreement"],
  Other: []
};

function getCategoryOptions(section: string) {
  return categoryOptionsBySection[section] ?? categoryOptionsBySection.Custom;
}

function getDefaultCategoryForSection(section: string) {
  return getCategoryOptions(section)[0] ?? "Other";
}

function getSubcategoryOptions(category: string) {
  return ["", ...(subcategoryOptionsByCategory[category] ?? [])];
}

function mergeSelectedOption(options: string[], selected?: string) {
  return selected && !options.includes(selected) ? [...options, selected] : options;
}

function getLastAddSelectionsStorageKey(studentKey: string) {
  return `${LAST_ADD_SELECTIONS_STORAGE_PREFIX}:${studentKey}`;
}

function normalizeLastQuestionSelections(saved: Partial<LastQuestionSelections> | null): LastQuestionSelections {
  const testType = saved?.testType && testTypeOptions.includes(saved.testType) ? saved.testType : "SAT";
  const sectionModule =
    saved?.sectionModule && sectionOptions.includes(saved.sectionModule) ? saved.sectionModule : "Math";
  const categoryOptions = getCategoryOptions(sectionModule);
  const topic = saved?.topic && categoryOptions.includes(saved.topic) ? saved.topic : getDefaultCategoryForSection(sectionModule);
  const subcategoryOptions = getSubcategoryOptions(topic);
  const subtopic = saved?.subtopic && subcategoryOptions.includes(saved.subtopic) ? saved.subtopic : "";

  return {
    testType,
    sectionModule,
    topic,
    subtopic
  };
}

function formatQuestionShortId(id: string) {
  const compact = id.replace(/^q-/, "").replace(/^local-/, "").replace(/-/g, "");
  return `Q-${(compact || id).slice(0, 8).toUpperCase()}`;
}

export default function Home() {
  const supabaseEnabled = isSupabaseConfigured();
  const loadedUserIdRef = useRef<string | null>(null);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [dateRange, setDateRange] = useState<DateRange>("30 days");
  const [studentName, setStudentName] = useState(supabaseEnabled ? "Student" : demoStudent.name);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(supabaseEnabled);
  const [studentDataLoading, setStudentDataLoading] = useState(false);
  const [appMessage, setAppMessage] = useState("");
  const [questionList, setQuestionList] = useState<Question[]>(supabaseEnabled ? [] : questions);
  const [selectedQuestionId, setSelectedQuestionId] = useState(supabaseEnabled ? "" : questions[0]?.id ?? "");
  const [reviewSettings, setReviewSettings] = useState<ReviewSettings>({
    firstReviewDelayDays: defaultReviewSettings.firstReviewDelayDays,
    secondReviewDelayDays: defaultReviewSettings.secondReviewDelayDays
  });
  const selectedQuestion = useMemo(
    () => questionList.find((question) => question.id === selectedQuestionId) ?? questionList[0] ?? emptyQuestion,
    [questionList, selectedQuestionId]
  );

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    let active = true;
    const loadingTimer = window.setTimeout(() => {
      if (!active) return;
      setAuthLoading(false);
      setStudentDataLoading(false);
      setAppMessage("Supabase is taking longer than expected. You can try signing in again or refresh.");
    }, BOOT_TIMEOUT_MS);

    const handleSessionUser = async (nextUser: User | null) => {
      if (!active) return;
      window.clearTimeout(loadingTimer);

      setCurrentUser(nextUser);

      if (nextUser) {
        const shouldLoadStudentData = loadedUserIdRef.current !== nextUser.id;
        if (!shouldLoadStudentData) {
          setStudentName(getUserDisplayName(nextUser));
          setStudentDataLoading(false);
          setAuthLoading(false);
          return;
        }

        const isInitialLoad = loadedUserIdRef.current === null;
        if (isInitialLoad) {
          setStudentDataLoading(true);
        }

        try {
          await loadStudentData(nextUser.id, getUserDisplayName(nextUser));
          loadedUserIdRef.current = nextUser.id;
        } finally {
          setStudentDataLoading(false);
          setAuthLoading(false);
        }
      } else {
        loadedUserIdRef.current = null;
        setStudentName("Student");
        setQuestionList([]);
        setSelectedQuestionId("");
        setStudentDataLoading(false);
        setAuthLoading(false);
      }
    };

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await handleSessionUser(session?.user ?? null);
    });

    void supabase.auth.getSession()
      .then(({ data }) => handleSessionUser(data.session?.user ?? null))
      .catch(() => {
        if (!active) return;
        window.clearTimeout(loadingTimer);
        setAuthLoading(false);
        setStudentDataLoading(false);
        setAppMessage("Could not check the current session. Please try signing in again.");
      });

    return () => {
      active = false;
      window.clearTimeout(loadingTimer);
      listener.subscription.unsubscribe();
    };
  }, []);

  const loadStudentData = async (userId: string, fallbackName = "Student") => {
    const supabase = createClient();
    if (!supabase) return;

    try {
      const { data: profile, error: profileError } = await withTimeout(
        supabase
          .from("student_profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle<StudentProfile>(),
        DATA_TIMEOUT_MS
      );

      if (profileError) {
        throw new Error(`Profile load failed: ${profileError.message}`);
      }

      const resolvedProfile =
        profile ??
        (
          await withTimeout(
            supabase
              .from("student_profiles")
              .upsert({ id: userId, display_name: fallbackName }, { onConflict: "id" })
              .select("*")
              .single<StudentProfile>(),
            DATA_TIMEOUT_MS
          )
        ).data;

      if (resolvedProfile) {
        setStudentName(resolvedProfile.display_name);
        setReviewSettings({
          firstReviewDelayDays: resolvedProfile.first_review_delay_days,
          secondReviewDelayDays: resolvedProfile.second_review_delay_days
        });
      }

      const { data: dbQuestions, error: questionsError } = await withTimeout(
        supabase
          .from("questions")
          .select("*")
          .eq("student_id", userId)
          .order("logged_at", { ascending: false })
          .returns<DbQuestion[]>(),
        DATA_TIMEOUT_MS
      );

      if (questionsError) {
        throw new Error(`Questions load failed: ${questionsError.message}`);
      }

      const { data: dbReviews, error: reviewsError } = await withTimeout(
        supabase
          .from("reviews")
          .select("*")
          .eq("student_id", userId)
          .order("due_date", { ascending: true })
          .returns<DbReview[]>(),
        DATA_TIMEOUT_MS
      );

      if (reviewsError) {
        throw new Error(`Reviews load failed: ${reviewsError.message}`);
      }

      if (dbQuestions && dbQuestions.length > 0) {
        const signedUrlByPath = new Map<string, string>();
        const screenshotPaths = dbQuestions.map((question) => question.screenshot_path).filter(Boolean);

        await Promise.all(
          screenshotPaths.map(async (path) => {
            const { data, error } = await withTimeout(
              supabase.storage
                .from("question-screenshots")
                .createSignedUrl(path, 60 * 60),
              DATA_TIMEOUT_MS
            );
            if (!error && data?.signedUrl) {
              signedUrlByPath.set(path, data.signedUrl);
            }
          })
        );

        const mapped = dbQuestions.map((question) =>
          mapDbQuestion(question, dbReviews ?? [], signedUrlByPath.get(question.screenshot_path))
        );
        setQuestionList(mapped);
        setSelectedQuestionId((current) => mapped.some((question) => question.id === current) ? current : mapped[0].id);
      } else {
        setQuestionList([]);
        setSelectedQuestionId("");
      }
      setAppMessage((current) =>
        current.includes("timed out") || current.includes("taking longer") ? "" : current
      );
    } catch (error) {
      setQuestionList([]);
      setSelectedQuestionId("");
      setAppMessage(error instanceof Error ? error.message : "Could not load student data from Supabase.");
    }
  };

  const handleSettingsChange = async (nextSettings: ReviewSettings) => {
    setReviewSettings(nextSettings);

    const supabase = createClient();
    if (!supabase || !currentUser) return;

    const { error } = await supabase
      .from("student_profiles")
      .update({
        first_review_delay_days: nextSettings.firstReviewDelayDays,
        second_review_delay_days: nextSettings.secondReviewDelayDays
      })
      .eq("id", currentUser.id);

    setAppMessage(error ? error.message : "Review settings saved.");
  };

  const handleSaveQuestion = async (payload: AddQuestionPayload) => {
    const supabase = createClient();
    if (!supabase || !currentUser) {
      const localQuestion = createLocalQuestion(payload, questionList.length + 1);
      setQuestionList((current) => [localQuestion, ...current]);
      setSelectedQuestionId(localQuestion.id);
      setAppMessage("Question saved in local demo mode.");
      return { ok: true, message: "Question saved in local demo mode." };
    }

    if (!payload.file) {
      return { ok: false, message: "Please upload a screenshot first." };
    }

    try {
      const questionId = crypto.randomUUID();
      const screenshotPath = `users/${currentUser.id}/questions/${questionId}.webp`;
      const imageBlob = await imageFileToWebp(payload.file);

      const upload = await supabase.storage
        .from("question-screenshots")
        .upload(screenshotPath, imageBlob, {
          contentType: "image/webp",
          upsert: true
        });

      if (upload.error) {
        return { ok: false, message: `Screenshot upload failed: ${upload.error.message}` };
      }

      const { error } = await supabase.from("questions").insert({
        id: questionId,
        student_id: currentUser.id,
        test_type: payload.form.testType,
        source: optionalText(payload.form.source),
        test_name: optionalText(payload.form.testName),
        section_module: optionalText(payload.form.sectionModule),
        question_number: optionalText(payload.form.questionNumber),
        screenshot_path: screenshotPath,
        topic: payload.form.topic,
        subtopic: optionalText(payload.form.subtopic),
        error_type: payload.form.errorType,
        correct_answer: payload.form.correctAnswer.trim(),
        time_spent_seconds: parseTimeSpent(payload.form.timeSpent),
        correct_strategy: optionalText(payload.form.correctStrategy),
        notes: optionalText(payload.form.notes)
      });

      if (error) {
        await supabase.storage.from("question-screenshots").remove([screenshotPath]);
        return { ok: false, message: `Question save failed: ${error.message}` };
      }

      await loadStudentData(currentUser.id, getUserDisplayName(currentUser));
      setAppMessage("Question saved. Reviews were scheduled automatically.");
      return { ok: true, message: "Question saved. Reviews were scheduled automatically." };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Could not save this question. Please try again."
      };
    }
  };

  const handleUpdateQuestion = async (questionId: string, updates: Partial<Question>) => {
    const supabase = createClient();
    if (!supabase || !currentUser) {
      setQuestionList((current) =>
        current.map((question) => (question.id === questionId ? { ...question, ...updates } : question))
      );
      setAppMessage("Question updated in local demo mode.");
      return { ok: true, message: "Question updated locally." };
    }

    const { error } = await supabase
      .from("questions")
      .update({
        topic: updates.topic,
        test_type: updates.testType,
        subtopic: optionalText(updates.subtopic ?? ""),
        error_type: updates.errorType,
        correct_answer: updates.correctAnswer?.trim(),
        source: optionalText(updates.source ?? ""),
        test_name: optionalText(updates.testName ?? ""),
        section_module: optionalText(updates.section ?? ""),
        question_number: optionalText(updates.questionNumber ?? ""),
        time_spent_seconds: parseTimeSpent(updates.timeSpent ?? ""),
        correct_strategy: optionalText(updates.correctStrategy ?? ""),
        notes: optionalText(updates.notes ?? "")
      })
      .eq("id", questionId)
      .eq("student_id", currentUser.id);

    if (error) {
      setAppMessage(error.message);
      return { ok: false, message: error.message };
    }

    await loadStudentData(currentUser.id, getUserDisplayName(currentUser));
    setAppMessage("Question updated.");
    return { ok: true, message: "Question updated." };
  };

  const handleDeleteQuestion = async (question: Question) => {
    const nextSelection = questionList.find((item) => item.id !== question.id)?.id ?? "";
    const supabase = createClient();
    if (!supabase || !currentUser) {
      setQuestionList((current) => current.filter((item) => item.id !== question.id));
      setSelectedQuestionId((current) => current === question.id ? nextSelection : current);
      setAppMessage("Question deleted in local demo mode.");
      return { ok: true, message: "Question deleted locally." };
    }

    const { error } = await supabase
      .from("questions")
      .delete()
      .eq("id", question.id)
      .eq("student_id", currentUser.id);

    if (error) {
      setAppMessage(error.message);
      return { ok: false, message: error.message };
    }

    setQuestionList((current) => current.filter((item) => item.id !== question.id));
    setSelectedQuestionId((current) => current === question.id ? nextSelection : current);

    if (question.screenshotPath) {
      await supabase.storage.from("question-screenshots").remove([question.screenshotPath]);
    }

    await loadStudentData(currentUser.id, getUserDisplayName(currentUser));
    setSelectedQuestionId(nextSelection);
    setAppMessage("Question deleted.");
    return { ok: true, message: "Question deleted." };
  };

  const handleReactivateQuestion = async (question: Question) => {
    const supabase = createClient();
    if (!supabase || !currentUser) {
      const nextRound = Math.max(1, getReviewRoundNumber(question.reviewRound) + 1);
      setQuestionList((current) =>
        current.map((item) =>
          item.id === question.id
            ? { ...item, reviewRound: `Review ${nextRound}`, status: "Due", nextReview: "Today" }
            : item
        )
      );
      setAppMessage("Question reactivated in local demo mode.");
      return { ok: true, message: "Question reactivated locally." };
    }

    const { data: existingReviews, error: reviewsError } = await supabase
      .from("reviews")
      .select("review_round,status")
      .eq("student_id", currentUser.id)
      .eq("question_id", question.id)
      .order("review_round", { ascending: false });

    if (reviewsError) {
      setAppMessage(reviewsError.message);
      return { ok: false, message: reviewsError.message };
    }

    const scheduledReview = existingReviews?.find((review) => review.status === "scheduled");
    if (scheduledReview) {
      const { error } = await supabase
        .from("reviews")
        .update({ due_date: todayKey() })
        .eq("student_id", currentUser.id)
        .eq("question_id", question.id)
        .eq("review_round", scheduledReview.review_round);

      if (error) {
        setAppMessage(error.message);
        return { ok: false, message: error.message };
      }
    } else {
      const nextRound = Math.max(1, ...((existingReviews ?? []).map((review) => review.review_round))) + 1;
      const { error } = await supabase.from("reviews").insert({
        student_id: currentUser.id,
        question_id: question.id,
        review_round: nextRound,
        due_date: todayKey()
      });

      if (error) {
        setAppMessage(error.message);
        return { ok: false, message: error.message };
      }
    }

    await loadStudentData(currentUser.id, getUserDisplayName(currentUser));
    setAppMessage("Question reactivated for review.");
    return { ok: true, message: "Question reactivated for review." };
  };

  const handleCompleteReview = async (reviewId: string | undefined, result: string, keepNextReview: boolean) => {
    const supabase = createClient();
    if (!supabase || !currentUser || !reviewId) {
      setAppMessage(
        result === "Correct" && !keepNextReview
          ? "Local demo: marked correct and stopped future reviews."
          : "Local demo: next review kept or required."
      );
      return;
    }

    const { error } = await supabase.rpc("complete_review", {
      p_review_id: reviewId,
      p_result: toReviewResult(result),
      p_keep_next_review: keepNextReview
    });

    setAppMessage(error ? error.message : "Review saved.");
    if (!error) {
      await loadStudentData(currentUser.id, getUserDisplayName(currentUser));
    }
  };

  const handleAuthenticated = async (user: User) => {
    setCurrentUser(user);
    setStudentName(getUserDisplayName(user));
    setAppMessage("");
    setStudentDataLoading(true);
    try {
      await loadStudentData(user.id, getUserDisplayName(user));
      loadedUserIdRef.current = user.id;
    } finally {
      setStudentDataLoading(false);
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    loadedUserIdRef.current = null;
    setCurrentUser(null);
    setStudentName("Student");
    setQuestionList([]);
    setSelectedQuestionId("");
    setAppMessage("Signed out.");
    clearSupabaseLocalStorage();
    void supabase?.auth.signOut().catch(() => undefined);
  };

  if (authLoading || studentDataLoading) {
    return <LoadingScreen />;
  }

  if (supabaseEnabled && !currentUser) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <main className="app-frame">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand-lockup">
          <div className="brand-mark">W</div>
          <div>
            <p className="brand-name">WrongToStrong</p>
            <p className="brand-subtitle">{supabaseEnabled ? "Connected workspace" : "Demo workspace"}</p>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={clsx("nav-button", screen === item.id && "active", item.featured && "featured")}
                key={item.id}
                onClick={() => setScreen(item.id)}
                type="button"
              >
                <Icon aria-hidden="true" size={22} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="student-pill" type="button">
            <GraduationCap size={18} />
            <span>{studentName}</span>
            <ChevronDown size={16} />
          </button>
          <p>Each student has a separate login, review windows, and question history.</p>
        </div>
      </aside>

      <section className="workspace">
        <TopBar
          title={screenTitle(screen)}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          studentName={studentName}
          onSignOut={supabaseEnabled ? handleSignOut : undefined}
        />
        {appMessage && <p className="global-notice">{appMessage}</p>}
        {screen === "dashboard" && (
          <DashboardScreen isDemo={!supabaseEnabled} onNavigate={setScreen} questions={questionList} />
        )}
        {screen === "add" && (
          <AddQuestionScreen
            reviewSettings={reviewSettings}
            studentStorageKey={currentUser?.id ?? "demo"}
            onSaveQuestion={handleSaveQuestion}
            onSaved={() => setScreen("bank")}
          />
        )}
        {screen === "bank" && (
          <QuestionBankScreen
            questions={questionList}
            selectedQuestionId={selectedQuestionId}
            onSelectQuestion={setSelectedQuestionId}
            selectedQuestion={selectedQuestion}
            onNavigate={setScreen}
            onUpdateQuestion={handleUpdateQuestion}
            onDeleteQuestion={handleDeleteQuestion}
            onReactivateQuestion={handleReactivateQuestion}
          />
        )}
        {screen === "reviews" && (
          <ReviewsScreen
            questions={questionList.length > 0 ? questionList : supabaseEnabled ? [] : questions}
            onCompleteReview={handleCompleteReview}
            onReactivateQuestion={handleReactivateQuestion}
          />
        )}
        {screen === "analytics" && <AnalyticsScreen isDemo={!supabaseEnabled} questions={questionList} />}
        {screen === "settings" && (
          <ReviewSettingsScreen settings={reviewSettings} onSettingsChange={handleSettingsChange} />
        )}
      </section>
    </main>
  );
}

function screenTitle(screen: Screen) {
  switch (screen) {
    case "add":
      return "Add Question";
    case "bank":
      return "Question Bank";
    case "reviews":
      return "Reviews";
    case "analytics":
      return "Analytics";
    case "settings":
      return "Review Settings";
    default:
      return "Dashboard";
  }
}

function TopBar({
  title,
  dateRange,
  onDateRangeChange,
  studentName,
  onSignOut
}: {
  title: string;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  studentName: string;
  onSignOut?: () => void;
}) {
  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        <p>{studentName} / Private question bank</p>
      </div>
      <div className="topbar-controls">
        <div className="segmented-control" aria-label="Date range">
          {(["7 days", "30 days", "90 days"] as DateRange[]).map((range) => (
            <button
              className={dateRange === range ? "active" : undefined}
              key={range}
              onClick={() => onDateRangeChange(range)}
              type="button"
            >
              {range}
            </button>
          ))}
        </div>
        {onSignOut && <button className="select-button" onClick={onSignOut} type="button">Sign out</button>}
      </div>
    </header>
  );
}

function DashboardScreen({
  isDemo,
  onNavigate,
  questions: questionRows
}: {
  isDemo: boolean;
  onNavigate: (screen: Screen) => void;
  questions: Question[];
}) {
  const dashboardMetrics = isDemo ? metrics : buildMetrics(questionRows);
  const dashboardDomainProgress = isDemo ? domainProgress : buildTopicProgress(questionRows);
  const dashboardReviewQueue = isDemo ? reviewQueue : buildReviewQueue(questionRows);
  const dashboardWeakTopics = isDemo ? normalizeWeakTopics() : buildWeakTopics(questionRows);
  const dashboardErrorTypes = isDemo ? errorTypes : buildErrorTypes(questionRows);
  const dashboardActivity = isDemo ? recentActivity : buildRecentActivity(questionRows);

  return (
    <div className="screen-grid dashboard-grid">
      <section className="metric-row">
        {dashboardMetrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <em className={`tone-${metric.tone}`}>{metric.delta}</em>
          </article>
        ))}
      </section>

      <Panel className="domain-panel" title="Category Progress" action="View analytics" onAction={() => onNavigate("analytics")}>
        <div className="progress-list">
          {dashboardDomainProgress.map((domain) => (
            <ProgressRow key={domain.label} label={domain.label} value={domain.value} note={domain.change ?? `${domain.value}% of logged questions`} />
          ))}
          {dashboardDomainProgress.length === 0 && <div className="empty-state compact">No logged questions yet.</div>}
        </div>
      </Panel>

      <Panel className="review-panel" title="Review Queue" action="Start Review" onAction={() => onNavigate("reviews")}>
        <div className="review-queue">
          {dashboardReviewQueue.map((item) => (
            <div className="queue-stat" key={item.label}>
              <span>{item.label}</span>
              <strong className={`tone-${item.tone}`}>{item.value}</strong>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Weak Categories" action="Open bank" onAction={() => onNavigate("bank")}>
        <div className="topic-list">
          {dashboardWeakTopics.map((topic) => (
            <ProgressRow
              key={topic.label}
              label={topic.label}
              note={`${topic.missRate ?? topic.value}% of logged questions`}
              value={topic.missRate ?? topic.value}
              inverted
            />
          ))}
          {dashboardWeakTopics.length === 0 && <div className="empty-state compact">No weak categories yet.</div>}
        </div>
      </Panel>

      <Panel title="Error Type Breakdown">
        <div className="bar-list">
          {dashboardErrorTypes.map((item) => (
            <BarRow key={item.label} label={item.label} value={item.value} />
          ))}
          {dashboardErrorTypes.length === 0 && <div className="empty-state compact">No error types yet.</div>}
        </div>
      </Panel>

      <Panel title="Review Outcomes">
        <div className="outcome-grid">
          {reviewOutcomes.map((item) => (
            <div className="outcome-pill" key={item.label}>
              <span>{item.label}</span>
              <strong className={`tone-${item.tone}`}>{item.value}</strong>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="activity-panel" title="Recent Activity">
        <div className="activity-list">
          {dashboardActivity.map((item, index) => (
            <div className="activity-row" key={`${item}-${index}`}>
              <span />
              <p>{item}</p>
            </div>
          ))}
          {dashboardActivity.length === 0 && <div className="empty-state compact">No recent activity yet.</div>}
        </div>
      </Panel>
    </div>
  );
}

function AddQuestionScreen({
  reviewSettings,
  studentStorageKey,
  onSaveQuestion,
  onSaved
}: {
  reviewSettings: ReviewSettings;
  studentStorageKey: string;
  onSaveQuestion: (payload: AddQuestionPayload) => Promise<{ ok: boolean; message: string }>;
  onSaved: () => void;
}) {
  const [uploaded, setUploaded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [form, setForm] = useState({
    testType: "SAT",
    sectionModule: "Math",
    topic: "Algebra",
    subtopic: "",
    errorType: "Wrong setup",
    correctAnswer: "",
    source: "",
    testName: "",
    questionNumber: "",
    timeSpent: "",
    correctStrategy: "",
    notes: ""
  });
  const formCategoryOptions = mergeSelectedOption(getCategoryOptions(form.sectionModule), form.topic);
  const formSubcategoryOptions = mergeSelectedOption(getSubcategoryOptions(form.topic), form.subtopic);

  useEffect(() => {
    try {
      const rawSelections = window.localStorage.getItem(getLastAddSelectionsStorageKey(studentStorageKey));
      if (!rawSelections) return;

      const nextSelections = normalizeLastQuestionSelections(JSON.parse(rawSelections));
      setForm((current) => ({
        ...current,
        ...nextSelections
      }));
    } catch {
      // Ignore malformed local preference data; the default form remains valid.
    }
  }, [studentStorageKey]);

  const updateField = (field: keyof typeof form, value: string) => {
    setSaved(false);
    setForm((current) => {
      if (field === "sectionModule") {
        return {
          ...current,
          sectionModule: value,
          topic: getDefaultCategoryForSection(value),
          subtopic: ""
        };
      }

      if (field === "topic") {
        return {
          ...current,
          topic: value,
          subtopic: ""
        };
      }

      return { ...current, [field]: value };
    });
  };

  const canSave =
    uploaded &&
    form.testType &&
    form.sectionModule &&
    form.topic &&
    form.errorType &&
    form.correctAnswer.trim().length > 0 &&
    !saving;
  const saveQuestion = async () => {
    setSaving(true);
    setSaved(false);
    setSaveMessage("Saving question...");

    try {
      const result = await onSaveQuestion({ file, form });
      setSaved(result.ok);
      setSaveMessage(result.message);
      if (result.ok) {
        try {
          window.localStorage.setItem(
            getLastAddSelectionsStorageKey(studentStorageKey),
            JSON.stringify({
              testType: form.testType,
              sectionModule: form.sectionModule,
              topic: form.topic,
              subtopic: form.subtopic
            } satisfies LastQuestionSelections)
          );
        } catch {
          // Saving the question matters more than persisting this local convenience preference.
        }
        onSaved();
      }
    } catch (error) {
      setSaved(false);
      setSaveMessage(error instanceof Error ? error.message : "Could not save this question. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="two-column-form">
      <Panel className="form-panel" title="Add Question">
        <label className={clsx("upload-zone", uploaded && "uploaded")}>
          <Upload size={28} />
          <strong>{uploaded ? "Screenshot ready" : "Upload screenshot"}</strong>
          <span>{file ? file.name : "Private file, compressed before storage"}</span>
          <input
            accept="image/*"
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              setFile(nextFile);
              setUploaded(Boolean(nextFile));
              setSaved(false);
            }}
            type="file"
          />
        </label>
        <div className="form-grid">
          <SelectField label="Test" value={form.testType} onChange={(value) => updateField("testType", value)} options={testTypeOptions} />
          <SelectField label="Section" value={form.sectionModule} onChange={(value) => updateField("sectionModule", value)} options={sectionOptions} />
          <SelectField label="Category" value={form.topic} onChange={(value) => updateField("topic", value)} options={formCategoryOptions} />
          <SelectField label="Subcategory optional" value={form.subtopic} onChange={(value) => updateField("subtopic", value)} options={formSubcategoryOptions} />
          <SelectField label="Error type" value={form.errorType} onChange={(value) => updateField("errorType", value)} options={["Misread question", "Careless calculation", "Concept gap", "Wrong setup", "Too slow", "Other"]} />
          <TextField label="Correct answer" value={form.correctAnswer} onChange={(value) => updateField("correctAnswer", value)} placeholder="A, B, C, 42, x = 7" />
          <TextField label="Source optional" value={form.source} onChange={(value) => updateField("source", value)} placeholder="Bluebook, Khan Academy, Book" />
          <TextField label="Test name optional" value={form.testName} onChange={(value) => updateField("testName", value)} placeholder="Practice Test 1" />
          <TextField label="Question number optional" value={form.questionNumber} onChange={(value) => updateField("questionNumber", value)} placeholder="18" />
          <TextField label="Time spent optional" value={form.timeSpent} onChange={(value) => updateField("timeSpent", value)} placeholder="3m 20s" />
          <label className="field wide optional">
            <span>Correct strategy optional</span>
            <textarea
              onChange={(event) => updateField("correctStrategy", event.target.value)}
              placeholder="What should I do next time?"
              value={form.correctStrategy}
            />
          </label>
          <label className="field wide optional">
            <span>Notes optional</span>
            <textarea
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Any extra context"
              value={form.notes}
            />
          </label>
          <div className="form-actions">
            <button className="primary-action" disabled={!canSave} onClick={saveQuestion} type="button">
              {saving ? "Saving..." : "Save question"}
            </button>
            <button className="select-button" disabled={saving} onClick={() => { setUploaded(false); setFile(null); }} type="button">
              Clear screenshot
            </button>
          </div>
        </div>
        {saveMessage && <p className={clsx("notice", saved && "success")}>{saveMessage}</p>}
      </Panel>

      <Panel title="Default Review Schedule">
        <div className="schedule-card">
          <BookOpenCheck size={24} />
          <div>
            <strong>Review 1</strong>
            <span>{reviewSettings.firstReviewDelayDays} days after logging</span>
          </div>
        </div>
        <div className="schedule-card">
          <BookOpenCheck size={24} />
          <div>
            <strong>Review 2</strong>
            <span>{reviewSettings.secondReviewDelayDays} days after logging</span>
          </div>
        </div>
        <p className="quiet-copy">Correct can stop or continue. Wrong again, still slow, or needs review creates the next round.</p>
      </Panel>
    </div>
  );
}

function QuestionBankScreen({
  questions: questionRows,
  selectedQuestionId,
  onSelectQuestion,
  selectedQuestion,
  onNavigate,
  onUpdateQuestion,
  onDeleteQuestion,
  onReactivateQuestion
}: {
  questions: Question[];
  selectedQuestionId: string;
  onSelectQuestion: (id: string) => void;
  selectedQuestion: Question;
  onNavigate: (screen: Screen) => void;
  onUpdateQuestion: (questionId: string, updates: Partial<Question>) => Promise<{ ok: boolean; message: string }>;
  onDeleteQuestion: (question: Question) => Promise<{ ok: boolean; message: string }>;
  onReactivateQuestion: (question: Question) => Promise<{ ok: boolean; message: string }>;
}) {
  const [search, setSearch] = useState("");
  const [testFilter, setTestFilter] = useState("All tests");
  const [sectionFilter, setSectionFilter] = useState("All sections");
  const [topicFilter, setTopicFilter] = useState("All categories");
  const [statusFilter, setStatusFilter] = useState("All reviews");
  const [inspectorMessage, setInspectorMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Question>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState("");
  const filteredQuestions = questionRows.filter((question) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [question.testType, question.section, question.topic, question.subtopic, question.errorType, question.source, question.notes]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    const matchesTest = testFilter === "All tests" || question.testType === testFilter;
    const matchesSection = sectionFilter === "All sections" || question.section === sectionFilter;
    const matchesTopic = topicFilter === "All categories" || question.topic === topicFilter;
    const matchesStatus = statusFilter === "All reviews" || bankReviewStatus(question) === statusFilter;
    return matchesSearch && matchesTest && matchesSection && matchesTopic && matchesStatus;
  });

  useEffect(() => {
    setEditing(false);
    setDraft({});
    setInspectorMessage("");
    setPendingDeleteId("");
  }, [selectedQuestionId]);

  const hasSelectedQuestion = Boolean(selectedQuestion.id);
  const currentDraft = { ...selectedQuestion, ...draft };
  const draftSection = currentDraft.section ?? "Math";
  const draftTopic = currentDraft.topic ?? getDefaultCategoryForSection(draftSection);
  const draftCategoryOptions = mergeSelectedOption(getCategoryOptions(draftSection), draftTopic);
  const draftSubcategoryOptions = mergeSelectedOption(getSubcategoryOptions(draftTopic), currentDraft.subtopic);
  const updateDraft = (field: keyof Question, value: string) => {
    setDraft((current) => {
      if (field === "section") {
        return {
          ...current,
          section: value,
          topic: getDefaultCategoryForSection(value),
          subtopic: ""
        };
      }

      if (field === "topic") {
        return {
          ...current,
          topic: value,
          subtopic: ""
        };
      }

      return { ...current, [field]: value };
    });
  };
  const saveEdits = async () => {
    if (!hasSelectedQuestion) return;
    if (!currentDraft.correctAnswer?.trim()) {
      setInspectorMessage("Correct answer is required.");
      return;
    }
    const result = await onUpdateQuestion(selectedQuestion.id, currentDraft);
    setInspectorMessage(result.message);
    if (result.ok) {
      setEditing(false);
      setDraft({});
    }
  };
  const deleteSelected = async () => {
    if (!hasSelectedQuestion) return;
    if (pendingDeleteId !== selectedQuestion.id) {
      setPendingDeleteId(selectedQuestion.id);
      setInspectorMessage("Click Confirm delete to remove this question and its scheduled reviews.");
      return;
    }

    const result = await onDeleteQuestion(selectedQuestion);
    setInspectorMessage(result.message);
    setPendingDeleteId("");
  };
  const reactivateSelected = async () => {
    if (!hasSelectedQuestion) return;
    const result = await onReactivateQuestion(selectedQuestion);
    setInspectorMessage(result.message);
  };

  return (
    <div className="bank-layout">
      <Panel className="bank-main" title="Logged Questions">
        <div className="filter-row">
          <div className="search-box">
            <Search size={18} />
            <input
              aria-label="Search questions"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search topic, source, notes"
              value={search}
            />
          </div>
          <select className="filter-chip" value={testFilter} onChange={(event) => setTestFilter(event.target.value)} aria-label="Filter by test">
            <option>All tests</option>
            {[...new Set(questionRows.map((question) => question.testType).filter(Boolean))].map((testType) => <option key={testType}>{testType}</option>)}
          </select>
          <select className="filter-chip" value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)} aria-label="Filter by section">
            <option>All sections</option>
            {[...new Set(questionRows.map((question) => question.section).filter(Boolean))].map((section) => <option key={section}>{section}</option>)}
          </select>
          <select className="filter-chip" value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)} aria-label="Filter by category">
            <option>All categories</option>
            {[...new Set(questionRows.map((question) => question.topic))].map((topic) => <option key={topic}>{topic}</option>)}
          </select>
          <select className="filter-chip" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by review">
            <option>All reviews</option>
            {[...new Set(questionRows.map((question) => bankReviewStatus(question)))].map((status) => <option key={status}>{status}</option>)}
          </select>
          <button className="filter-chip" onClick={() => { setSearch(""); setTestFilter("All tests"); setSectionFilter("All sections"); setTopicFilter("All categories"); setStatusFilter("All reviews"); }} type="button">
            Reset
          </button>
        </div>
        <div className="question-table">
          <div className="table-head">
            <span>Question</span>
            <span>Test / section</span>
            <span>Error type</span>
            <span>Review</span>
          </div>
          {filteredQuestions.map((question) => (
            <button
              className={clsx("question-row", selectedQuestionId === question.id && "active")}
              key={question.id}
              onClick={() => onSelectQuestion(question.id)}
              type="button"
            >
              <span className="question-topic">
                <MathThumb id={question.id} imageUrl={question.screenshotUrl} label={question.screenshotLabel} />
                <em className="question-code bank-row-code">{getQuestionDisplayId(question, questionRows)}</em>
                <span>
                  <strong>{question.topic}</strong>
                  <em>{question.subtopic || "No subcategory"}</em>
                </span>
              </span>
              <span>{[question.testType, question.section].filter(Boolean).join(" / ") || "Not set"}</span>
              <span>{question.errorType}</span>
              <span className="review-status-cell">
                <span className="status-badge">{bankReviewStatus(question)}</span>
                {question.reviewTiming && <em>{question.reviewTiming}</em>}
              </span>
            </button>
          ))}
          {filteredQuestions.length === 0 && <div className="empty-state">No questions match these filters.</div>}
        </div>
      </Panel>

      <Panel
        className="inspector"
        title="Question Detail"
        action={hasSelectedQuestion && selectedQuestion.status === "Due" ? "Start Review" : undefined}
        onAction={() => onNavigate("reviews")}
      >
        {!hasSelectedQuestion && <div className="empty-state compact">Select a logged question, or add your first question.</div>}
        {hasSelectedQuestion && (
          <>
        <MathPreview label={selectedQuestion.screenshotLabel} imageUrl={selectedQuestion.screenshotUrl} />
        {!editing ? (
          <div className="tag-row">
            <span>{selectedQuestion.testType ?? "Test not set"}</span>
            <span>{selectedQuestion.section ?? "Section not set"}</span>
            <span>{selectedQuestion.topic}</span>
            {selectedQuestion.subtopic && <span>{selectedQuestion.subtopic}</span>}
            <span>{selectedQuestion.errorType}</span>
          </div>
        ) : (
          <div className="inspector-edit-grid">
            <SelectField label="Test" value={currentDraft.testType ?? "SAT"} onChange={(value) => updateDraft("testType", value)} options={testTypeOptions} />
            <SelectField label="Section" value={currentDraft.section ?? "Math"} onChange={(value) => updateDraft("section", value)} options={sectionOptions} />
            <SelectField label="Category" value={draftTopic} onChange={(value) => updateDraft("topic", value)} options={draftCategoryOptions} />
            <SelectField label="Subcategory optional" value={currentDraft.subtopic ?? ""} onChange={(value) => updateDraft("subtopic", value)} options={draftSubcategoryOptions} />
            <SelectField label="Error type" value={currentDraft.errorType ?? ""} onChange={(value) => updateDraft("errorType", value)} options={["Misread question", "Careless calculation", "Concept gap", "Wrong setup", "Too slow", "Other"]} />
            <TextField label="Correct answer" value={currentDraft.correctAnswer ?? ""} onChange={(value) => updateDraft("correctAnswer", value)} placeholder="A, B, C, 42, x = 7" />
            <TextField label="Source optional" value={currentDraft.source ?? ""} onChange={(value) => updateDraft("source", value)} placeholder="Bluebook" />
            <TextField label="Test name optional" value={currentDraft.testName ?? ""} onChange={(value) => updateDraft("testName", value)} placeholder="Practice Test 1" />
            <TextField label="Question number optional" value={currentDraft.questionNumber ?? ""} onChange={(value) => updateDraft("questionNumber", value)} placeholder="18" />
            <TextField label="Time spent optional" value={currentDraft.timeSpent ?? ""} onChange={(value) => updateDraft("timeSpent", value)} placeholder="3m 20s" />
          </div>
        )}
        <dl className="detail-list">
          <div><dt>Question ID</dt><dd>{getQuestionDisplayId(selectedQuestion, questionRows)}</dd></div>
          <div><dt>Test</dt><dd>{selectedQuestion.testType ?? "Not set"}</dd></div>
          <div><dt>Section</dt><dd>{selectedQuestion.section ?? "Not set"}</dd></div>
          <div><dt>Subcategory</dt><dd>{selectedQuestion.subtopic || "Optional"}</dd></div>
          <div><dt>Source</dt><dd>{selectedQuestion.source ?? "Not set"}</dd></div>
          <div><dt>Review</dt><dd>{bankReviewStatus(selectedQuestion)}</dd></div>
          {selectedQuestion.reviewTiming && <div><dt>Timing</dt><dd>{selectedQuestion.reviewTiming}</dd></div>}
          <div><dt>Correct answer</dt><dd>{maskCorrectAnswer(selectedQuestion.correctAnswer)}</dd></div>
          <div><dt>Time spent</dt><dd>{selectedQuestion.timeSpent ?? "Not set"}</dd></div>
        </dl>
        <div className="strategy-box">
          <span>Correct strategy</span>
          {editing ? (
            <textarea
              onChange={(event) => updateDraft("correctStrategy", event.target.value)}
              placeholder="What should I do next time?"
              value={currentDraft.correctStrategy ?? ""}
            />
          ) : (
            <p>{selectedQuestion.correctStrategy ?? "No strategy note yet."}</p>
          )}
        </div>
        {editing && (
          <div className="strategy-box">
            <span>Notes</span>
            <textarea
              onChange={(event) => updateDraft("notes", event.target.value)}
              placeholder="Any extra context"
              value={currentDraft.notes ?? ""}
            />
          </div>
        )}
        <div className="inspector-actions">
          {editing ? (
            <>
              <button className="primary-action" onClick={saveEdits} type="button">Save changes</button>
              <button className="select-button" onClick={() => { setEditing(false); setDraft({}); }} type="button">Cancel</button>
            </>
          ) : (
            <>
              <button className="select-button" onClick={() => setEditing(true)} type="button">Edit</button>
              {bankReviewStatus(selectedQuestion) === "Done" && (
                <button className="select-button" onClick={reactivateSelected} type="button">Reactivate</button>
              )}
              {pendingDeleteId === selectedQuestion.id && (
                <button className="select-button" onClick={() => { setPendingDeleteId(""); setInspectorMessage(""); }} type="button">Cancel</button>
              )}
              <button className="danger-button" onClick={deleteSelected} type="button">
                {pendingDeleteId === selectedQuestion.id ? "Confirm delete" : "Delete"}
              </button>
            </>
          )}
        </div>
        {inspectorMessage && <p className="notice">{inspectorMessage}</p>}
          </>
        )}
      </Panel>
    </div>
  );
}

function ReviewsScreen({
  questions: questionRows,
  onCompleteReview,
  onReactivateQuestion
}: {
  questions: Question[];
  onCompleteReview: (reviewId: string | undefined, result: string, keepNextReview: boolean) => Promise<void>;
  onReactivateQuestion: (question: Question) => Promise<{ ok: boolean; message: string }>;
}) {
  const reviewableQuestions = useMemo(
    () => questionRows.filter((question) => question.status !== "Done"),
    [questionRows]
  );
  const [sortReviewByDueDate, setSortReviewByDueDate] = useState(false);
  const reviewGroups = useMemo(
    () => groupReviewQuestions(reviewableQuestions, sortReviewByDueDate),
    [reviewableQuestions, sortReviewByDueDate]
  );
  const [activeQuestionId, setActiveQuestionId] = useState(reviewableQuestions[0]?.id ?? "");
  const [result, setResult] = useState<string | null>(null);
  const [studentAnswer, setStudentAnswer] = useState("");
  const [checkingAnswer, setCheckingAnswer] = useState(false);
  const [reviewLocked, setReviewLocked] = useState(false);
  const [pendingCorrectDecision, setPendingCorrectDecision] = useState(false);
  const [completedQuestionForReactivate, setCompletedQuestionForReactivate] = useState<Question | null>(null);
  const [reviewMessage, setReviewMessage] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const activeQuestion =
    reviewableQuestions.find((question) => question.id === activeQuestionId) ??
    (completedQuestionForReactivate?.id === activeQuestionId ? completedQuestionForReactivate : null) ??
    reviewableQuestions[0] ??
    null;
  const activeReviewRound = getReviewRoundNumber(activeQuestion?.reviewRound);
  const resetReviewWork = () => {
    setResult(null);
    setStudentAnswer("");
    setReviewLocked(false);
    setPendingCorrectDecision(false);
    setCompletedQuestionForReactivate(null);
    setReviewMessage("");
  };
  const selectQuestion = (questionId: string) => {
    if (questionId !== activeQuestionId) {
      resetReviewWork();
    }
    setActiveQuestionId(questionId);
  };
  const startReview = (questionId = activeQuestionId) => {
    selectQuestion(questionId);
    setFocusMode(true);
  };

  useEffect(() => {
    if (pendingCorrectDecision && completedQuestionForReactivate?.id === activeQuestionId) {
      return;
    }

    const nextActiveQuestionId = reviewableQuestions.some((question) => question.id === activeQuestionId)
      ? activeQuestionId
      : reviewableQuestions[0]?.id ?? "";

    if (nextActiveQuestionId !== activeQuestionId) {
      resetReviewWork();
      setActiveQuestionId(nextActiveQuestionId);
    }
  }, [activeQuestionId, completedQuestionForReactivate, pendingCorrectDecision, reviewableQuestions]);

  if (!activeQuestion) {
    return (
      <div className="reviews-layout">
        <Panel className="review-work-panel" title="Review Queue">
          <div className="empty-state compact">No reviewable questions yet.</div>
        </Panel>
        <Panel title="Check Answer">
          <div className="empty-state compact">Log a wrong question first, then its review windows will appear here.</div>
        </Panel>
      </div>
    );
  }

  const correctAnswer = activeQuestion.correctAnswer ?? "";
  const canCheckAnswer =
    studentAnswer.trim().length > 0 &&
    correctAnswer.trim().length > 0 &&
    !checkingAnswer &&
    !pendingCorrectDecision &&
    !reviewLocked;
  const checkAnswer = async () => {
    if (!canCheckAnswer) return;

    setCheckingAnswer(true);
    setReviewLocked(true);
    const nextResult = normalizeAnswer(studentAnswer) === normalizeAnswer(correctAnswer)
      ? "Correct"
      : "Wrong again";
    setResult(nextResult);

    if (nextResult !== "Correct") {
      setReviewMessage("The answer is not correct. Next review scheduled.");
      await onCompleteReview(activeQuestion.reviewId, nextResult, true);
      setCheckingAnswer(false);
      return;
    }

    if (activeReviewRound <= 1) {
      setReviewMessage("Correct. Second review scheduled.");
      await onCompleteReview(activeQuestion.reviewId, nextResult, true);
      setCheckingAnswer(false);
      return;
    }

    setPendingCorrectDecision(true);
    setCompletedQuestionForReactivate(activeQuestion);
    setReviewMessage("Correct. This question is done unless you need to review it again.");
    await onCompleteReview(activeQuestion.reviewId, nextResult, false);
    setCheckingAnswer(false);
  };

  const requestAnotherReview = async () => {
    if (!completedQuestionForReactivate) return;

    setCheckingAnswer(true);
    const response = await onReactivateQuestion(completedQuestionForReactivate);
    setReviewMessage(response.ok ? "Next review scheduled." : response.message);
    if (response.ok) {
      setPendingCorrectDecision(false);
      setCompletedQuestionForReactivate(null);
    }
    setCheckingAnswer(false);
  };

  const reviewAnswerPanel = (
    <>
      <div className="answer-checker">
        <label className="field">
          <span>Your answer</span>
          <input
            onChange={(event) => {
              setStudentAnswer(event.target.value);
              if (!reviewLocked) {
                setResult(null);
                setPendingCorrectDecision(false);
                setReviewMessage("");
              }
            }}
            placeholder="A, B, C, 42, x = 7"
            value={studentAnswer}
          />
        </label>
        <button className="primary-action" disabled={!canCheckAnswer} onClick={checkAnswer} type="button">
          {checkingAnswer ? "Checking..." : "Check answer"}
        </button>
        {!correctAnswer.trim() && (
          <p className="notice">Add the correct answer in Question Bank before reviewing this question.</p>
        )}
      </div>
      {result && (
        <div className={clsx("answer-result", result === "Correct" ? "success" : "wrong")}>
          <strong>{reviewMessage || (result === "Correct" ? "Correct" : "The answer is not correct.")}</strong>
        </div>
      )}
      {pendingCorrectDecision && (
        <div className="review-decision-actions single">
          <button className="select-button" disabled={checkingAnswer} onClick={requestAnotherReview} type="button">
            I need to review it again
          </button>
        </div>
      )}
      {!result && (
        <p className="notice">{reviewMessage || "Enter your answer from the question image, then check it."}</p>
      )}
    </>
  );

  if (focusMode) {
    return (
      <div className="review-focus-layout">
        <Panel className="review-focus-main" title="Review Workspace" action="Back to queue" onAction={() => setFocusMode(false)}>
          <div className="review-focus-header">
            <div>
              <strong>{formatQuestionName(activeQuestion)}</strong>
              <em className="question-code">{getQuestionDisplayId(activeQuestion, questionRows)}</em>
              <span>{[activeQuestion.testType, activeQuestion.section, activeQuestion.errorType].filter(Boolean).join(" / ")}</span>
            </div>
            <span className="status-badge">{activeQuestion.reviewRound}</span>
          </div>
          <div className="review-focus-grid">
            <div className="review-image-stage">
              <MathPreview label={activeQuestion.screenshotLabel} imageUrl={activeQuestion.screenshotUrl} />
            </div>
            <div className="review-answer-panel">
              {reviewAnswerPanel}
            </div>
          </div>
        </Panel>
        <Panel title="Review Rules">
          <div className="rule-list">
            {reviewRuleSummary.map((rule) => (
              <p key={rule}>{rule}</p>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="reviews-layout">
      <Panel className="review-work-panel" title="Review Queue" action="Start selected" onAction={() => startReview()}>
        <div className="queue-tools">
          <button
            className={clsx("select-button", sortReviewByDueDate && "active")}
            onClick={() => setSortReviewByDueDate((current) => !current)}
            type="button"
          >
            <ArrowUpDown size={16} />
            Due date
          </button>
        </div>
        <div className="review-group-list">
          {reviewGroups.map((group) => (
            <section className="review-group" key={group.label}>
              <h3>{group.label}</h3>
              {group.questions.map((question) => (
                <div
                  className={clsx("review-card", activeQuestionId === question.id && "active")}
                  key={question.id}
                  onClick={() => selectQuestion(question.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectQuestion(question.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <MathThumb id={question.id} imageUrl={question.screenshotUrl} label={question.screenshotLabel} />
                  <em className="question-code review-row-code">{getQuestionDisplayId(question, questionRows)}</em>
                  <div className="review-card-main">
                    <strong>{formatQuestionName(question)}</strong>
                    <span>{[question.reviewRound, question.reviewTiming].filter(Boolean).join(" · ")}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      startReview(question.id);
                    }}
                  >
                    Review
                  </button>
                </div>
              ))}
            </section>
          ))}
        </div>
      </Panel>
      <Panel title="Check Answer">
        <div className="active-review-summary">
          <MathPreview label={activeQuestion.screenshotLabel} imageUrl={activeQuestion.screenshotUrl} />
          <strong>{formatQuestionName(activeQuestion)}</strong>
          <span>{activeQuestion.errorType}</span>
        </div>
        {reviewAnswerPanel}
        <div className="rule-list">
          {reviewRuleSummary.map((rule) => (
            <p key={rule}>{rule}</p>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function AnalyticsScreen({ isDemo, questions: questionRows }: { isDemo: boolean; questions: Question[] }) {
  const analyticsMetrics = isDemo
    ? [
        { label: "Logged Questions", value: "84", delta: "+12", tone: "blue" },
        { label: "Review Completion", value: "91%", delta: "+5%", tone: "green" },
        { label: "Review 1 Correct", value: "68%", delta: "+8%", tone: "green" },
        { label: "Review 2 Correct", value: "81%", delta: "+9%", tone: "green" }
      ]
    : buildAnalyticsMetrics(questionRows);
  const analyticsWeakTopics = isDemo ? normalizeWeakTopics() : buildWeakTopics(questionRows);
  const analyticsErrorTypes = isDemo ? errorTypes : buildErrorTypes(questionRows);
  const analyticsReviewQueue = isDemo ? reviewQueue.slice(0, 3) : buildReviewQueue(questionRows).slice(0, 3);
  const analyticsSourceMix = isDemo ? sourceMix : buildSourceMix(questionRows);

  return (
    <div className="analytics-grid">
      <section className="metric-row">
        {analyticsMetrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <em className={`tone-${metric.tone}`}>{metric.delta}</em>
          </article>
        ))}
      </section>

      <Panel className="effectiveness-panel" title="Delayed Review Effectiveness">
        <div className="comparison-chart">
          {["Review 1", "Review 2"].map((round, index) => (
            <div className="chart-column" key={round}>
              <span>{round}</span>
              <div style={{ height: index === 0 ? "58%" : "76%" }} />
              <strong>{index === 0 ? "68%" : "81%"}</strong>
            </div>
          ))}
        </div>
        <p className="quiet-copy">Second reviews are improving retention for Algebra and Percent questions.</p>
      </Panel>

      <Panel title="Category Pattern">
        <div className="progress-list">
          {analyticsWeakTopics.map((topic) => (
            <ProgressRow
              key={topic.label}
              label={topic.label}
              value={topic.missRate ?? topic.value}
              note={`${topic.missRate ?? topic.value}% of logged questions`}
              inverted
            />
          ))}
          {analyticsWeakTopics.length === 0 && <div className="empty-state compact">No category patterns yet.</div>}
        </div>
      </Panel>

      <Panel title="Error Type Breakdown">
        <div className="bar-list">
          {analyticsErrorTypes.map((item) => (
            <BarRow key={item.label} label={item.label} value={item.value} />
          ))}
          {analyticsErrorTypes.length === 0 && <div className="empty-state compact">No error types yet.</div>}
        </div>
      </Panel>

      <Panel title="Review Queue Health">
        <div className="review-queue compact">
          {analyticsReviewQueue.map((item) => (
            <div className="queue-stat" key={item.label}>
              <span>{item.label}</span>
              <strong className={`tone-${item.tone}`}>{item.value}</strong>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Where Errors Come From">
        <div className="bar-list">
          {analyticsSourceMix.map((item) => (
            <BarRow key={item.label} label={item.label} value={item.value} />
          ))}
          {analyticsSourceMix.length === 0 && <div className="empty-state compact">No sources yet.</div>}
        </div>
      </Panel>
    </div>
  );
}

function ReviewSettingsScreen({
  settings,
  onSettingsChange
}: {
  settings: ReviewSettings;
  onSettingsChange: (settings: ReviewSettings) => void;
}) {
  const updateDelay = (field: keyof ReviewSettings, delta: number) => {
    onSettingsChange({
      ...settings,
      [field]: Math.max(1, settings[field] + delta)
    });
  };

  return (
    <div className="settings-layout">
      <Panel title="Review Windows">
        <div className="settings-row">
          <div>
            <strong>First review</strong>
            <span>Default review after a question is logged.</span>
          </div>
          <Stepper value={`${settings.firstReviewDelayDays} days`} onDecrement={() => updateDelay("firstReviewDelayDays", -1)} onIncrement={() => updateDelay("firstReviewDelayDays", 1)} />
        </div>
        <div className="settings-row">
          <div>
            <strong>Second review</strong>
            <span>Optional after correct, required after wrong again.</span>
          </div>
          <Stepper value={`${settings.secondReviewDelayDays} days`} onDecrement={() => updateDelay("secondReviewDelayDays", -1)} onIncrement={() => updateDelay("secondReviewDelayDays", 1)} />
        </div>
      </Panel>
      <Panel title="Review Rules">
        <div className="rule-list">
          {reviewRuleSummary.map((rule) => (
            <p key={rule}>{rule}</p>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Panel({
  title,
  action,
  onAction,
  className,
  children
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={clsx("panel", className)}>
      <div className="panel-header">
        <h2>{title}</h2>
        {action && <button onClick={onAction} type="button">{action}</button>}
      </div>
      {children}
    </section>
  );
}

function ProgressRow({
  label,
  value,
  note,
  inverted = false
}: {
  label: string;
  value: number;
  note: string;
  inverted?: boolean;
}) {
  return (
    <div className="progress-row">
      <div>
        <strong>{label}</strong>
        <span>{note}</span>
      </div>
      <div className={clsx("progress-track", inverted && "inverted")}>
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function BarRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="bar-row">
      <span>{label}</span>
      <div>
        <i style={{ width: `${value}%` }} />
      </div>
      <strong>{value}%</strong>
    </div>
  );
}

function MathThumb({ id, imageUrl, label }: { id: string; imageUrl?: string; label: string }) {
  if (imageUrl) {
    return (
      <div className="math-thumb image-thumb" aria-label={`Screenshot preview: ${label}`}>
        <img alt={`Screenshot thumbnail: ${label}`} src={imageUrl} />
      </div>
    );
  }

  return (
    <div className="math-thumb id-thumb" aria-label={`Question id: ${id}`} title={id}>
      <span>{formatQuestionShortId(id)}</span>
    </div>
  );
}

function MathPreview({ label, imageUrl }: { label: string; imageUrl?: string }) {
  if (imageUrl) {
    return (
      <div className="math-preview image-preview" aria-label={`Screenshot preview: ${label}`}>
        <img alt={`Uploaded screenshot: ${label}`} src={imageUrl} />
      </div>
    );
  }

  return (
    <div className="math-preview" aria-label={`Screenshot preview: ${label}`}>
      <div className="equation-line">2x + 7 = 31</div>
      <div className="diagram-line" />
      <div className="small-lines">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function Stepper({
  value,
  onDecrement,
  onIncrement
}: {
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <div className="stepper">
      <button onClick={onDecrement} type="button">-</button>
      <span>{value}</span>
      <button onClick={onIncrement} type="button">+</button>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option || "none"} value={option}>{option || "No subcategory"}</option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field optional">
      <span>{label}</span>
      <input onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} />
    </label>
  );
}

function withTimeout<T>(request: PromiseLike<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Supabase request timed out. Please refresh and try again.")), timeoutMs);
    Promise.resolve(request)
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

function buildMetrics(questionRows: Question[]): DashboardMetric[] {
  const dueCount = questionRows.filter((question) => question.status === "Due" || question.status === "Overdue").length;
  const completedCount = questionRows.filter((question) => question.status === "Done").length;
  const scheduledCount = questionRows.filter((question) => question.status === "Scheduled").length;

  return [
    { label: "Accuracy", value: questionRows.length ? `${Math.round((completedCount / questionRows.length) * 100)}%` : "0%", delta: "from reviews", tone: "green" },
    { label: "Questions Logged", value: String(questionRows.length), delta: "owned by you", tone: "blue" },
    { label: "Reviews Due", value: String(dueCount), delta: "now", tone: dueCount > 0 ? "amber" : "green" },
    { label: "Scheduled", value: String(scheduledCount), delta: "upcoming", tone: "blue" }
  ];
}

function buildAnalyticsMetrics(questionRows: Question[]): DashboardMetric[] {
  const completedCount = questionRows.filter((question) => question.status === "Done").length;
  const dueCount = questionRows.filter((question) => question.status === "Due" || question.status === "Overdue").length;
  const completionRate = questionRows.length ? Math.round((completedCount / questionRows.length) * 100) : 0;

  return [
    { label: "Logged Questions", value: String(questionRows.length), delta: "total", tone: "blue" },
    { label: "Review Completion", value: `${completionRate}%`, delta: `${completedCount} done`, tone: "green" },
    { label: "Needs Attention", value: String(dueCount), delta: "due or overdue", tone: dueCount > 0 ? "amber" : "green" },
    { label: "Active Categories", value: String(new Set(questionRows.map((question) => question.topic)).size), delta: "tracked", tone: "blue" }
  ];
}

function buildReviewQueue(questionRows: Question[]): QueueStat[] {
  const dueCount = questionRows.filter((question) => question.status === "Due").length;
  const overdueCount = questionRows.filter((question) => question.status === "Overdue").length;
  const scheduledCount = questionRows.filter((question) => question.status === "Scheduled").length;
  const nextReview = questionRows.find((question) => question.status !== "Done")?.nextReview ?? "-";

  return [
    { label: "Due today", value: String(dueCount), tone: dueCount > 0 ? "blue" : "neutral" },
    { label: "Overdue", value: String(overdueCount), tone: overdueCount > 0 ? "coral" : "neutral" },
    { label: "Upcoming", value: String(scheduledCount), tone: "green" },
    { label: "Next review", value: nextReview, tone: "neutral" }
  ];
}

function buildTopicProgress(questionRows: Question[]): ProgressStat[] {
  return toPercentRows(countBy(questionRows, (question) => question.topic)).slice(0, 4);
}

function buildWeakTopics(questionRows: Question[]): ProgressStat[] {
  return toPercentRows(countBy(questionRows, (question) => question.topic)).slice(0, 4);
}

function normalizeWeakTopics(): ProgressStat[] {
  return weakTopics.map((topic) => ({
    label: topic.label,
    value: topic.missRate,
    missRate: topic.missRate
  }));
}

function buildErrorTypes(questionRows: Question[]) {
  return toPercentRows(countBy(questionRows, (question) => question.errorType));
}

function buildSourceMix(questionRows: Question[]) {
  return toPercentRows(countBy(questionRows, (question) => question.source ?? "Other"));
}

function buildRecentActivity(questionRows: Question[]) {
  return questionRows.slice(0, 4).map((question) => `Logged ${formatQuestionName(question)}`);
}

function formatQuestionName(question: Question) {
  return question.subtopic ? `${question.topic} / ${question.subtopic}` : question.topic;
}

function getQuestionDisplayId(question: Question, questionRows: Question[]) {
  const testPrefix = sanitizeCodePart(question.testType ?? "Q");
  const sectionPrefix = sectionCodePart(question.section);
  const groupQuestions = questionRows
    .filter((item) => sanitizeCodePart(item.testType ?? "Q") === testPrefix && sectionCodePart(item.section) === sectionPrefix)
    .sort((a, b) => {
      const loggedCompare = questionLoggedSortValue(a) - questionLoggedSortValue(b);
      if (loggedCompare !== 0) return loggedCompare;
      return a.id.localeCompare(b.id);
    });
  const index = Math.max(0, groupQuestions.findIndex((item) => item.id === question.id));

  return `${testPrefix}-${sectionPrefix}-${String(index + 1).padStart(6, "0")}`;
}

function sanitizeCodePart(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized || "Q";
}

function sectionCodePart(section?: string) {
  const normalized = sanitizeCodePart(section ?? "Q");
  const sectionCodes: Record<string, string> = {
    MATH: "M",
    READING: "R",
    ENGLISH: "E",
    SCIENCE: "S",
    WRITING: "W",
    VERBAL: "V"
  };

  return sectionCodes[normalized] ?? normalized.slice(0, 1);
}

function questionLoggedSortValue(question: Question) {
  const value = question.loggedAt ?? question.loggedDate;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function bankReviewStatus(question: Question) {
  return question.status === "Done" || question.reviewRound === "Done" ? "Done" : question.reviewRound;
}

function maskCorrectAnswer(value?: string) {
  return value?.trim() ? "★" : "Not set";
}

function groupReviewQuestions(questionRows: Question[], sortByDueDate = false) {
  const groups = questionRows.reduce<Map<string, Question[]>>((grouped, question) => {
    const label = [question.testType, question.section].filter(Boolean).join(" / ") || "Other";
    grouped.set(label, [...(grouped.get(label) ?? []), question]);
    return grouped;
  }, new Map());

  return Array.from(groups.entries()).map(([label, groupedQuestions]) => ({
    label,
    questions: sortByDueDate ? [...groupedQuestions].sort(sortQuestionsByReviewDueDate) : groupedQuestions
  }));
}

function sortQuestionsByReviewDueDate(a: Question, b: Question) {
  const dueCompare = reviewDueSortValue(a) - reviewDueSortValue(b);
  if (dueCompare !== 0) return dueCompare;
  return formatQuestionName(a).localeCompare(formatQuestionName(b));
}

function reviewDueSortValue(question: Question) {
  if (question.reviewDueDate) return Date.parse(`${question.reviewDueDate}T00:00:00Z`);
  if (question.status === "Overdue") return 0;
  if (question.status === "Due") return Date.parse(`${todayKey()}T00:00:00Z`);
  if (question.status === "Scheduled") return Number.MAX_SAFE_INTEGER - 1;
  return Number.MAX_SAFE_INTEGER;
}

function getReviewRoundNumber(reviewRound?: string) {
  const match = reviewRound?.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function countBy(questionRows: Question[], getKey: (question: Question) => string) {
  return questionRows.reduce<Map<string, number>>((counts, question) => {
    const key = getKey(question) || "Other";
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map());
}

function toPercentRows(counts: Map<string, number>) {
  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label,
      value: total ? Math.max(1, Math.round((count / total) * 100)) : 0
    }));
}

function LoadingScreen() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark">W</div>
        <h1>Loading WrongToStrong</h1>
        <p>Checking the student session.</p>
      </section>
    </main>
  );
}

function clearSupabaseLocalStorage() {
  try {
    Object.keys(window.localStorage)
      .filter((key) => key.includes("supabase") || key.startsWith("sb-"))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Best-effort cleanup only; Supabase signOut still runs after the UI resets.
  }
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: User) => Promise<void> }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const supabase = createClient();
    if (!supabase) return;
    const nextEmail = email.trim();
    const nextPassword = password;

    if (!nextEmail || !nextPassword) {
      setMessage("Enter both email and password.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response =
        mode === "signup"
          ? await supabase.auth.signUp({
              email: nextEmail,
              password: nextPassword,
              options: { data: { display_name: displayName || nextEmail.split("@")[0] } }
            })
          : await supabase.auth.signInWithPassword({ email: nextEmail, password: nextPassword });

      if (response.error) {
        setMessage(response.error.message);
        return;
      }

      const authenticatedUser = response.data.session?.user ?? null;
      if (authenticatedUser) {
        setMessage(mode === "signup" ? "Account created." : "Signed in.");
        await onAuthenticated(authenticatedUser);
        return;
      }

      setMessage("Account created. Please check your email to confirm it before signing in.");
    } catch {
      setMessage("Could not reach Supabase. Check network filtering, VPN, or browser privacy settings and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark">W</div>
        <h1>{mode === "signup" ? "Create student account" : "Student sign in"}</h1>
        <p>Each student owns their own questions, screenshots, and review windows.</p>

        {mode === "signup" && (
          <label className="field">
            <span>Display name</span>
            <input onChange={(event) => setDisplayName(event.target.value)} placeholder="Student name" value={displayName} />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input onInput={(event) => setEmail(event.currentTarget.value)} placeholder="student@example.com" type="email" value={email} />
        </label>
        <label className="field">
          <span>Password</span>
          <input onInput={(event) => setPassword(event.currentTarget.value)} placeholder="At least 6 characters" type="password" value={password} />
        </label>

        <button className="primary-action auth-action" disabled={busy} onClick={submit} type="button">
          {busy ? "Working..." : mode === "signup" ? "Create account" : "Sign in"}
        </button>
        <button
          className="link-action"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setMessage("");
          }}
          type="button"
        >
          {mode === "signup" ? "I already have an account" : "Create a student account"}
        </button>
        <a className="admin-back-link" href="/admin">
          Admin sign in
        </a>
        {message && <p className="notice">{message}</p>}
      </section>
    </main>
  );
}

function getUserDisplayName(user: User) {
  return user.user_metadata?.display_name || user.email?.split("@")[0] || "Student";
}

function mapDbQuestion(question: DbQuestion, reviews: DbReview[], screenshotUrl?: string): Question {
  const questionReviews = reviews.filter((review) => review.question_id === question.id);
  const scheduledReview = questionReviews
    .filter((review) => review.status === "scheduled")
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const completedReviews = questionReviews
    .filter((review) => review.status === "completed")
    .sort((a, b) => a.review_round - b.review_round);

  return {
    id: question.id,
    reviewId: scheduledReview?.id,
    screenshotPath: question.screenshot_path,
    screenshotUrl,
    testType: question.test_type,
    topic: question.topic,
    subtopic: question.subtopic ?? undefined,
    errorType: question.error_type,
    correctAnswer: question.correct_answer ?? "Not set",
    source: question.source ?? undefined,
    testName: question.test_name ?? undefined,
    section: question.section_module ?? undefined,
    questionNumber: question.question_number ?? undefined,
    loggedAt: question.logged_at,
    loggedDate: formatShortDate(question.logged_at),
    nextReview: scheduledReview ? formatDueDate(scheduledReview.due_date) : "-",
    reviewDueDate: scheduledReview?.due_date,
    reviewRound: scheduledReview ? `Review ${scheduledReview.review_round}` : completedReviews.length > 0 ? "Done" : "Review 1",
    reviewTiming: scheduledReview ? formatReviewTiming(question.logged_at, scheduledReview, completedReviews) : undefined,
    status: scheduledReview ? reviewStatusLabel(scheduledReview.due_date) : "Done",
    timeSpent: question.time_spent_seconds ? formatSeconds(question.time_spent_seconds) : undefined,
    correctStrategy: question.correct_strategy ?? undefined,
    notes: question.notes ?? undefined,
    screenshotLabel: (question.subtopic ?? question.topic).toLowerCase()
  };
}

function createLocalQuestion(payload: AddQuestionPayload, count: number): Question {
  return {
    id: `local-${Date.now()}`,
    testType: payload.form.testType,
    topic: payload.form.topic,
    subtopic: optionalText(payload.form.subtopic) ?? undefined,
    errorType: payload.form.errorType,
    correctAnswer: payload.form.correctAnswer.trim(),
    source: optionalText(payload.form.source) ?? "Local demo",
    testName: optionalText(payload.form.testName) ?? undefined,
    section: optionalText(payload.form.sectionModule) ?? undefined,
    questionNumber: optionalText(payload.form.questionNumber) ?? undefined,
    loggedAt: new Date().toISOString(),
    loggedDate: "Today",
    nextReview: `In ${demoStudent.firstReviewDelayDays} days`,
    reviewDueDate: futureDateKey(demoStudent.firstReviewDelayDays),
    reviewRound: "Review 1",
    reviewTiming: "0 days since logged",
    status: "Scheduled",
    timeSpent: optionalText(payload.form.timeSpent) ?? undefined,
    correctStrategy: optionalText(payload.form.correctStrategy) ?? undefined,
    notes: optionalText(payload.form.notes) ?? undefined,
    screenshotLabel: `${payload.form.topic} ${count}`
  };
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseTimeSpent(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const minuteMatch = trimmed.match(/(\d+)\s*m/i);
  const secondMatch = trimmed.match(/(\d+)\s*s/i);
  const plainNumber = trimmed.match(/^\d+$/);

  if (minuteMatch || secondMatch) {
    return Number(minuteMatch?.[1] ?? 0) * 60 + Number(secondMatch?.[1] ?? 0);
  }

  return plainNumber ? Number(plainNumber[0]) : null;
}

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatReviewTiming(loggedAt: string, scheduledReview: DbReview, completedReviews: DbReview[]) {
  const previousReview = completedReviews
    .filter((review) => review.review_round < scheduledReview.review_round && review.completed_at)
    .sort((a, b) => b.review_round - a.review_round)[0];
  const anchorDate = previousReview?.completed_at ?? loggedAt;
  const anchorLabel = previousReview ? `Review ${previousReview.review_round}` : "logged";
  const days = daysBetweenDateKeys(dateKey(anchorDate), todayKey());

  return `${days} ${days === 1 ? "day" : "days"} since ${anchorLabel}`;
}

function dateKey(value: string) {
  return value.slice(0, 10);
}

function daysBetweenDateKeys(startDate: string, endDate: string) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / msPerDay));
}

function formatDueDate(value: string) {
  const today = new Date();
  const due = new Date(`${value}T00:00:00`);
  if (value === todayKey()) return "Today";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(due);
}

function futureDateKey(daysFromToday: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function reviewStatusLabel(dueDate: string) {
  const currentTodayKey = todayKey();
  if (dueDate < currentTodayKey) return "Overdue";
  if (dueDate === currentTodayKey) return "Due";
  return "Scheduled";
}

function toReviewResult(value: string) {
  switch (value) {
    case "Wrong again":
      return "wrong_again";
    case "Still slow":
      return "still_slow";
    case "Needs review":
      return "needs_review";
    default:
      return "correct";
  }
}

function normalizeAnswer(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

async function imageFileToWebp(file: File) {
  const bitmap = await createImageBitmap(file);
  const maxWidth = 1200;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare image compression.");
  }
  context.drawImage(bitmap, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not compress screenshot."));
      },
      "image/webp",
      0.78
    );
  });
}
