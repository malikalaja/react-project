import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { useMemo, type CSSProperties } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip as RechartsTooltip,
    Legend as RechartsLegend,
    BarChart,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
} from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];

type ChartJsDataset = {
    data?: number[];
    backgroundColor?: string | string[];
    label?: string;
};

type ChartJsData = {
    labels?: string[];
    datasets?: ChartJsDataset[];
};

type DashboardProps = {
    completedVsPendingTaskChart: ChartJsData;
    pendingTasksToday: number;
    tasksCreatedByDay: ChartJsData;
};

const NEUTRAL_SWATCHES = [
    'var(--color-foreground)',
    'color-mix(in srgb, var(--color-foreground) 70%, var(--color-background))',
    'color-mix(in srgb, var(--color-foreground) 45%, var(--color-background))',
    'color-mix(in srgb, var(--color-foreground) 30%, transparent)',
    'color-mix(in srgb, var(--color-foreground) 20%, transparent)',
];

const FALLBACK_COLOR = 'var(--color-border)';

const tooltipStyle: CSSProperties = {
    backgroundColor: 'var(--color-card)',
    borderRadius: 'calc(var(--radius) + 6px)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-foreground)',
    padding: '0.75rem 1rem',
    boxShadow: '0px 18px 40px -28px rgba(15, 15, 15, 0.35)',
};

const legendStyle: CSSProperties = {
    color: 'var(--color-muted-foreground)',
};

export default function Dashboard({
    completedVsPendingTaskChart,
    pendingTasksToday,
    tasksCreatedByDay,
}: DashboardProps) {
    const pieChartData = useMemo(() => {
        const labels = Array.isArray(completedVsPendingTaskChart?.labels)
            ? completedVsPendingTaskChart.labels
            : [];
        const dataset = completedVsPendingTaskChart?.datasets?.[0];
        const values = Array.isArray(dataset?.data) ? dataset?.data : [];
        const background = dataset?.backgroundColor;

        const colors = labels.map((_, idx) => {
            if (Array.isArray(background)) {
                return background[idx] ?? NEUTRAL_SWATCHES[idx % NEUTRAL_SWATCHES.length];
            }

            if (typeof background === 'string' && background.trim().length > 0) {
                return background;
            }

            return NEUTRAL_SWATCHES[idx % NEUTRAL_SWATCHES.length];
        });

        return labels.map((label, idx) => ({
            name: label,
            value: Number(values[idx] ?? 0),
            color: colors[idx] ?? FALLBACK_COLOR,
        }));
    }, [completedVsPendingTaskChart]);

    const primaryTasksDataset = tasksCreatedByDay?.datasets?.[0];

    const barChartData = useMemo(() => {
        const labels = Array.isArray(tasksCreatedByDay?.labels) ? tasksCreatedByDay.labels : [];
        const dataPoints = Array.isArray(primaryTasksDataset?.data) ? primaryTasksDataset.data : [];

        return labels.map((label, idx) => ({
            day: label,
            count: Number(dataPoints[idx] ?? 0),
        }));
    }, [primaryTasksDataset?.data, tasksCreatedByDay?.labels]);

    const barFill = useMemo(() => {
        const background = primaryTasksDataset?.backgroundColor;

        if (Array.isArray(background)) {
            return background[0] ?? FALLBACK_COLOR;
        }

        if (typeof background === 'string' && background.trim().length > 0) {
            return background;
        }

        return 'var(--color-foreground)';
    }, [primaryTasksDataset?.backgroundColor]);

    const barLegendLabel = primaryTasksDataset?.label ?? 'Tasks';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <section className="flex flex-col gap-8">
                <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
                        <p className="text-sm text-muted-foreground">
                            Overview your task progress, due work, and creation cadence with the latest updates.
                        </p>
                    </div>
                </header>
                <div className="grid gap-6 md:grid-cols-3">
                    <Card className="min-h-[320px]">
                        <CardHeader>
                            <CardTitle>Completion status</CardTitle>
                            <CardDescription>Completed vs in-progress tasks.</CardDescription>
                        </CardHeader>
                        <CardContent className="h-full">
                            {pieChartData.length ? (
                                <div className="h-[220px] w-full md:h-[240px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={pieChartData}
                                                dataKey="value"
                                                nameKey="name"
                                                innerRadius="55%"
                                                outerRadius="80%"
                                                stroke="var(--color-card)"
                                                strokeWidth={1}
                                            >
                                                {pieChartData.map((entry, idx) => (
                                                    <Cell key={`${entry.name}-${idx}`} fill={entry.color ?? FALLBACK_COLOR} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip
                                                contentStyle={tooltipStyle}
                                                cursor={{ fill: 'color-mix(in srgb, var(--color-muted) 35%, transparent)' }}
                                            />
                                            <RechartsLegend wrapperStyle={legendStyle} iconType="circle" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                                    No task data to display.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    <Card className="justify-between">
                        <CardHeader>
                            <CardTitle>Tasks due today</CardTitle>
                            <CardDescription>Keep your workload on schedule.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-1 flex-col justify-center gap-6">
                            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Open tasks</p>
                            <p className="text-5xl font-semibold text-foreground">{pendingTasksToday}</p>
                            <p className="text-sm text-muted-foreground">Due before the day ends.</p>
                        </CardContent>
                    </Card>
                    <Card className="min-h-[320px]">
                        <CardHeader>
                            <CardTitle>Weekly output</CardTitle>
                            <CardDescription>Tasks created per weekday.</CardDescription>
                        </CardHeader>
                        <CardContent className="h-full">
                            {barChartData.length ? (
                                <div className="h-[220px] w-full md:h-[240px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={barChartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--color-border) 55%, transparent)" />
                                            <XAxis
                                                dataKey="day"
                                                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
                                                axisLine={{ stroke: 'var(--color-border)' }}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
                                                axisLine={{ stroke: 'var(--color-border)' }}
                                                tickLine={false}
                                                allowDecimals={false}
                                            />
                                            <RechartsTooltip
                                                contentStyle={tooltipStyle}
                                                cursor={{ fill: 'color-mix(in srgb, var(--color-muted) 25%, transparent)' }}
                                            />
                                            <RechartsLegend wrapperStyle={legendStyle} iconType="plainline" />
                                            <Bar dataKey="count" name={barLegendLabel} fill={barFill} radius={[8, 8, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                                    No tasks created this week.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </section>
        </AppLayout>
    );
}
