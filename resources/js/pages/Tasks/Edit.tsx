import AppLayout from '@/layouts/app-layout';
import { Head, router, useForm } from '@inertiajs/react'; //, Link
import { Button } from '@/components/ui/button'; //, buttonVariants
import { route } from 'ziggy-js';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/input-error';
import { FormEventHandler, useRef } from 'react';
import { BreadcrumbItem, Task, TaskCategory } from '@/types';
import { Switch } from '@/components/ui/switch';
import * as React from "react"
// import { ChevronDownIcon } from "lucide-react"
// import {
//     Popover,
//     PopoverContent,
//     PopoverTrigger,
// } from "@/components/ui/popover"
import { DatePickerField } from "@/components/datePicker/date-picker";
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
type EditTaskForm = {
    name: string;
    is_completed: boolean;
    due_date: string | null;
    media: string | null;
    categories: string[];
};
export default function Edit({ task, categories }: { task: Task, categories: TaskCategory[] }) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Tasks', href: route('tasks.index') },
        { title: 'Edit Task', href: route('tasks.edit', task.id) },
    ];
    const taskName = useRef<HTMLInputElement | null>(null);
    const { data, setData, errors, reset, processing, progress } = useForm<Required<EditTaskForm>>({ //, put
        name: task.name,
        is_completed: task.is_completed,
        due_date: task.due_date ?? null,
        media: '',
        categories: task.task_categories.map((category) => category.id.toString()),
    });
    const editTask: FormEventHandler = (e) => {
        e.preventDefault();

        router.post(
            route('tasks.update', task.id),
            { ...data, _method: 'PUT' },
            {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => {
                    reset();
                },
                onError: (errors) => {
                    if (errors.name) {
                        reset('name');
                        taskName.current?.focus();
                    }
                },
            },
        );
    };

    //const [open, setOpen] = React.useState(false)
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Edit Task" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <form onSubmit={editTask} className="space-y-6">
                    <div className="grid gap-2" >
                        <Label htmlFor="name">Task Name *</Label>
                        <Input
                            id="name"
                            ref={taskName}
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            className="mt-1 block w-full"
                        />
                        <InputError message={errors.name} />
                    </div>
                    <DatePickerField
                        id="due_date"
                        name="due_date"
                        label="Due Date"
                        value={data.due_date}                    // string|null from your form
                        onChange={(v) => setData("due_date", v)}
                        error={errors.due_date}
                    />
                    <div className="grid gap-2">
                        <Label htmlFor="media">Media</Label>

                        <Input
                            id="media"
                            onChange={(e) => setData('media', e.target.files[0] ?? null)}
                            className="mt-1 block w-full"
                            type="file"
                        />

                        {progress && (
                            <progress value={progress.percentage} max="100">
                                {progress.percentage}%
                            </progress>
                        )}

                        <InputError message={errors.media} />

                        {!task.mediaFile ? '' : (
                            <a href={task.mediaFile.original_url} target="_blank" className="my-4 mx-auto"><img
                                src={task.mediaFile.original_url} className={'w-32 h-32'} /></a>)}
                    </div>

                    <div className="inline-flex items-center">
                        <Label htmlFor="is_completed" className="mr-2">Completed?</Label>

                        <Switch checked={data.is_completed} onCheckedChange={() => setData('is_completed', !data.is_completed)} />

                        <InputError message={errors.is_completed} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="due_date">Categories</Label>

                        <ToggleGroup type="multiple" variant={'outline'} size={'lg'} value={data.categories}
                            onValueChange={(value) => setData('categories', value)}>
                            {categories.map((category) => (
                                <ToggleGroupItem key={category.id} value={category.id.toString()}>
                                    {category.name}
                                </ToggleGroupItem>
                            ))}
                        </ToggleGroup>

                        <InputError message={errors.due_date} />
                    </div>


                    <div className="flex items-center gap-4">
                        <Button disabled={processing}>Update Task</Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
