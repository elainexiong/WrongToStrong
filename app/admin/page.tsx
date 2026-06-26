"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { AdminStudentSummary } from "@/lib/supabase/types";
import type { User } from "@supabase/supabase-js";

export default function AdminPage() {
  const supabaseEnabled = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(supabaseEnabled);
  const [busy, setBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState("");
  const [students, setStudents] = useState<AdminStudentSummary[]>([]);
  const totals = useMemo(() => buildAdminTotals(students), [students]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        await checkAdminAndLoad();
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        await checkAdminAndLoad();
      } else {
        setIsAdmin(false);
        setStudents([]);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const checkAdminAndLoad = async () => {
    const supabase = createClient();
    if (!supabase) return;

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.rpc("is_admin");
    if (error || data !== true) {
      setIsAdmin(false);
      setStudents([]);
      setMessage(error?.message ?? "This account is signed in, but it is not an admin account.");
      setLoading(false);
      return;
    }

    setIsAdmin(true);
    await loadStudents();
    setLoading(false);
  };

  const loadStudents = async (options: { keepMessage?: boolean } = {}) => {
    const supabase = createClient();
    if (!supabase) return;

    const { data, error } = await supabase
      .rpc("admin_student_summaries")
      .returns<AdminStudentSummary[]>();

    if (error) {
      setMessage(error.message);
      setStudents([]);
      return;
    }

    setStudents((data ?? []) as AdminStudentSummary[]);
    if (!options.keepMessage) {
      setMessage("");
    }
  };

  const signIn = async () => {
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
    const { data, error } = await supabase.auth.signInWithPassword({ email: nextEmail, password: nextPassword });
    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    setUser(data.user);
    await checkAdminAndLoad();
    setBusy(false);
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase?.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setStudents([]);
  };

  const deleteStudent = async (student: AdminStudentSummary) => {
    if (!window.confirm(`Delete ${student.display_name}'s account and all saved question data? This cannot be undone.`)) {
      return;
    }

    const supabase = createClient();
    if (!supabase) return;

    setBusy(true);
    const { error } = await supabase.rpc("admin_delete_student", { p_student_id: student.student_id });
    if (error) {
      setMessage(error.message);
    } else {
      setStudents((current) => current.filter((item) => item.student_id !== student.student_id));
      setMessage(`${student.display_name} was deleted.`);
      await loadStudents({ keepMessage: true });
    }
    setBusy(false);
  };

  if (!supabaseEnabled) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand-mark">W</div>
          <h1>Admin unavailable</h1>
          <p>Connect Supabase first, then use the admin entry.</p>
        </section>
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main className="auth-shell">
        <section className="auth-card admin-auth-card">
          <div className="brand-mark">W</div>
          <h1>Admin sign in</h1>
          <p>View student account summaries and manage accounts.</p>
          <label className="field">
            <span>Email</span>
            <input onInput={(event) => setEmail(event.currentTarget.value)} placeholder="admin@example.com" type="email" value={email} />
          </label>
          <label className="field">
            <span>Password</span>
            <input onInput={(event) => setPassword(event.currentTarget.value)} placeholder="Admin account password" type="password" value={password} />
          </label>
          <button className="primary-action auth-action" disabled={busy || loading} onClick={signIn} type="button">
            {busy || loading ? "Checking..." : "Sign in as admin"}
          </button>
          {user && !isAdmin && (
            <button className="select-button auth-action" onClick={signOut} type="button">
              Sign out
            </button>
          )}
          <a className="admin-back-link" href="/">
            <ArrowLeft size={16} />
            Student login
          </a>
          {message && <p className="notice">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <span className="admin-eyebrow"><ShieldCheck size={16} /> Admin</span>
          <h1>Student Accounts</h1>
          <p>Aggregate activity only. Question details, screenshots, and answers stay private to each student.</p>
        </div>
        <div className="admin-actions">
          <a className="select-button" href="/">
            <ArrowLeft size={16} />
            Student app
          </a>
          <button className="select-button" disabled={busy} onClick={() => loadStudents()} type="button">
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="select-button" onClick={signOut} type="button">
            Sign out
          </button>
        </div>
      </header>

      <section className="metric-row admin-metrics">
        <article className="metric-card">
          <span>Students</span>
          <strong>{totals.students}</strong>
          <em className="tone-blue">accounts</em>
        </article>
        <article className="metric-card">
          <span>Questions Logged</span>
          <strong>{totals.questions}</strong>
          <em className="tone-green">all students</em>
        </article>
        <article className="metric-card">
          <span>Due Reviews</span>
          <strong>{totals.dueReviews}</strong>
          <em className={totals.dueReviews > 0 ? "tone-amber" : "tone-green"}>now</em>
        </article>
      </section>

      <section className="panel admin-panel">
        <div className="panel-header">
          <h2>Account Summary</h2>
        </div>
        <div className="admin-table">
          <div className="admin-table-head">
            <span>Student</span>
            <span>Questions</span>
            <span>Due</span>
            <span>Done</span>
            <span>Categories</span>
            <span>Control</span>
          </div>
          {students.map((student) => (
            <article className="admin-row" key={student.student_id}>
              <div className="admin-student-cell">
                <strong>{student.display_name}</strong>
                <span>{student.email}</span>
                <em>Joined {formatAdminDate(student.created_at)}</em>
              </div>
              <strong>{student.total_questions}</strong>
              <strong>{student.due_reviews}</strong>
              <strong>{student.done_questions}</strong>
              <div className="admin-category-list">
                {Object.entries(student.category_counts).length > 0 ? (
                  Object.entries(student.category_counts).map(([category, count]) => (
                    <span key={category}>{category}: {count}</span>
                  ))
                ) : (
                  <span>No questions yet</span>
                )}
              </div>
              <button className="danger-button" disabled={busy} onClick={() => deleteStudent(student)} type="button">
                <Trash2 size={16} />
                Delete
              </button>
            </article>
          ))}
          {students.length === 0 && <div className="empty-state">No student accounts found.</div>}
        </div>
      </section>

      {message && <p className="global-notice">{message}</p>}
    </main>
  );
}

function buildAdminTotals(students: AdminStudentSummary[]) {
  return students.reduce(
    (totals, student) => ({
      students: totals.students + 1,
      questions: totals.questions + student.total_questions,
      dueReviews: totals.dueReviews + student.due_reviews
    }),
    { students: 0, questions: 0, dueReviews: 0 }
  );
}

function formatAdminDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
