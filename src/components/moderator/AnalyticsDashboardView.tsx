import React, { useMemo } from 'react';
import { Download } from 'lucide-react';
import { ProgressBar } from '@/src/components/ui/Primitives';
import { PETITION_CATEGORIES } from '@/src/config/brand';
import { useCivic } from '@/src/context/CivicContext';
import { downloadTextFile, generateAnalyticsCsv } from '@/src/utils/export';
import { evaluatePetitionSla } from '@/src/utils/sla';

export const AnalyticsDashboardView: React.FC = () => {
  const { snapshot, permissions, getDisplaySignatureCount, pushToast } = useCivic();

  const metrics = useMemo(() => {
    const nonDraftPetitions = snapshot.petitions.filter((p) => p.status !== 'draft');
    const livePetitions = snapshot.petitions.filter((p) => p.status === 'live');
    const resolvedOrResponded = nonDraftPetitions.filter(
      (p) => p.status === 'responded' || p.status === 'achieved'
    );
    const totalSignatures = nonDraftPetitions.reduce(
      (sum, p) => sum + getDisplaySignatureCount(p.id, p.signatureCount),
      0
    );
    const responseRate =
      nonDraftPetitions.length > 0
        ? Math.round((resolvedOrResponded.length / nonDraftPetitions.length) * 100)
        : 0;

    let slaOnTrack = 0;
    let slaDueSoon = 0;
    let slaOverdue = 0;
    let slaResponded = 0;

    for (const p of livePetitions.concat(resolvedOrResponded)) {
      const s = evaluatePetitionSla(p);
      if (s.state === 'responded') slaResponded++;
      else if (s.state === 'overdue') slaOverdue++;
      else if (s.state === 'due_soon') slaDueSoon++;
      else if (s.state === 'on_track') slaOnTrack++;
    }

    const categoryRows = PETITION_CATEGORIES.map((cat) => {
      const items = nonDraftPetitions.filter((p) => p.category === cat);
      const sigs = items.reduce(
        (sum, p) => sum + getDisplaySignatureCount(p.id, p.signatureCount),
        0
      );
      return {
        category: cat,
        count: items.length,
        signatures: sigs,
      };
    }).sort((a, b) => b.count - a.count || b.signatures - a.signatures);

    const verifiedMembers = snapshot.members.filter(
      (m) => m.accountStatus === 'approved'
    ).length;

    const totalEventRsvps = snapshot.events.reduce((sum, e) => sum + e.rsvpCount, 0);

    return {
      totalPetitions: nonDraftPetitions.length,
      liveCount: livePetitions.length,
      totalSignatures,
      responseRate,
      slaOnTrack,
      slaDueSoon,
      slaOverdue,
      slaResponded,
      categoryRows,
      verifiedMembers,
      totalEventRsvps,
    };
  }, [getDisplaySignatureCount, snapshot.events, snapshot.members, snapshot.petitions]);

  if (!permissions.canViewAnalytics) {
    return (
      <div className="max-w-2xl mx-auto rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-8 text-center">
        <h1 className="text-xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
          Council Moderator access required
        </h1>
      </div>
    );
  }

  const handleExportCsv = () => {
    const rows = snapshot.petitions
      .filter((p) => p.status !== 'draft')
      .map((p) => {
        const sla = evaluatePetitionSla(p);
        return {
          Reference: p.referenceNumber,
          Title: p.title,
          Category: p.category,
          Urgency: p.urgency,
          Status: p.status,
          Location: p.location,
          Signatures: getDisplaySignatureCount(p.id, p.signatureCount),
          Goal: p.goalSignatures,
          SLA_State: sla.state,
          SLA_Summary: sla.label,
          CreatedAt: p.createdAt,
        };
      });

    const csv = generateAnalyticsCsv(rows);
    downloadTextFile(
      `kc-council-analytics-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
    pushToast({ tone: 'success', title: 'Analytics CSV exported' });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
            Students&apos; Council Analytics
          </h1>
          <p className="mt-1 text-sm text-[#5B506B] dark:text-[#B7A8CC]">
            Signature momentum, official response rates, and SLA window health across campus issues.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-[#5B1586] hover:bg-[#460E69] dark:bg-[#7E22CE] px-4 py-2 text-sm font-semibold text-white"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          <span>Download CSV</span>
        </button>
      </div>

      {/* Top KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Total non-draft petitions', value: metrics.totalPetitions },
          { label: 'Live open petitions', value: metrics.liveCount },
          { label: 'Total verified signatures', value: metrics.totalSignatures.toLocaleString() },
          { label: 'Response / achievement rate', value: `${metrics.responseRate}%` },
          { label: 'Verified KC students', value: metrics.verifiedMembers },
          { label: 'Campus event RSVPs', value: metrics.totalEventRsvps },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-5"
          >
            <p className="text-xs font-medium text-[#5B506B] dark:text-[#B7A8CC]">{kpi.label}</p>
            <p className="mt-2 text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#2B0B42] dark:text-[#F7F3FC]">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Breakdown */}
        <section className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
            Category breakdown
          </h2>
          <div className="space-y-4">
            {metrics.categoryRows.map((row) => (
              <div key={row.category} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#2B0B42] dark:text-[#F7F3FC]">
                    {row.category}
                  </span>
                  <span className="font-mono tabular-nums text-[#5B506B] dark:text-[#B7A8CC]">
                    {row.count} petitions · {row.signatures.toLocaleString()} signatures
                  </span>
                </div>
                <ProgressBar
                  current={row.count}
                  goal={Math.max(1, metrics.totalPetitions)}
                  tone="ember"
                  label={`${row.category}: ${row.count} petitions`}
                />
              </div>
            ))}
          </div>
        </section>

        {/* SLA Response Window Health */}
        <section className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#1B1029] border border-[#E2D9EC] dark:border-[#372352] p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#2B0B42] dark:text-[#F7F3FC]">
            Response SLA health readout
          </h2>
          <p className="text-xs text-[#5B506B] dark:text-[#B7A8CC]">
            Tracks target response deadlines (24h urgent, 48h standard, 72h low) from petition publication.
          </p>

          <dl className="space-y-3 pt-2">
            {[
              { label: 'Responded / Achieved', val: metrics.slaResponded, tone: 'text-[#0F766E] dark:text-[#2DD4BF]' },
              { label: 'On track within window', val: metrics.slaOnTrack, tone: 'text-[#2B0B42] dark:text-[#F7F3FC]' },
              { label: 'Due soon (< 25% remaining)', val: metrics.slaDueSoon, tone: 'text-amber-700 dark:text-amber-300' },
              { label: 'Overdue response window', val: metrics.slaOverdue, tone: 'text-[#9F1239] dark:text-[#FDA4AF]' },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-xl bg-[#FAF8FC] dark:bg-[#26173A] px-4 py-3 border border-[#E2D9EC] dark:border-[#372352]"
              >
                <dt className="text-xs font-medium text-[#261D33] dark:text-[#E7DFF2]">
                  {item.label}
                </dt>
                <dd className={`text-lg font-bold font-mono tabular-nums ${item.tone}`}>
                  {item.val}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
};
