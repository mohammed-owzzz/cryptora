import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface Point {
  label: string;
  value: number;
}

function ChartTooltip({ active, payload, label, suffix = '', format }: any) {
  if (!active || !payload?.length) return null;
  const raw = Number(payload[0].value);
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 shadow-card">
      <p className="text-[11px] font-medium text-ink/50">{label ?? payload[0].name}</p>
      <p className="text-[13px] font-semibold text-ink">
        {format ? format(raw) : `${raw.toLocaleString()} ${suffix}`}
      </p>
    </div>
  );
}

const ENTRANCE = { animationDuration: 750, animationEasing: 'ease-out' as const };

export function ParticipationChart({ data, height = 220 }: { data: Point[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full min-w-0 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="limeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C6F65A" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#C6F65A" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#EFEFEC" strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#9AA096', fontSize: 10.5 }}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: '#9AA096', fontSize: 10.5 }} width={48} />
          <Tooltip content={<ChartTooltip suffix="ballots" />} cursor={{ stroke: '#DCE0D6' }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#8FD01A"
            strokeWidth={2}
            fill="url(#limeFill)"
            dot={false}
            activeDot={{ r: 4, fill: '#111210' }}
            {...ENTRANCE}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ElectionsBarChart({
  data,
  height = 210,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full min-w-0 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={26}>
          <CartesianGrid stroke="#EFEFEC" strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#9AA096', fontSize: 10 }}
            interval={0}
            height={44}
          />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: '#9AA096', fontSize: 10.5 }} width={40} />
          <Tooltip content={<ChartTooltip suffix="ballots" />} cursor={{ fill: 'rgba(240,241,238,0.6)' }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} {...ENTRANCE}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === 0 ? '#C6F65A' : i === 1 ? '#2049CC' : '#DDE4D5'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Participation rate per election, bound to the elections returned by the API.
 * The bar track is the eligible electorate; the fill is the share that voted.
 */
export function ParticipationBars({
  data,
  height = 260,
}: {
  data: { label: string; name?: string; participation: number; cast: number; eligible: number }[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full min-w-0 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 34, left: 4, bottom: 4 }} barCategoryGap={10}>
          <CartesianGrid stroke="#F1F2EE" strokeDasharray="3 5" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#9AA096', fontSize: 10 }}
            tickFormatter={(value) => `${value}%`}
          />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            width={112}
            tick={{ fill: '#6B7268', fontSize: 10 }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(240,241,238,0.55)' }}
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload;
              return (
                <div className="rounded-lg border border-line bg-white px-3 py-2 shadow-card">
                  <p className="text-[11px] font-medium text-ink/50">{row.name ?? row.label}</p>
                  <p className="text-[13px] font-semibold text-ink">{row.participation}% participation</p>
                  <p className="mt-0.5 text-[11px] text-ink/50">
                    {row.cast.toLocaleString()} of {row.eligible.toLocaleString()} eligible voters
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="participation" radius={[0, 4, 4, 0]} {...ENTRANCE} background={{ fill: '#F4F5F1' }}>
            {data.map((row, i) => (
              <Cell key={i} fill={i % 2 === 0 ? '#C6F65A' : '#B7E64F'} />
            ))}
            <LabelList
              dataKey="participation"
              position="right"
              formatter={(value: number) => `${value}%`}
              style={{ fill: '#6B7268', fontSize: 10.5 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface DonutDatum {
  label: string;
  value: number;
  color?: string;
}

export function DonutChart({
  data,
  height = 168,
  centerLabel,
  centerValue,
}: {
  data: DonutDatum[];
  height?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const palette = ['#C6F65A', '#2049CC', '#D9DDD6', '#B42318', '#8FD01A'];

  if (total === 0) {
    return <p className="py-6 text-center text-[12px] text-ink/45">No records to chart.</p>;
  }

  return (
    <div className="min-w-0">
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={1.5}
              startAngle={90}
              endAngle={-270}
              stroke="#FFFFFF"
              strokeWidth={2}
              {...ENTRANCE}
            >
              {data.map((datum, i) => (
                <Cell key={datum.label} fill={datum.color ?? palette[i % palette.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip format={(value: number) => value.toLocaleString()} />} />
          </PieChart>
        </ResponsiveContainer>
        {centerValue && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="font-display text-[22px] font-bold leading-none">{centerValue}</p>
            {centerLabel && <p className="mt-1 text-[10.5px] text-ink/45">{centerLabel}</p>}
          </div>
        )}
      </div>
      <ul className="mt-2 space-y-1.5">
        {data.map((datum, i) => (
          <li key={datum.label} className="flex items-center justify-between gap-3 text-[11.5px]">
            <span className="flex min-w-0 items-center gap-2 text-ink/55">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: datum.color ?? palette[i % palette.length] }}
                aria-hidden
              />
              <span className="truncate capitalize">{datum.label.toLowerCase().replace(/_/g, ' ')}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums text-ink/70">
              {datum.value.toLocaleString()}
              <span className="ml-1 text-ink/35">{Math.round((datum.value / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
