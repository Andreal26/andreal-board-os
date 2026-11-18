'use client';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

// Categorical palette validated (dataviz validator, dark surface #161a1f): teal → coral → violet.
export const SERIES = ['#16968b', '#f2584d', '#8f7cf0'];
const STATUS = { 'On Track': '#2fbf71', 'At Risk': '#f2a93b', Delayed: '#ff4e42' } as Record<string, string>;
const AGEING = ['#f7b2ab', '#f4867c', '#f2584d', '#c23a30'];

const axis = { stroke: '#4a525e', tick: { fill: '#9aa3ad', fontSize: 11 }, tickLine: false, axisLine: false } as const;
const grid = <CartesianGrid stroke="#262c34" vertical={false} />;

const compact = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `₹${(v / 1e3).toFixed(0)}K`;
  return `₹${v}`;
};
const inr = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;

function Tip({ active, payload, label, money = true }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-ink-600 bg-ink-900/95 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-white">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-gray-300">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: p.color || p.payload?.fill }} />
          <span>{p.name}</span>
          <span className="ml-auto pl-3 font-medium text-white">{money && p.dataKey !== 'count' && p.dataKey !== 'leads' && p.dataKey !== 'mql' && p.dataKey !== 'sql' ? inr(p.value) : Number(p.value).toLocaleString('en-IN')}</span>
        </div>
      ))}
    </div>
  );
}

function Frame({ title, sub, children, empty }: { title: string; sub?: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="card card-pad">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
      </div>
      {empty ? <div className="flex h-56 items-center justify-center text-sm text-ink-500">No data for this view yet</div> : <div className="h-56">{children}</div>}
    </div>
  );
}

const legend = <Legend iconType="square" iconSize={9} wrapperStyle={{ fontSize: 11, color: '#9aa3ad' }} />;

export function PipelineChart({ data }: { data: { stage: string; value: number; weighted: number; count: number }[] }) {
  return (
    <Frame title="Open pipeline by stage" sub="Expected vs probability-weighted value" empty={!data.some((d) => d.value)}>
      <ResponsiveContainer>
        <BarChart data={data} barGap={2} margin={{ left: 4, right: 8, top: 4 }}>
          {grid}
          <XAxis dataKey="stage" {...axis} />
          <YAxis tickFormatter={compact} width={56} {...axis} />
          <Tooltip content={<Tip />} cursor={{ fill: '#ffffff08' }} />
          {legend}
          <Bar dataKey="value" name="Expected" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="weighted" name="Weighted" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

export function FunnelChart({ data }: { data: { channel: string; leads: number; mql: number; sql: number }[] }) {
  return (
    <Frame title="Marketing funnel by channel" sub="Leads → MQL → SQL in the period" empty={!data.length}>
      <ResponsiveContainer>
        <BarChart data={data} barGap={2} margin={{ left: 4, right: 8, top: 4 }}>
          {grid}
          <XAxis dataKey="channel" {...axis} />
          <YAxis allowDecimals={false} width={40} {...axis} />
          <Tooltip content={<Tip money={false} />} cursor={{ fill: '#ffffff08' }} />
          {legend}
          <Bar dataKey="leads" name="Leads" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={24} />
          <Bar dataKey="mql" name="MQL" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={24} />
          <Bar dataKey="sql" name="SQL" fill={SERIES[2]} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

export function CashChart({ data }: { data: { month: string; collections: number; payments: number; net: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: new Date(d.month + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }) }));
  return (
    <Frame title="Cash in vs cash out" sub="Last 6 months · line = net cashflow" empty={!data.some((d) => d.collections || d.payments)}>
      <ResponsiveContainer>
        <ComposedChart data={rows} barGap={2} margin={{ left: 4, right: 8, top: 4 }}>
          {grid}
          <XAxis dataKey="label" {...axis} />
          <YAxis tickFormatter={compact} width={56} {...axis} />
          <Tooltip content={<Tip />} cursor={{ fill: '#ffffff08' }} />
          {legend}
          <Bar dataKey="collections" name="Collections" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={24} />
          <Bar dataKey="payments" name="Payments" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={24} />
          <Line dataKey="net" name="Net" stroke={SERIES[2]} strokeWidth={2} dot={{ r: 4, fill: SERIES[2], stroke: '#161a1f', strokeWidth: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </Frame>
  );
}

export function AgeingChart({ data }: { data: { bucket: string; value: number }[] }) {
  return (
    <Frame title="Receivables ageing" sub="Darker = older and riskier" empty={!data.some((d) => d.value)}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: 4, right: 8, top: 4 }}>
          {grid}
          <XAxis dataKey="bucket" {...axis} />
          <YAxis tickFormatter={compact} width={56} {...axis} />
          <Tooltip content={<Tip />} cursor={{ fill: '#ffffff08' }} />
          <Bar dataKey="value" name="Outstanding" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((_, i) => <Cell key={i} fill={AGEING[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

export function OpsChart({ data }: { data: { status: string; count: number; value: number }[] }) {
  return (
    <Frame title="Open jobs by delivery status" sub="Job value at risk" empty={!data.some((d) => d.count)}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: 4, right: 8, top: 4 }}>
          {grid}
          <XAxis dataKey="status" {...axis} />
          <YAxis tickFormatter={compact} width={56} {...axis} />
          <Tooltip content={<Tip />} cursor={{ fill: '#ffffff08' }} />
          <Bar dataKey="value" name="Job value" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((d) => <Cell key={d.status} fill={STATUS[d.status] ?? SERIES[0]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}
