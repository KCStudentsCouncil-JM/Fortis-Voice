import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Clock,
  LogOut,
  Save,
  ShieldCheck,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { ClassSelector } from '@/src/components/ui/ClassSelector';
import { CommonGroundEmblem } from '@/src/components/ui/CivicGraphics';
import { BRAND_CONFIG, KC_GRADES, PRIMARY_ADMIN_EMAIL } from '@/src/config/brand';
import { useCivic } from '@/src/context/CivicContext';

export const OnboardingView: React.FC = () => {
  const { snapshot, repo, navigate, pushToast } = useCivic();

  const me = snapshot.currentUser;

  // Student Profile Completion fields
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [grade, setGrade] = useState<string>(KC_GRADES[0]);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [affiliation, setAffiliation] = useState('');

  const [appealNote, setAppealNote] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const hydratedUidRef = useRef<string | null>(me?.uid ?? null);
  const lastSyncedUpdatedAtRef = useRef<string | null>(me?.updatedAt ?? null);

  useEffect(() => {
    if (!me) {
      hydratedUidRef.current = null;
      lastSyncedUpdatedAtRef.current = null;
      setIsDirty(false);
      return;
    }
    if (
      hydratedUidRef.current !== me.uid ||
      (!isDirty && me.updatedAt !== lastSyncedUpdatedAtRef.current)
    ) {
      hydratedUidRef.current = me.uid;
      lastSyncedUpdatedAtRef.current = me.updatedAt ?? null;
      setStudentName(me.studentName ?? '');
      setStudentClass(me.studentClass ?? '');
      setGrade(me.grade || KC_GRADES[0]);
      setDateOfBirth(me.dateOfBirth ?? '');
      setDisplayName(me.displayName ?? '');
      setAffiliation(me.affiliation ?? '');
      setIsDirty(false);
    }
  }, [me, isDirty]);

  const handleGoogleSignIn = async () => {
    if (!repo.signInWithGoogle || busy) return;
    setBusy(true);
    setFormError('');
    try {
      const res = await repo.signInWithGoogle();
      if (res.ok) {
        pushToast({ tone: 'success', title: 'Signed in with Google' });
      } else {
        setFormError(res.error || 'Google sign-in failed.');
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteFirebaseStudentProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me || busy) return;
    setFormError('');
    if (studentName.trim().length < 2 || studentClass.trim().length < 1 || !grade || !dateOfBirth) {
      setFormError("Please enter the student's full name, grade, class/form, and date of birth.");
      return;
    }
    setBusy(true);
    try {
      const res = await repo.updateProfile({
        studentName: studentName.trim(),
        studentClass: studentClass.trim(),
        grade,
        dateOfBirth,
        displayName: displayName.trim() || studentName.trim(),
        affiliation: affiliation.trim(),
        bio: me.bio ?? '',
        avatarId: me.avatarId,
        avatarDataUrl: me.avatarDataUrl,
      });
      if (res.ok) {
        setIsDirty(false);
        pushToast({ tone: 'success', title: 'Student details saved' });
        if (me.accountStatus === 'approved') {
          navigate({ view: 'feed' });
        }
      } else {
        setFormError(res.error || 'Could not save student details.');
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save student details.');
    } finally {
      setBusy(false);
    }
  };

  const handleAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setFormError('');
    setBusy(true);
    try {
      const res = await repo.submitAppeal(appealNote);
      if (!res.ok) {
        setFormError(res.error || 'Could not submit appeal.');
        return;
      }
      setAppealNote('');
      pushToast({
        tone: 'success',
        title: 'Appeal submitted',
        description: 'Your student profile has returned to the pending verification queue.',
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not submit appeal.');
    } finally {
      setBusy(false);
    }
  };

  const needsStudentDetails = Boolean(
    me && (!me.studentName || !me.studentClass || !me.grade || !me.dateOfBirth)
  );

  // Pending Verification Screen
  if (me && me.accountStatus === 'pending') {
    return (
      <div className="max-w-2xl mx-auto py-4 space-y-5">
        <div className="rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-6 sm:p-8 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
                Your student account is under review
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#5B506B] dark:text-[#B7A8CC]">
                Thank you for joining <strong>{BRAND_CONFIG.fullName}</strong>, {me.displayName}. To ensure every petition carries verified Kingston College student voices, Council moderators confirm student form details before unlocking signing and publishing.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl bg-[#FAF8FC] dark:bg-[#26173A] p-4 border border-[#E2D9EC] dark:border-[#372352] text-xs space-y-1.5">
            <p className="font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">Submitted Student Details</p>
            <p className="text-[#5B506B] dark:text-[#B7A8CC]">
              <strong>Student&apos;s Name:</strong> {me.studentName || 'Not provided'} ·{' '}
              <strong>Grade:</strong> {me.grade || 'Not provided'} ·{' '}
              <strong>Class:</strong> {me.studentClass || 'Not provided'} ·{' '}
              <strong>D.O.B.:</strong> {me.dateOfBirth || 'Not provided'}
            </p>
          </div>

          {needsStudentDetails && (
            <form onSubmit={handleCompleteFirebaseStudentProfile} className="mt-5 pt-5 border-t border-[#E2D9EC] dark:border-[#372352] space-y-3">
              <p className="text-sm font-semibold text-[#5B1586] dark:text-[#C084FC]">
                Please complete your student details so moderators can verify your enrolment:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pending-student-name" className="block text-xs font-semibold mb-1">
                    Student&apos;s Full Name
                  </label>
                  <input
                    id="pending-student-name"
                    type="text"
                    required
                    value={studentName}
                    onChange={(e) => { setStudentName(e.target.value); setIsDirty(true); }}
                    placeholder="e.g. Dante Williams"
                    className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
                  />
                </div>
                <div>
                  <label htmlFor="pending-display-name" className="block text-xs font-semibold mb-1">
                    Display Name
                  </label>
                  <input
                    id="pending-display-name"
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => { setDisplayName(e.target.value); setIsDirty(true); }}
                    placeholder="e.g. Dante W."
                    className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
                  />
                </div>
                <div>
                  <label htmlFor="pending-grade" className="block text-xs font-semibold mb-1">
                    Grade / Form
                  </label>
                  <select
                    id="pending-grade"
                    value={grade}
                    onChange={(e) => { setGrade(e.target.value); setIsDirty(true); }}
                    className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
                  >
                    {KC_GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="pending-class" className="block text-xs font-semibold mb-1">
                    Class
                  </label>
                  <ClassSelector
                    id="pending-class"
                    required
                    value={studentClass}
                    onChange={(val) => { setStudentClass(val); setIsDirty(true); }}
                  />
                </div>
                <div>
                  <label htmlFor="pending-dob" className="block text-xs font-semibold mb-1">
                    Date of Birth (D.O.B.)
                  </label>
                  <input
                    id="pending-dob"
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => { setDateOfBirth(e.target.value); setIsDirty(true); }}
                    className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
                  />
                </div>
                <div>
                  <label htmlFor="pending-affiliation" className="block text-xs font-semibold mb-1">
                    House / Club (optional)
                  </label>
                  <input
                    id="pending-affiliation"
                    type="text"
                    value={affiliation}
                    onChange={(e) => { setAffiliation(e.target.value); setIsDirty(true); }}
                    placeholder="e.g. Chapel House"
                    className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
                  />
                </div>
              </div>
              {formError && (
                <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300">
                  {formError}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-[#5B1586] hover:bg-[#460E69] px-4 py-2 text-sm font-semibold text-white"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                <span>Save student details</span>
              </button>
            </form>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate({ view: 'feed' })}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-[#5B1586] hover:bg-[#460E69] dark:bg-[#7E22CE] px-4 py-2 text-sm font-semibold text-white"
            >
              <span>Browse public petitions</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => navigate({ view: 'profile' })}
              className="min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-4 py-2 text-sm font-medium text-[#2B0B42] dark:text-[#F7F3FC]"
            >
              Edit student profile
            </button>
            <button
              type="button"
              onClick={() => void repo.signOut()}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-4 py-2 text-sm font-medium text-[#5B506B] dark:text-[#B7A8CC]"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Rejected Account Screen
  if (me && me.accountStatus === 'rejected') {
    return (
      <div className="max-w-2xl mx-auto py-4">
        <div className="rounded-2xl bg-white dark:bg-[#1B1029] border border-rose-300 dark:border-rose-800/70 p-6 sm:p-8 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
                Student verification was not approved
              </h1>
              <p className="mt-2 text-sm text-[#5B506B] dark:text-[#B7A8CC]">
                Moderator note for <strong>{me.email}</strong>:
              </p>
              <div className="mt-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-3.5 text-sm text-rose-900 dark:text-rose-200">
                {me.rejectionReason ||
                  'Your profile could not be verified as an enrolled Kingston College student.'}
              </div>
            </div>
          </div>

          <form onSubmit={handleAppealSubmit} className="mt-6 space-y-3">
            <label
              htmlFor="appeal-note"
              className="block text-sm font-semibold text-[#2B0B42] dark:text-[#F7F3FC]"
            >
              Submit a verification appeal
            </label>
            <textarea
              id="appeal-note"
              rows={3}
              value={appealNote}
              onChange={(e) => setAppealNote(e.target.value)}
              placeholder="Provide your correct form teacher, class/grade, or student ID details for re-review…"
              className="w-full rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] p-3 text-sm"
            />
            {formError && (
              <p className="text-xs font-medium text-rose-700 dark:text-rose-300">{formError}</p>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="min-h-[44px] rounded-lg bg-[#5B1586] hover:bg-[#460E69] px-4 py-2 text-sm font-semibold text-white"
              >
                Send appeal for review
              </button>
              <button
                type="button"
                onClick={() => void repo.signOut()}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-4 py-2 text-sm font-medium"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start py-2">
      {/* Left: Kingston College Identity & Verification Explanation */}
      <section className="lg:col-span-5 rounded-2xl bg-gradient-to-br from-white via-[#FAF6FE] to-[#EFE2FC] dark:bg-none dark:bg-[#1B1029] border border-[#DFD1EE] dark:border-[#372352] shadow-xs p-6 sm:p-7 space-y-5">
        <div className="flex items-center gap-3.5">
          <CommonGroundEmblem className="w-16 h-16 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-[#5B1586] dark:text-[#C084FC]">
              {BRAND_CONFIG.schoolName}
            </p>
            <p className="text-sm font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
              {BRAND_CONFIG.fullName}
            </p>
            <p className="text-xs italic text-[#5B506B] dark:text-[#B7A8CC]">
              {BRAND_CONFIG.motto}
            </p>
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#2B0B42] dark:text-[#F7F3FC] [text-wrap:balance]">
            Student governance built on verified Fortis voices
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-[#5B506B] dark:text-[#B7A8CC]">
            {BRAND_CONFIG.mission}
          </p>
        </div>
        <div className="space-y-3 pt-2 border-t border-[#E2D9EC] dark:border-[#372352] text-sm">
          <div className="flex items-start gap-3">
            <UserCheck className="w-5 h-5 text-[#0F766E] dark:text-[#2DD4BF] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">Student identity verification</p>
              <p className="text-xs text-[#5B506B] dark:text-[#B7A8CC] leading-relaxed">
                Each student verifies with their full name, grade, class/form, and date of birth so School Administration can trust petition counts. You can still submit petitions anonymously while moderators keep an internal audit trail.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#5B1586] dark:text-[#C084FC] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">Server-enforced security</p>
              <p className="text-xs text-[#5B506B] dark:text-[#B7A8CC] leading-relaxed">
                Authenticated with Google Sign-In and enforced by Cloud Firestore Security Rules.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Right: Auth Card */}
      <section className="lg:col-span-7 rounded-2xl bg-white/95 dark:bg-[#1B1029] border border-[#DFD1EE] dark:border-[#372352] shadow-xs p-6 sm:p-8">
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
            {me ? `Signed in as ${me.displayName}` : 'Sign in with Google'}
          </h2>
          <p className="text-sm text-[#5B506B] dark:text-[#B7A8CC]">
            Sign in with your verified Google account. Signing in with <strong>{PRIMARY_ADMIN_EMAIL}</strong> grants Main Administrator access; students complete their details so Council moderators can verify enrolment.
          </p>
          {formError && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-950/40 p-3 text-sm text-rose-800 dark:text-rose-200">
              {formError}
            </div>
          )}
          {!me ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleGoogleSignIn()}
              className="min-h-[48px] w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-lg bg-[#5B1586] hover:bg-[#460E69] dark:bg-[#7E22CE] dark:hover:bg-[#9333EA] px-6 py-3 text-sm font-semibold text-white transition-colors"
            >
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              <span>{busy ? 'Opening Google Sign-In…' : 'Continue with Google'}</span>
            </button>
          ) : (
            <form onSubmit={handleCompleteFirebaseStudentProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="fb-student-name" className="block text-xs font-semibold text-[#2B0B42] dark:text-[#F7F3FC] mb-1">
                    Student&apos;s Full Name
                  </label>
                  <input
                    id="fb-student-name"
                    type="text"
                    required
                    value={studentName}
                    onChange={(e) => { setStudentName(e.target.value); setIsDirty(true); }}
                    placeholder="e.g. Dante Williams"
                    className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
                  />
                </div>
                <div>
                  <label htmlFor="fb-display-name" className="block text-xs font-semibold text-[#2B0B42] dark:text-[#F7F3FC] mb-1">
                    Display Name
                  </label>
                  <input
                    id="fb-display-name"
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => { setDisplayName(e.target.value); setIsDirty(true); }}
                    placeholder="e.g. Dante W."
                    className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
                  />
                </div>
                <div>
                  <label htmlFor="fb-grade" className="block text-xs font-semibold text-[#2B0B42] dark:text-[#F7F3FC] mb-1">
                    Grade / Form
                  </label>
                  <select
                    id="fb-grade"
                    value={grade}
                    onChange={(e) => { setGrade(e.target.value); setIsDirty(true); }}
                    className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
                  >
                    {KC_GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="fb-class" className="block text-xs font-semibold text-[#2B0B42] dark:text-[#F7F3FC] mb-1">
                    Class
                  </label>
                  <ClassSelector
                    id="fb-class"
                    required
                    value={studentClass}
                    onChange={(val) => { setStudentClass(val); setIsDirty(true); }}
                  />
                </div>
                <div>
                  <label htmlFor="fb-dob" className="block text-xs font-semibold text-[#2B0B42] dark:text-[#F7F3FC] mb-1">
                    Date of Birth (D.O.B.)
                  </label>
                  <input
                    id="fb-dob"
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => { setDateOfBirth(e.target.value); setIsDirty(true); }}
                    className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
                  />
                </div>
                <div>
                  <label htmlFor="fb-affiliation" className="block text-xs font-semibold text-[#2B0B42] dark:text-[#F7F3FC] mb-1">
                    House / Club (optional)
                  </label>
                  <input
                    id="fb-affiliation"
                    type="text"
                    value={affiliation}
                    onChange={(e) => { setAffiliation(e.target.value); setIsDirty(true); }}
                    placeholder="e.g. Gibson House"
                    className="w-full min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] bg-[#FAF8FC] dark:bg-[#120A1C] px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-[#5B1586] hover:bg-[#460E69] px-5 py-2 text-sm font-semibold text-white"
                >
                  <Save className="w-4 h-4" aria-hidden="true" />
                  <span>Save Student Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ view: 'profile' })}
                  className="min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-4 py-2 text-sm font-medium"
                >
                  Full Profile Settings
                </button>
                <button
                  type="button"
                  onClick={() => void repo.signOut()}
                  className="min-h-[44px] rounded-lg border border-[#E2D9EC] dark:border-[#372352] px-4 py-2 text-sm font-medium text-[#5B506B] dark:text-[#B7A8CC]"
                >
                  Sign out
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};
