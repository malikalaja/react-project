import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { useMemo, type CSSProperties } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    Legend as RechartsLegend,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
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
    'color-mix(in srgb, var(--color-foreground) 90%, transparent)',
    'color-mix(in srgb, var(--color-foreground) 65%, transparent)',
    'color-mix(in srgb, var(--color-foreground) 45%, transparent)',
    'color-mix(in srgb, var(--color-foreground) 30%, transparent)',
    'color-mix(in srgb, var(--color-foreground) 18%, transparent)',
];

const FALLBACK_COLOR =
    'color-mix(in srgb, var(--color-foreground) 40%, transparent)';

const tooltipStyle: CSSProperties = {
    backgroundColor: 'var(--color-card)',
    borderRadius: 'calc(var(--radius) + 6px)',
    border: '1px solid color-mix(in srgb, var(--color-border) 65%, transparent)',
    color: 'var(--color-foreground)',
    padding: '0.75rem 1rem',
    boxShadow:
        '0px 18px 40px -28px color-mix(in srgb, var(--color-foreground) 35%, transparent)',
};

const legendStyle: CSSProperties = {
    color: 'color-mix(in srgb, var(--color-muted-foreground) 90%, transparent)',
    fontSize: '0.75rem',
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

        const colors = labels.map((_, idx) => {
            if (Array.isArray(dataset?.backgroundColor)) {
                const swatch = dataset.backgroundColor[idx];
                if (
                    typeof swatch === 'string' &&
                    (swatch.includes('var(') || swatch.includes('color-mix'))
                ) {
                    return swatch;
                }
            }

            if (typeof dataset?.backgroundColor === 'string') {
                const swatch = dataset.backgroundColor;
                if (swatch.includes('var(') || swatch.includes('color-mix')) {
                    return swatch;
                }
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
        const labels = Array.isArray(tasksCreatedByDay?.labels)
            ? tasksCreatedByDay.labels
            : [];
        const dataPoints = Array.isArray(primaryTasksDataset?.data)
            ? primaryTasksDataset.data
            : [];

        return labels.map((label, idx) => ({
            day: label,
            count: Number(dataPoints[idx] ?? 0),
        }));
    }, [primaryTasksDataset?.data, tasksCreatedByDay?.labels]);

    const barFill = useMemo(() => {
        const background = primaryTasksDataset?.backgroundColor;

        if (Array.isArray(background)) {
            const swatch = background[0];
            if (
                typeof swatch === 'string' &&
                (swatch.includes('var(') || swatch.includes('color-mix'))
            ) {
                return swatch;
            }
        }

        if (typeof background === 'string' && background.trim().length > 0) {
            if (
                background.includes('var(') ||
                background.includes('color-mix')
            ) {
                return background;
            }
        }

        return 'color-mix(in srgb, var(--color-foreground) 80%, transparent)';
    }, [primaryTasksDataset?.backgroundColor]);

    const barLegendLabel = primaryTasksDataset?.label ?? 'Tasks';

    const totalTasks = pieChartData.reduce((sum, item) => sum + item.value, 0);
    const completedTasks =
        pieChartData.find((item) =>
            item.name.toLowerCase().includes('complete'),
        )?.value ?? 0;
    const inProgressTasks = Math.max(totalTasks - completedTasks, 0);
    const completionRate =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const completionProgressWidth = `${Math.min(Math.max(completionRate, 0), 100)}%`;
    const activeRatio =
        totalTasks > 0 ? Math.round((inProgressTasks / totalTasks) * 100) : 0;

    const busiestDay = barChartData.reduce(
        (peak, entry) => (entry.count > peak.count ? entry : peak),
        { day: '', count: 0 },
    );
    const busiestDaySummary = busiestDay.count
        ? `${busiestDay.day} leads with ${busiestDay.count} ${busiestDay.count === 1 ? 'task' : 'tasks'}.`
        : 'Weekly activity will appear once tasks are created.';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <section className="my-5 flex flex-col gap-8">
                <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                            Dashboard
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Keep tabs on throughput, remaining workload, and
                            momentum across the week.
                        </p>
                    </div>
                </header>

                <div className="grid gap-4 sm:grid-cols-3">
                    <Card className="relative overflow-hidden after:pointer-events-none after:absolute after:inset-x-4 after:top-3 after:-z-10 after:h-24 after:rounded-b-[999px] after:bg-[radial-gradient(circle,_color-mix(in_srgb,_var(--color-foreground)_14%,_transparent)_0%,_transparent_75%)] after:content-['']">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Completed tasks
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-3xl font-semibold tracking-tight text-foreground">
                                {completedTasks}
                            </p>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                        width: completionProgressWidth,
                                        background:
                                            'color-mix(in srgb, var(--color-foreground) 80%, transparent)',
                                    }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {completionRate}% complete
                                {totalTasks
                                    ? ` � ${totalTasks} total tasks`
                                    : ''}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                In progress
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-3xl font-semibold tracking-tight text-foreground">
                                {inProgressTasks}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {totalTasks
                                    ? `${activeRatio}% of the current workload remains active.`
                                    : 'No active tasks right now.'}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[color-mix(in_srgb,_var(--color-foreground)_70%,_transparent)]" />
                                {totalTasks
                                    ? 'Continue chipping away to hit 100% completion.'
                                    : 'Create tasks to populate your week.'}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="relative overflow-hidden before:pointer-events-none before:absolute before:inset-x-6 before:bottom-0 before:-z-10 before:h-20 before:rounded-t-[999px] before:bg-[radial-gradient(circle,_color-mix(in_srgb,_var(--color-foreground)_12%,_transparent)_0%,_transparent_70%)] before:content-['']">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Due today
                            </CardTitle>
                            <CardDescription>
                                Focus on anything that needs attention before
                                midnight.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-4xl font-semibold tracking-tight text-foreground">
                                {pendingTasksToday}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {pendingTasksToday === 0
                                    ? 'You are clear for the day�great work.'
                                    : 'Stay on pace to wrap these up on time.'}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-12">
                    <Card className="min-h-[340px] lg:col-span-5">
                        <CardHeader>
                            <CardTitle>Completion status</CardTitle>
                            <CardDescription>
                                Completed vs in-progress tasks.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="h-full">
                            {pieChartData.length ? (
                                <div className="h-[220px] w-full md:h-[260px]">
                                    <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                    >
                                        <PieChart>
                                            <Pie
                                                data={pieChartData}
                                                dataKey="value"
                                                nameKey="name"
                                                innerRadius="55%"
                                                outerRadius="80%"
                                                stroke="color-mix(in srgb, var(--color-foreground) 12%, transparent)"
                                                strokeWidth={1}
                                            >
                                                {pieChartData.map(
                                                    (entry, idx) => (
                                                        <Cell
                                                            key={`${entry.name}-${idx}`}
                                                            fill={
                                                                entry.color ??
                                                                FALLBACK_COLOR
                                                            }
                                                        />
                                                    ),
                                                )}
                                            </Pie>
                                            <RechartsTooltip
                                                contentStyle={tooltipStyle}
                                                cursor={{
                                                    fill: 'color-mix(in srgb, var(--color-muted) 35%, transparent)',
                                                }}
                                                labelStyle={{
                                                    color: 'var(--color-foreground)',
                                                }}
                                                itemStyle={{
                                                    color: 'var(--color-foreground)',
                                                }}
                                            />
                                            <RechartsLegend
                                                wrapperStyle={legendStyle}
                                                iconType="circle"
                                            />
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

                    <Card className="min-h-[340px] lg:col-span-7">
                        <CardHeader>
                            <CardTitle>Weekly output</CardTitle>
                            <CardDescription>
                                {barChartData.length
                                    ? busiestDaySummary
                                    : 'No tasks created this week.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="h-full">
                            {barChartData.length ? (
                                <div className="h-[220px] w-full md:h-[260px]">
                                    <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                    >
                                        <BarChart data={barChartData}>
                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                stroke="color-mix(in srgb, var(--color-border) 55%, transparent)"
                                            />
                                            <XAxis
                                                dataKey="day"
                                                tick={{
                                                    fill: 'color-mix(in srgb, var(--color-muted-foreground) 85%, transparent)',
                                                    fontSize: 12,
                                                }}
                                                axisLine={{
                                                    stroke: 'color-mix(in srgb, var(--color-border) 65%, transparent)',
                                                }}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                tick={{
                                                    fill: 'color-mix(in srgb, var(--color-muted-foreground) 85%, transparent)',
                                                    fontSize: 12,
                                                }}
                                                axisLine={{
                                                    stroke: 'color-mix(in srgb, var(--color-border) 65%, transparent)',
                                                }}
                                                tickLine={false}
                                                allowDecimals={false}
                                            />
                                            <RechartsTooltip
                                                contentStyle={tooltipStyle}
                                                cursor={{
                                                    fill: 'color-mix(in srgb, var(--color-muted) 25%, transparent)',
                                                }}
                                                labelStyle={{
                                                    color: 'var(--color-foreground)',
                                                }}
                                                itemStyle={{
                                                    color: 'var(--color-foreground)',
                                                }}
                                            />
                                            <RechartsLegend
                                                wrapperStyle={legendStyle}
                                                iconType="circle"
                                            />
                                            <Bar
                                                dataKey="count"
                                                name={barLegendLabel}
                                                fill={barFill}
                                                radius={[8, 8, 0, 0]}
                                            />
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
