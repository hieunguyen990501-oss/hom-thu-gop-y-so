"use client";
// Biểu đồ bảng điều hành (Recharts, chạy cục bộ, không tải thư viện từ CDN).
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { EmptyState } from "@/components/ui";

const PALETTE = ["#8a2323", "#5f6b3a", "#b08a43", "#3f5f7a", "#7a4f8a", "#a9603a", "#4f7a6a", "#7d7d72", "#c9a35a"];
const STATUS_COLORS: Record<string, string> = {
  NEW: "#9b2c2c", CLASSIFYING: "#b08a43", ASSIGNED: "#5f6b3a", IN_PROGRESS: "#3f6f9a", WAITING_INFO: "#c9852a",
  PENDING_APPROVAL: "#7a4f8a", RESOLVED: "#3d7a3d", CLOSED_NO_ACTION: "#8a8a80", TRANSFERRED: "#5c6878",
};
const axis = { fontSize: 12, fill: "#4a4a44" };
const tooltipStyle = { fontSize: 13, borderRadius: 6, border: "1px solid #ece4d2" };

export function MonthlyChart({ data }: { data: { label: string; received: number; resolved: number }[] }) {
  if (!data.some((d) => d.received || d.resolved)) return <EmptyState title="Chưa có dữ liệu trong khoảng thời gian" />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ece4d2" vertical={false} />
        <XAxis dataKey="label" tick={axis} />
        <YAxis allowDecimals={false} tick={axis} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 13 }} />
        <Bar dataKey="received" name="Tiếp nhận" fill="#8a2323" radius={[3, 3, 0, 0]} />
        <Bar dataKey="resolved" name="Đã giải quyết" fill="#5f6b3a" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({ data }: { data: { label: string; received: number; resolved: number; cumReceived: number; cumResolved: number }[] }) {
  if (!data.some((d) => d.cumReceived)) return <EmptyState title="Chưa có dữ liệu" />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ece4d2" vertical={false} />
        <XAxis dataKey="label" tick={axis} />
        <YAxis allowDecimals={false} tick={axis} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 13 }} />
        <Line type="monotone" dataKey="cumReceived" name="Lũy kế tiếp nhận" stroke="#8a2323" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="cumResolved" name="Lũy kế giải quyết" stroke="#5f6b3a" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, colorBy }: { data: { name: string; value: number; key?: string }[]; colorBy?: "status" }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <EmptyState title="Chưa có dữ liệu" />;
  return (
    <div className="grid items-center gap-2 sm:grid-cols-[180px_1fr]">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={1} stroke="#fff">
            {data.map((d, i) => (
              <Cell key={i} fill={colorBy === "status" && d.key ? STATUS_COLORS[d.key] : PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="space-y-1 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: colorBy === "status" && d.key ? STATUS_COLORS[d.key] : PALETTE[i % PALETTE.length] }} aria-hidden />
            <span className="flex-1 truncate">{d.name}</span>
            <span className="tabular-nums font-semibold">{d.value}</span>
            <span className="w-12 text-right tabular-nums text-ink-muted">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function UnitChart({ data }: { data: { name: string; resolved: number; processing: number; overdue: number }[] }) {
  if (!data.length) return <EmptyState title="Chưa có hồ sơ được phân công cho bộ phận" />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 52)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ece4d2" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={axis} />
        <YAxis type="category" dataKey="name" width={150} tick={axis} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 13 }} />
        <Bar dataKey="resolved" name="Đã giải quyết" stackId="a" fill="#5f6b3a" />
        <Bar dataKey="processing" name="Đang xử lý" stackId="a" fill="#b08a43" />
        <Bar dataKey="overdue" name="Trong đó quá hạn" fill="#8a2323" />
      </BarChart>
    </ResponsiveContainer>
  );
}
