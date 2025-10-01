import type { BreadcrumbItem, Task, PaginatedResponse, TaskCategory } from '@/types';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router } from '@inertiajs/react';
import { Button, buttonVariants } from '@/components/ui/button';
import { route } from 'ziggy-js';
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { toast } from 'sonner';
import { TablePagination } from '@/components/table-pagination';
import { format } from 'date-fns';

export default function Index(
    {
        tasks, categories, selectedCategories
    }:
        {
            tasks: PaginatedResponse<Task>, categories: TaskCategory[], selectedCategories: string[] | null

        }) {
    console.log(tasks);
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Tasks', href: route('tasks.index') },
    ];
    const deleteTask = (id: number) => {
        if (confirm('Are you sure?')) {
            router.delete(route('tasks.destroy', { id }));
            toast.success('Task deleted successfully');
        }
    };

    const selectCategory = (id: string) => {
        const selected = selectedCategories?.includes(id)
            ? selectedCategories?.filter((category) => category !== id)
            : [...(selectedCategories || []), id];
        router.visit('/tasks', { data: { categories: selected } });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Tasks List" />
            <div className={'mt-8'}>
                <div className={'flex flex-row gap-x-4'}>
                    <Link className={buttonVariants({ variant: 'default' })} href={route('tasks.create')}>
                        Create Task
                    </Link>
                    <Link className={buttonVariants({ variant: 'outline' })} href={route('task-categories.index')}>
                        Manage Task Categories
                    </Link>
                </div>
                <div className={'mt-4 flex flex-row justify-center gap-x-2'}>
                    {categories.map((category: TaskCategory) => (
                        <Button
                            variant={selectedCategories?.includes(category.id.toString()) ? 'default' : 'outline'}
                            key={category.id}
                            onClick={() => selectCategory(category.id.toString())}
                        >
                            {category.name} ({category.tasks_count})
                        </Button>
                    ))}
                </div>
                <Table className={'mt-4'}>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Task</TableHead>
                            <TableHead className="w-[200px]">Categories</TableHead>
                            <TableHead className="w-[100px]">Status</TableHead>
                            <TableHead>File</TableHead>
                            <TableHead className="w-[100px]">Due Date</TableHead>
                            <TableHead className="w-[150px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tasks.data.map((task) => (
                            <TableRow key={task.id}>
                                <TableCell>{task.name}</TableCell>
                                <TableCell className={'flex flex-row gap-x-2'}>
                                    {task.task_categories?.map((category: TaskCategory) => (
                                        <span key={category.id} className="rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-1 text-xs">
                                            {category.name}
                                        </span>
                                    ))}
                                </TableCell>
                                <TableCell className={task.is_completed ? 'text-green-600' : 'text-red-700'}>
                                    {task.is_completed ? 'Completed' : 'In Progress'}
                                </TableCell>
                                <TableCell>{
                                    !task.mediaFile
                                        ? ''
                                        : (
                                            <a href={task.mediaFile.original_url} target="_blank">
                                                <img src={task.mediaFile.original_url} className={'w-8 h-8'} />
                                            </a>
                                        )
                                }
                                </TableCell>
                                <TableCell>{task.due_date ? format(task.due_date, 'PPP') : ''}</TableCell>
                                <TableCell className="flex flex-row gap-x-2 text-right">
                                    <Link className={buttonVariants({ variant: 'default' })}
                                        href={route('tasks.edit', { id: task.id })}>
                                        Edit
                                    </Link>
                                    <Button variant={'destructive'} className={'cursor-pointer'} onClick={() => deleteTask(task.id)}>
                                        Delete
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <TablePagination resource={tasks} />
            </div>
        </AppLayout>
    );
}
